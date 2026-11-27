mod tray;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Local;
use pulsetrack_core::analytics::{
    build_dashboard_summary, calculate_productivity_score, compute_previous_range,
};
use pulsetrack_core::db::Database;
use pulsetrack_core::export::{export_sessions_csv, export_structured_json};
use pulsetrack_core::focus::{compute_focus_streak, FocusEngine};
use pulsetrack_core::limits::{evaluate_daily_limits, LimitAlertTracker};
use pulsetrack_core::models::{
    ActivitySession, AppSettings, Category, CategoryRule, DailyLimit, DailyLimitStatus,
    DashboardSummary, FocusConfig, FocusRuntimeState, FocusSessionRecord, IgnoreRule,
    LiveTrackingStatus, ProductivityKind, RuleTestResult,
};
use pulsetrack_core::platform::create_platform_monitor;
use pulsetrack_core::rules::test_rule_evaluation;
use pulsetrack_core::tracker::ActivityTracker;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub tracker: Arc<Mutex<ActivityTracker>>,
    pub focus: Arc<Mutex<FocusEngine>>,
    pub live: Arc<Mutex<LiveTrackingStatus>>,
    pub quitting: Arc<AtomicBool>,
}

#[tauri::command]
fn get_live_status(state: State<AppState>) -> Result<LiveTrackingStatus, String> {
    Ok(state.live.lock().unwrap().clone())
}

#[tauri::command]
fn set_paused(app: AppHandle, state: State<AppState>, paused: bool) -> Result<LiveTrackingStatus, String> {
    let now_ms = Local::now().timestamp_millis();
    let flushed = state.tracker.lock().unwrap().set_paused(paused, now_ms);
    if !flushed.is_empty() {
        state.db.lock().unwrap().upsert_sessions(&flushed).map_err(|e| e.to_string())?;
    }
    let live = {
        let mut l = state.live.lock().unwrap();
        l.paused = paused;
        if paused {
            l.is_idle = false;
            l.active_duration_secs = 0;
        }
        l.clone()
    };
    let _ = app.emit("pulsetrack:live", &live);
    tray::refresh_tray_labels(&app, &state);
    Ok(live)
}

