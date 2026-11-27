use std::sync::atomic::Ordering;

use chrono::Local;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;

pub const TRAY_ID: &str = "pulsetrack-tray";
pub const MENU_SUMMARY_ID: &str = "tray-summary";
pub const MENU_PAUSE_ID: &str = "tray-pause";
pub const MENU_FOCUS_ID: &str = "tray-focus";
pub const MENU_OPEN_ID: &str = "tray-open";
pub const MENU_QUIT_ID: &str = "tray-quit";

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let summary = MenuItem::with_id(app, MENU_SUMMARY_ID, "Today: 0m", false, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let pause = MenuItem::with_id(app, MENU_PAUSE_ID, "Pause Tracking", true, None::<&str>)?;
    let focus = MenuItem::with_id(app, MENU_FOCUS_ID, "Start Focus (25m)", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let open = MenuItem::with_id(app, MENU_OPEN_ID, "Open Dashboard", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT_ID, "Quit DestTraky", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&summary, &sep1, &pause, &focus, &sep2, &open, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("DestTraky — Active")
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_OPEN_ID => show_main_window(app),
            MENU_PAUSE_ID => {
                if let Some(state) = app.try_state::<AppState>() {
                    let now_ms = Local::now().timestamp_millis();
                    let next_paused = {
                        let mut tracker = state.tracker.lock().unwrap();
                        let next = !tracker.paused;
                        let flushed = tracker.set_paused(next, now_ms);
                        if !flushed.is_empty() {
                            let db = state.db.lock().unwrap();
                            let _ = db.upsert_sessions(&flushed);
                        }
                        next
                    };
                    let _ = app.emit("pulsetrack:paused", next_paused);
                    refresh_tray_labels(app, &state);
                }
            }
            MENU_FOCUS_ID => {
                if let Some(state) = app.try_state::<AppState>() {
                    let now_ms = Local::now().timestamp_millis();
                    let runtime = {
                        let mut focus = state.focus.lock().unwrap();
                        if focus.running {
                            focus.pause();
                        } else {
                            focus.start_focus(now_ms);
                        }
                        focus.runtime_state()
                    };
                    let _ = app.emit("pulsetrack:focus", &runtime);
                    refresh_tray_labels(app, &state);
                }
            }
            MENU_QUIT_ID => {
                if let Some(state) = app.try_state::<AppState>() {
                    state.quitting.store(true, Ordering::SeqCst);
                    let now_ms = Local::now().timestamp_millis();
                    let flushed = state.tracker.lock().unwrap().shutdown(now_ms);
                    if !flushed.is_empty() {
                        let db = state.db.lock().unwrap();
                        let _ = db.upsert_sessions(&flushed);
                    }
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let _tray = builder.build(app)?;
    Ok(())
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

pub fn refresh_tray_labels(app: &AppHandle, state: &AppState) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };

    let (paused, today_secs, today_score) = {
        let live = state.live.lock().unwrap();
        (live.paused, live.today_total_secs, live.today_score)
    };
    let (focus_running, focus_mins) = {
        let focus = state.focus.lock().unwrap();
        (focus.running, focus.config.focus_mins)
    };

    let dur_label = format_short_duration(today_secs);
    let summary_text = match today_score {
        Some(sc) => format!("Today: {dur_label}  •  Score {sc}"),
        None => format!("Today: {dur_label}"),
    };
    let pause_text = if paused {
        "Resume Tracking"
    } else {
        "Pause Tracking (Incognito)"
    };
    let focus_text = if focus_running {
        "Pause Focus Session".to_string()
    } else {
        format!("Start Focus ({focus_mins}m)")
    };

    let tooltip = if paused {
        format!("DestTraky — PAUSED ({dur_label})")
    } else {
        format!("DestTraky — {summary_text}")
    };
    let _ = tray.set_tooltip(Some(&tooltip));

    if let Ok(summary) = MenuItem::with_id(app, MENU_SUMMARY_ID, &summary_text, false, None::<&str>) {
        if let (Ok(sep1), Ok(pause), Ok(focus), Ok(sep2), Ok(open), Ok(quit)) = (
            PredefinedMenuItem::separator(app),
            MenuItem::with_id(app, MENU_PAUSE_ID, pause_text, true, None::<&str>),
            MenuItem::with_id(app, MENU_FOCUS_ID, &focus_text, true, None::<&str>),
            PredefinedMenuItem::separator(app),
            MenuItem::with_id(app, MENU_OPEN_ID, "Open Dashboard", true, None::<&str>),
            MenuItem::with_id(app, MENU_QUIT_ID, "Quit DestTraky", true, None::<&str>),
        ) {
            if let Ok(menu) = Menu::with_items(app, &[&summary, &sep1, &pause, &focus, &sep2, &open, &quit]) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    }
}

fn format_short_duration(secs: i64) -> String {
    let mins = secs.max(0) / 60;
    let h = mins / 60;
    let m = mins % 60;
    if h > 0 {
        format!("{h}h {m}m")
    } else {
        format!("{m}m")
    }
}