#[tauri::command]
fn get_dashboard_summary(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<DashboardSummary, String> {
    let (prev_start, prev_end) = compute_previous_range(&start_date, &end_date)?;
    let db = state.db.lock().unwrap();
    let current = db.query_sessions(&start_date, &end_date).map_err(|e| e.to_string())?;
    let previous = db.query_sessions(&prev_start, &prev_end).map_err(|e| e.to_string())?;
    let categories = db.list_categories().map_err(|e| e.to_string())?;
    let settings = db.load_settings().map_err(|e| e.to_string())?;
    let icons = db.load_all_icons().map_err(|e| e.to_string())?;

    Ok(build_dashboard_summary(
        &start_date,
        &end_date,
        &prev_start,
        &prev_end,
        &current,
        &previous,
        &categories,
        settings.context_switch_debounce_secs,
        &icons,
    ))
}

#[tauri::command]
fn get_sessions(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<ActivitySession>, String> {
    state
        .db
        .lock()
        .unwrap()
        .query_sessions(&start_date, &end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_categories(state: State<AppState>) -> Result<Vec<Category>, String> {
    state.db.lock().unwrap().list_categories().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_category(state: State<AppState>, category: Category) -> Result<Vec<Category>, String> {
    let db = state.db.lock().unwrap();
    db.save_category(&category).map_err(|e| e.to_string())?;
    db.list_categories().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_category(state: State<AppState>, id: String) -> Result<Vec<Category>, String> {
    let db = state.db.lock().unwrap();
    db.delete_category(&id).map_err(|e| e.to_string())?;
    db.list_categories().map_err(|e| e.to_string())
}

#[tauri::command]
fn list_rules(state: State<AppState>) -> Result<Vec<CategoryRule>, String> {
    state.db.lock().unwrap().list_rules().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_rule(state: State<AppState>, rule: CategoryRule) -> Result<Vec<CategoryRule>, String> {
    let db = state.db.lock().unwrap();
    db.save_rule(&rule).map_err(|e| e.to_string())?;
    let _ = db.recategorize_all_sessions();
    db.list_rules().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_rule(state: State<AppState>, id: String) -> Result<Vec<CategoryRule>, String> {
    let db = state.db.lock().unwrap();
    db.delete_rule(&id).map_err(|e| e.to_string())?;
    let _ = db.recategorize_all_sessions();
    db.list_rules().map_err(|e| e.to_string())
}

#[tauri::command]
fn list_ignore_rules(state: State<AppState>) -> Result<Vec<IgnoreRule>, String> {
    state.db.lock().unwrap().list_ignore_rules().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_ignore_rule(state: State<AppState>, rule: IgnoreRule) -> Result<Vec<IgnoreRule>, String> {
    let db = state.db.lock().unwrap();
    db.save_ignore_rule(&rule).map_err(|e| e.to_string())?;
    db.list_ignore_rules().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_ignore_rule(state: State<AppState>, id: String) -> Result<Vec<IgnoreRule>, String> {
    let db = state.db.lock().unwrap();
    db.delete_ignore_rule(&id).map_err(|e| e.to_string())?;
    db.list_ignore_rules().map_err(|e| e.to_string())
}

#[tauri::command]
fn list_limit_statuses(state: State<AppState>) -> Result<Vec<DailyLimitStatus>, String> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let db = state.db.lock().unwrap();
    let limits = db.list_limits().map_err(|e| e.to_string())?;
    let sessions = db.query_sessions(&today, &today).map_err(|e| e.to_string())?;
    let categories = db.list_categories().map_err(|e| e.to_string())?;
    Ok(evaluate_daily_limits(&limits, &sessions, &categories))
}

#[tauri::command]
fn save_limit(state: State<AppState>, limit: DailyLimit) -> Result<Vec<DailyLimitStatus>, String> {
    {
        let db = state.db.lock().unwrap();
        db.save_limit(&limit).map_err(|e| e.to_string())?;
    }
    list_limit_statuses(state)
}

#[tauri::command]
fn delete_limit(state: State<AppState>, id: String) -> Result<Vec<DailyLimitStatus>, String> {
    {
        let db = state.db.lock().unwrap();
        db.delete_limit(&id).map_err(|e| e.to_string())?;
    }
    list_limit_statuses(state)
}

#[tauri::command]
fn get_focus_state(state: State<AppState>) -> Result<FocusRuntimeState, String> {
    Ok(state.focus.lock().unwrap().runtime_state())
}

#[tauri::command]
fn focus_start(app: AppHandle, state: State<AppState>) -> Result<FocusRuntimeState, String> {
    let now_ms = Local::now().timestamp_millis();
    let rt = {
        let mut focus = state.focus.lock().unwrap();
        focus.start_focus(now_ms);
        focus.runtime_state()
    };
    let _ = app.emit("pulsetrack:focus", &rt);
    tray::refresh_tray_labels(&app, &state);
    Ok(rt)
}

#[tauri::command]
fn focus_pause(app: AppHandle, state: State<AppState>) -> Result<FocusRuntimeState, String> {
    let rt = {
        let mut focus = state.focus.lock().unwrap();
        focus.pause();
        focus.runtime_state()
    };
    let _ = app.emit("pulsetrack:focus", &rt);
    tray::refresh_tray_labels(&app, &state);
    Ok(rt)
}

#[tauri::command]
fn focus_resume(app: AppHandle, state: State<AppState>) -> Result<FocusRuntimeState, String> {
    let now_ms = Local::now().timestamp_millis();
    let rt = {
        let mut focus = state.focus.lock().unwrap();
        focus.resume(now_ms);
        focus.runtime_state()
    };
    let _ = app.emit("pulsetrack:focus", &rt);
    tray::refresh_tray_labels(&app, &state);
    Ok(rt)
}

#[tauri::command]
fn focus_reset(app: AppHandle, state: State<AppState>) -> Result<FocusRuntimeState, String> {
    let rt = {
        let mut focus = state.focus.lock().unwrap();
        focus.reset();
        focus.runtime_state()
    };
    let _ = app.emit("pulsetrack:focus", &rt);
    tray::refresh_tray_labels(&app, &state);
    Ok(rt)
}

#[tauri::command]
fn update_focus_config(
    state: State<AppState>,
    config: FocusConfig,
) -> Result<FocusRuntimeState, String> {
    state
        .db
        .lock()
        .unwrap()
        .save_focus_config(&config)
        .map_err(|e| e.to_string())?;
    let mut focus = state.focus.lock().unwrap();
    focus.update_config(config);
    Ok(focus.runtime_state())
}

#[tauri::command]
fn list_focus_sessions(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<FocusSessionRecord>, String> {
    state
        .db
        .lock()
        .unwrap()
        .list_focus_sessions(&start_date, &end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Result<AppSettings, String> {
    state.db.lock().unwrap().load_settings().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    state
        .db
        .lock()
        .unwrap()
        .save_settings(&settings)
        .map_err(|e| e.to_string())?;

    // Sync Windows login auto-start cleanly
    let autostart = app.autolaunch();
    if settings.auto_start_login {
        let _ = autostart.enable();
    } else {
        let _ = autostart.disable();
    }

    Ok(settings)
}

#[tauri::command]
fn export_data(
    app: AppHandle,
    state: State<AppState>,
    format: String,
    start_date: String,
    end_date: String,
) -> Result<Option<String>, String> {
    let (prev_start, prev_end) = compute_previous_range(&start_date, &end_date)?;
    let (content, default_name, ext) = {
        let db = state.db.lock().unwrap();
        let sessions = db.query_sessions(&start_date, &end_date).map_err(|e| e.to_string())?;
        let categories = db.list_categories().map_err(|e| e.to_string())?;
        if format.eq_ignore_ascii_case("json") {
            let prev = db.query_sessions(&prev_start, &prev_end).map_err(|e| e.to_string())?;
            let settings = db.load_settings().map_err(|e| e.to_string())?;
            let icons = db.load_all_icons().map_err(|e| e.to_string())?;
            let summary = build_dashboard_summary(
                &start_date,
                &end_date,
                &prev_start,
                &prev_end,
                &sessions,
                &prev,
                &categories,
                settings.context_switch_debounce_secs,
                &icons,
            );
            let json = export_structured_json(&summary, &sessions).map_err(|e| e.to_string())?;
            (json, format!("desttraky_{start_date}_to_{end_date}.json"), "json")
        } else {
            let csv = export_sessions_csv(&sessions, &categories);
            (csv, format!("desttraky_{start_date}_to_{end_date}.csv"), "csv")
        }
    };

    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(ext.to_uppercase(), &[ext])
        .blocking_save_file();

    let Some(path) = file_path else {
        return Ok(None);
    };

    let path_buf = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path_buf, content).map_err(|e| e.to_string())?;
    Ok(Some(path_buf.to_string_lossy().to_string()))
}

#[tauri::command]
fn log_manual_session(
    state: State<AppState>,
    title: String,
    category_id: String,
    duration_mins: i64,
    tag: Option<String>,
) -> Result<ActivitySession, String> {
    let now_ms = Local::now().timestamp_millis();
    let dur_secs = (duration_mins.max(1)) * 60;
    let start_ts = now_ms - dur_secs * 1000;
    let mut tags = vec!["manual".to_string()];
    if let Some(t) = tag {
        let trimmed = t.trim();
        if !trimmed.is_empty() {
            tags.push(trimmed.to_string());
        }
    }
    let session = ActivitySession {
        id: uuid::Uuid::new_v4().to_string(),
        date: Local::now().format("%Y-%m-%d").to_string(),
        app_name: "Manual Task".to_string(),
        process_name: "manual".to_string(),
        window_title: title.trim().to_string(),
        domain_context: tags.get(1).cloned(),
        category_id,
        start_ts,
        end_ts: now_ms,
        duration_secs: dur_secs,
        icon_key: None,
        tags,
        is_manual: true,
    };
    state
        .db
        .lock()
        .unwrap()
        .upsert_sessions(&[session.clone()])
        .map_err(|e| e.to_string())?;
    Ok(session)
}

#[tauri::command]
fn test_rule_match(
    state: State<AppState>,
    app_name: String,
    window_title: String,
) -> Result<RuleTestResult, String> {
    let db = state.db.lock().unwrap();
    let rules = db.list_rules().map_err(|e| e.to_string())?;
    let ignores = db.list_ignore_rules().map_err(|e| e.to_string())?;
    let proc_name = format!("{}.exe", app_name.trim().replace(' ', ""));
    Ok(test_rule_evaluation(
        &app_name,
        &proc_name,
        &window_title,
        &rules,
        &ignores,
        Local::now().timestamp_millis(),
    ))
}

#[tauri::command]
fn clear_all_data(state: State<AppState>) -> Result<(), String> {
    let mut tracker = state.tracker.lock().unwrap();
    tracker.current = None;
    drop(tracker);
    state
        .db
        .lock()
        .unwrap()
        .clear_all_activity_data()
        .map_err(|e| e.to_string())
}

fn spawn_background_monitor(app: AppHandle, state: AppState) {
    let icon_cache_dir = app
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("pulsetrack"))
        .join("icons");

    std::thread::spawn(move || {
        let mut monitor = create_platform_monitor(icon_cache_dir);
        let mut limit_alerts = LimitAlertTracker::default();
        let mut tick_counter: u64 = 0;

        loop {
            if state.quitting.load(Ordering::SeqCst) {
                break;
            }
            tick_counter += 1;
            let now_ms = Local::now().timestamp_millis();
            let today = Local::now().format("%Y-%m-%d").to_string();

            let sample = monitor.sample_foreground();

            // Persist any newly extracted app icon
            while let Some((icon_key, data_url)) = monitor.take_new_icon() {
                if let Ok(db) = state.db.lock() {
                    let _ = db.save_icon(&icon_key, &data_url, now_ms);
                }
            }

            let (settings, rules, ignore_rules, categories, limits) = {
                let db = state.db.lock().unwrap();
                (
                    db.load_settings().unwrap_or_default(),
                    db.list_rules().unwrap_or_default(),
                    db.list_ignore_rules().unwrap_or_default(),
                    db.list_categories().unwrap_or_default(),
                    db.list_limits().unwrap_or_default(),
                )
            };

            let out = {
                let mut tracker = state.tracker.lock().unwrap();
                tracker.tick(now_ms, sample, &settings, &rules, &ignore_rules)
            };

            // Persist ONLY transitions and periodic checkpoints (never every 1s)
            if !out.flushed.is_empty() || !out.checkpoint.is_empty() {
                let db = state.db.lock().unwrap();
                if !out.flushed.is_empty() {
                    let _ = db.upsert_sessions(&out.flushed);
                }
                if !out.checkpoint.is_empty() {
                    let _ = db.upsert_sessions(&out.checkpoint);
                }
            }

            // Compute live today totals + limit checks
            let today_sessions = state
                .db
                .lock()
                .unwrap()
                .query_sessions(&today, &today)
                .unwrap_or_default();

            let stored_today_secs: i64 = today_sessions.iter().map(|s| s.duration_secs.max(0)).sum();
            let today_total_secs = stored_today_secs + out.active_duration_secs;
            let today_score = calculate_productivity_score(&today_sessions, &categories);

            let live_status = {
                let paused = state.tracker.lock().unwrap().paused;
                let mut live = state.live.lock().unwrap();
                live.paused = paused;
                live.is_idle = out.is_idle;
                live.is_fullscreen_suppressed = out.is_fullscreen_suppressed;
                live.active_app = out.active_app.clone();
                live.active_title = out.active_title.clone();
                live.active_context = out.active_context.clone();
                live.active_category_id = out.active_category_id.clone();
                live.active_duration_secs = out.active_duration_secs;
                live.today_total_secs = today_total_secs;
                live.today_score = today_score;
                live.clone()
            };

            // Check daily limits every 5 seconds
            if tick_counter % 5 == 0 && !limits.is_empty() {
                let statuses = evaluate_daily_limits(&limits, &today_sessions, &categories);
                let alerts = limit_alerts.check_alerts(&today, now_ms, &statuses);
                for alert in alerts {
                    let _ = app
                        .notification()
                        .builder()
                        .title(&alert.title)
                        .body(&alert.body)
                        .show();
                    let _ = app.emit("pulsetrack:alert", &alert);
                }
            }

            // Tick Focus timer & check distraction alerts
            let (focus_state, focus_completed_rec, focus_alerts) = {
                let mut focus = state.focus.lock().unwrap();
                let (rec, done_alert) = focus.tick_1s(now_ms);
                let mut alerts = Vec::new();
                if let Some(a) = done_alert {
                    alerts.push(a);
                }
                if let (Some(app_name), Some(cat_id)) = (&out.active_app, &out.active_category_id) {
                    let kind = categories
                        .iter()
                        .find(|c| &c.id == cat_id)
                        .map(|c| c.kind)
                        .unwrap_or(ProductivityKind::Neutral);
                    if let Some(dist_alert) = focus.check_distraction(app_name, kind, now_ms) {
                        alerts.push(dist_alert);
                    }
                }
                (focus.runtime_state(), rec, alerts)
            };

            if let Some(rec) = focus_completed_rec {
                let db = state.db.lock().unwrap();
                let _ = db.save_focus_session(&rec);
                let dates = db.list_completed_focus_dates().unwrap_or_default();
                let streak = compute_focus_streak(&dates, Local::now().date_naive());
                state.focus.lock().unwrap().current_streak_days = streak;
            }

            for alert in focus_alerts {
                let _ = app
                    .notification()
                    .builder()
                    .title(&alert.title)
                    .body(&alert.body)
                    .show();
                let _ = app.emit("pulsetrack:alert", &alert);
            }

            // Only push UI events when main window is visible to minimize overhead when minimized to tray
            let window_visible = app
                .get_webview_window("main")
                .and_then(|w| w.is_visible().ok())
                .unwrap_or(false);
            if window_visible {
                let _ = app.emit("pulsetrack:live", &live_status);
                if focus_state.running {
                    let _ = app.emit("pulsetrack:focus", &focus_state);
                }
            }

            if tick_counter % 15 == 0 {
                tray::refresh_tray_labels(&app, &state);
            }

            std::thread::sleep(Duration::from_secs(1));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let data_dir = app
                .path()
                .app_local_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("desttraky"));
            let db_path = data_dir.join("desttraky.db");
            let db = Database::open(&db_path).expect("Failed to open local DestTraky SQLite DB");

            let focus_cfg = db.load_focus_config().unwrap_or_default();
            let today = Local::now().format("%Y-%m-%d").to_string();
            let completed_today = db
                .list_focus_sessions(&today, &today)
                .map(|v| v.into_iter().filter(|s| s.completed).count() as u32)
                .unwrap_or(0);
            let completed_dates = db.list_completed_focus_dates().unwrap_or_default();
            let streak = compute_focus_streak(&completed_dates, Local::now().date_naive());

            let state = AppState {
                db: Arc::new(Mutex::new(db)),
                tracker: Arc::new(Mutex::new(ActivityTracker::new())),
                focus: Arc::new(Mutex::new(FocusEngine::new(
                    focus_cfg,
                    completed_today,
                    streak,
                ))),
                live: Arc::new(Mutex::new(LiveTrackingStatus {
                    paused: false,
                    is_idle: false,
                    is_fullscreen_suppressed: false,
                    active_app: None,
                    active_title: None,
                    active_context: None,
                    active_category_id: None,
                    active_duration_secs: 0,
                    today_total_secs: 0,
                    today_score: None,
                })),
                quitting: Arc::new(AtomicBool::new(false)),
            };

            let bg_state = AppState {
                db: Arc::clone(&state.db),
                tracker: Arc::clone(&state.tracker),
                focus: Arc::clone(&state.focus),
                live: Arc::clone(&state.live),
                quitting: Arc::clone(&state.quitting),
            };

            app.manage(state);
            tray::setup_tray(app.handle())?;
            spawn_background_monitor(app.handle().clone(), bg_state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<AppState>() {
                    if state.quitting.load(Ordering::SeqCst) {
                        return;
                    }
                    let minimize = state
                        .db
                        .lock()
                        .unwrap()
                        .load_settings()
                        .map(|s| s.minimize_to_tray)
                        .unwrap_or(true);
                    if minimize {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_live_status,
            set_paused,
            get_dashboard_summary,
            get_sessions,
            list_categories,
            save_category,
            delete_category,
            list_rules,
            save_rule,
            delete_rule,
            list_ignore_rules,
            save_ignore_rule,
            delete_ignore_rule,
            list_limit_statuses,
            save_limit,
            delete_limit,
            get_focus_state,
            focus_start,
            focus_pause,
            focus_resume,
            focus_reset,
            update_focus_config,
            list_focus_sessions,
            get_settings,
            save_settings,
            export_data,
            log_manual_session,
            test_rule_match,
            clear_all_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DestTraky");
}
