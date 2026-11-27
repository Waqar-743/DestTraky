use std::collections::HashMap;

use chrono::{DateTime, Duration, Local, NaiveDate, TimeZone, Timelike};

use crate::models::{
    ActivitySession, AppUsageItem, Category, CategoryBreakdownItem, DashboardSummary,
    PeriodComparison, ProductivityKind, TimeBucket,
};

/// Calculate weighted Productivity / Focus Score on a 0..=100 scale.
/// Returns None when total active time is 0 (empty day / empty range).
pub fn calculate_productivity_score(
    sessions: &[ActivitySession],
    categories: &[Category],
) -> Option<u32> {
    let cat_map: HashMap<&str, &Category> = categories.iter().map(|c| (c.id.as_str(), c)).collect();

    let mut total_secs: f64 = 0.0;
    let mut weighted_secs: f64 = 0.0;

    for session in sessions {
        if session.duration_secs <= 0 {
            continue;
        }
        let dur = session.duration_secs as f64;
        let weight = cat_map
            .get(session.category_id.as_str())
            .map(|c| c.weight)
            .unwrap_or(ProductivityKind::Neutral.weight());
        total_secs += dur;
        weighted_secs += dur * weight;
    }

    if total_secs <= 0.0 {
        return None;
    }

    let raw = (weighted_secs / total_secs) * 100.0;
    Some(raw.round().clamp(0.0, 100.0) as u32)
}

/// Count context switches between distinct applications and normalize per active hour.
/// Consecutive segments of the same app (e.g., tab or title changes inside one app) do NOT count.
/// Ultra-short accidental alt-tab flickers shorter than `debounce_secs` are ignored.
pub fn calculate_context_switches(
    sessions: &[ActivitySession],
    debounce_secs: i64,
) -> (usize, f64) {
    if sessions.is_empty() {
        return (0, 0.0);
    }

    let mut ordered: Vec<&ActivitySession> = sessions
        .iter()
        .filter(|s| s.duration_secs > 0)
        .collect();
    ordered.sort_by_key(|s| s.start_ts);

    let total_secs: i64 = ordered.iter().map(|s| s.duration_secs).sum();
    if total_secs <= 0 {
        return (0, 0.0);
    }

    let mut switches = 0usize;
    let mut last_app: Option<String> = None;

    for s in ordered {
        if s.duration_secs < debounce_secs.max(0) {
            continue;
        }
        let app_key = s.app_name.to_ascii_lowercase();
        if let Some(prev) = &last_app {
            if prev != &app_key {
                switches += 1;
            }
        }
        last_app = Some(app_key);
    }

    let active_hours = total_secs as f64 / 3600.0;
    let per_hour = if active_hours > 0.0 {
        ((switches as f64 / active_hours) * 10.0).round() / 10.0
    } else {
        0.0
    };

    (switches, per_hour)
}

/// Given inclusive YYYY-MM-DD start and end dates, compute the immediately preceding equal-length range.
pub fn compute_previous_range(start_date: &str, end_date: &str) -> Result<(String, String), String> {
    let start = NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date: {e}"))?;
    let end = NaiveDate::parse_from_str(end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date: {e}"))?;

    if end < start {
        return Err("end_date must be >= start_date".to_string());
    }

    let span_days = (end - start).num_days() + 1;
    let prev_end = start - Duration::days(1);
    let prev_start = prev_end - Duration::days(span_days - 1);

    Ok((
        prev_start.format("%Y-%m-%d").to_string(),
        prev_end.format("%Y-%m-%d").to_string(),
    ))
}

pub fn compare_period(current: f64, previous: f64) -> PeriodComparison {
    let delta_pct = if previous > 0.0 {
        let pct = ((current - previous) / previous) * 100.0;
        Some((pct * 10.0).round() / 10.0)
    } else if current > 0.0 {
        Some(100.0)
    } else {
        None
    };

    PeriodComparison {
        current,
        previous,
        delta_pct,
    }
}

pub fn build_dashboard_summary(
    start_date: &str,
    end_date: &str,
    prev_start_date: &str,
    prev_end_date: &str,
    current_sessions: &[ActivitySession],
    previous_sessions: &[ActivitySession],
    categories: &[Category],
    debounce_secs: i64,
    icon_lookup: &HashMap<String, String>,
) -> DashboardSummary {
    let cat_map: HashMap<&str, &Category> = categories.iter().map(|c| (c.id.as_str(), c)).collect();

    let total_active_secs: i64 = current_sessions.iter().map(|s| s.duration_secs.max(0)).sum();
    let prev_total_secs: i64 = previous_sessions.iter().map(|s| s.duration_secs.max(0)).sum();

    let mut productive_secs: i64 = 0;
    let mut neutral_secs: i64 = 0;
    let mut distracting_secs: i64 = 0;
    let mut by_cat_secs: HashMap<String, i64> = HashMap::new();

    for s in current_sessions {
        let dur = s.duration_secs.max(0);
        *by_cat_secs.entry(s.category_id.clone()).or_insert(0) += dur;
        let kind = cat_map
            .get(s.category_id.as_str())
            .map(|c| c.kind)
            .unwrap_or(ProductivityKind::Neutral);
        match kind {
            ProductivityKind::Productive => productive_secs += dur,
            ProductivityKind::Neutral => neutral_secs += dur,
            ProductivityKind::Distracting => distracting_secs += dur,
        }
    }

    let mut prev_productive_secs: i64 = 0;
    for s in previous_sessions {
        let kind = cat_map
            .get(s.category_id.as_str())
            .map(|c| c.kind)
            .unwrap_or(ProductivityKind::Neutral);
        if kind == ProductivityKind::Productive {
            prev_productive_secs += s.duration_secs.max(0);
        }
    }

    let productivity_score = calculate_productivity_score(current_sessions, categories);
    let prev_score = calculate_productivity_score(previous_sessions, categories);

    let (total_context_switches, context_switches_per_hour) =
        calculate_context_switches(current_sessions, debounce_secs);
    let (_, prev_switches_per_hour) = calculate_context_switches(previous_sessions, debounce_secs);

    // Category breakdown
    let mut cat_breakdown: Vec<CategoryBreakdownItem> = categories
        .iter()
        .map(|cat| {
            let secs = *by_cat_secs.get(&cat.id).unwrap_or(&0);
            let share_pct = if total_active_secs > 0 {
                ((secs as f64 / total_active_secs as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            };
            CategoryBreakdownItem {
                category_id: cat.id.clone(),
                name: cat.name.clone(),
                color: cat.color.clone(),
                kind: cat.kind,
                total_secs: secs,
                share_pct,
            }
        })
        .filter(|item| item.total_secs > 0 || matches!(item.category_id.as_str(), "productive" | "neutral" | "distracting"))
        .collect();
    cat_breakdown.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

    // Top apps aggregation
    struct AppAgg {
        app_name: String,
        process_name: String,
        total_secs: i64,
        sessions_count: usize,
        cat_secs: HashMap<String, i64>,
        ctx_secs: HashMap<String, i64>,
        icon_key: Option<String>,
    }

    let mut app_map: HashMap<String, AppAgg> = HashMap::new();
    for s in current_sessions {
        let key = s.app_name.to_ascii_lowercase();
        let entry = app_map.entry(key).or_insert_with(|| AppAgg {
            app_name: s.app_name.clone(),
            process_name: s.process_name.clone(),
            total_secs: 0,
            sessions_count: 0,
            cat_secs: HashMap::new(),
            ctx_secs: HashMap::new(),
            icon_key: s.icon_key.clone(),
        });
        let dur = s.duration_secs.max(0);
        entry.total_secs += dur;
        entry.sessions_count += 1;
        *entry.cat_secs.entry(s.category_id.clone()).or_insert(0) += dur;
        if let Some(ctx) = &s.domain_context {
            *entry.ctx_secs.entry(ctx.clone()).or_insert(0) += dur;
        }
        if entry.icon_key.is_none() {
            entry.icon_key = s.icon_key.clone();
        }
    }

    let mut top_apps: Vec<AppUsageItem> = app_map
        .into_values()
        .map(|agg| {
            let dominant_cat_id = agg
                .cat_secs
                .into_iter()
                .max_by_key(|(_, secs)| *secs)
                .map(|(id, _)| id)
                .unwrap_or_else(|| "neutral".to_string());
            let (cat_name, cat_color) = cat_map
                .get(dominant_cat_id.as_str())
                .map(|c| (c.name.clone(), c.color.clone()))
                .unwrap_or_else(|| ("Neutral".to_string(), "#8A8478".to_string()));
            let top_context = agg
                .ctx_secs
                .into_iter()
                .max_by_key(|(_, secs)| *secs)
                .map(|(ctx, _)| ctx);
            let share_pct = if total_active_secs > 0 {
                ((agg.total_secs as f64 / total_active_secs as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            };
            let icon_data_url = agg
                .icon_key
                .as_ref()
                .and_then(|k| icon_lookup.get(k))
                .cloned();

            AppUsageItem {
                app_name: agg.app_name,
                process_name: agg.process_name,
                category_id: dominant_cat_id,
                category_name: cat_name,
                category_color: cat_color,
                total_secs: agg.total_secs,
                share_pct,
                sessions_count: agg.sessions_count,
                top_context,
                icon_data_url,
            }
        })
        .collect();
    top_apps.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

    // Buckets: hourly when single day, daily when multi-day
    let hourly_mode = start_date == end_date;
    let buckets = if hourly_mode {
        build_hourly_buckets(current_sessions, categories)
    } else {
        build_daily_buckets(start_date, end_date, current_sessions, categories)
    };

    DashboardSummary {
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        prev_start_date: prev_start_date.to_string(),
        prev_end_date: prev_end_date.to_string(),
        total_active_secs,
        productive_secs,
        neutral_secs,
        distracting_secs,
        productivity_score,
        context_switches_per_hour,
        total_context_switches,
        active_comparison: compare_period(total_active_secs as f64, prev_total_secs as f64),
        productive_comparison: compare_period(productive_secs as f64, prev_productive_secs as f64),
        score_comparison: compare_period(
            productivity_score.unwrap_or(0) as f64,
            prev_score.unwrap_or(0) as f64,
        ),
        switches_comparison: compare_period(context_switches_per_hour, prev_switches_per_hour),
        categories: cat_breakdown,
        top_apps,
        buckets,
        hourly_mode,
    }
}

fn build_hourly_buckets(sessions: &[ActivitySession], categories: &[Category]) -> Vec<TimeBucket> {
    let mut per_hour_sessions: Vec<Vec<ActivitySession>> = vec![Vec::new(); 24];
    let mut per_hour_cats: Vec<HashMap<String, i64>> = vec![HashMap::new(); 24];
    let mut per_hour_total: Vec<i64> = vec![0; 24];

    for s in sessions {
        if s.duration_secs <= 0 {
            continue;
        }
        let hour = DateTime::from_timestamp_millis(s.start_ts)
            .map(|dt| dt.with_timezone(&Local).hour() as usize)
            .unwrap_or(0)
            .min(23);
        per_hour_total[hour] += s.duration_secs;
        *per_hour_cats[hour].entry(s.category_id.clone()).or_insert(0) += s.duration_secs;
        per_hour_sessions[hour].push(s.clone());
    }

    (0..24)
        .map(|h| {
            let score = calculate_productivity_score(&per_hour_sessions[h], categories);
            TimeBucket {
                key: format!("{h:02}"),
                label: format!("{h:02}:00"),
                total_secs: per_hour_total[h],
                score,
                by_category: per_hour_cats[h].clone(),
            }
        })
        .collect()
}

fn build_daily_buckets(
    start_date: &str,
    end_date: &str,
    sessions: &[ActivitySession],
    categories: &[Category],
) -> Vec<TimeBucket> {
    let start = NaiveDate::parse_from_str(start_date, "%Y-%m-%d").unwrap_or_else(|_| Local::now().date_naive());
    let end = NaiveDate::parse_from_str(end_date, "%Y-%m-%d").unwrap_or(start);

    let mut by_day: HashMap<String, Vec<ActivitySession>> = HashMap::new();
    for s in sessions {
        by_day.entry(s.date.clone()).or_default().push(s.clone());
    }

    let mut buckets = Vec::new();
    let mut cursor = start;
    while cursor <= end {
        let key = cursor.format("%Y-%m-%d").to_string();
        let label = cursor.format("%b %d").to_string();
        let day_sessions = by_day.get(&key).map(Vec::as_slice).unwrap_or(&[]);
        let mut by_category: HashMap<String, i64> = HashMap::new();
        let mut total_secs: i64 = 0;
        for s in day_sessions {
            let dur = s.duration_secs.max(0);
            total_secs += dur;
            *by_category.entry(s.category_id.clone()).or_insert(0) += dur;
        }
        let score = calculate_productivity_score(day_sessions, categories);

        buckets.push(TimeBucket {
            key,
            label,
            total_secs,
            score,
            by_category,
        });
        cursor += Duration::days(1);
    }

    buckets
}

/// Helper to build a UTC epoch ms from local NaiveDate + hour/min/sec (useful for tests & queries)
pub fn local_ymd_hms_to_ms(date: NaiveDate, h: u32, m: u32, s: u32) -> i64 {
    let ndt = date.and_hms_opt(h, m, s).unwrap();
    Local
        .from_local_datetime(&ndt)
        .earliest()
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CATEGORY_DISTRACTING_ID, CATEGORY_NEUTRAL_ID, CATEGORY_PRODUCTIVE_ID};

    fn default_cats() -> Vec<Category> {
        vec![
            Category {
                id: CATEGORY_PRODUCTIVE_ID.into(),
                name: "Productive".into(),
                color: "#D98A1C".into(),
                kind: ProductivityKind::Productive,
                weight: 1.0,
                is_system: true,
            },
            Category {
                id: CATEGORY_NEUTRAL_ID.into(),
                name: "Neutral".into(),
                color: "#8A8478".into(),
                kind: ProductivityKind::Neutral,
                weight: 0.5,
                is_system: true,
            },
            Category {
                id: CATEGORY_DISTRACTING_ID.into(),
                name: "Distracting".into(),
                color: "#C84630".into(),
                kind: ProductivityKind::Distracting,
                weight: 0.0,
                is_system: true,
            },
        ]
    }

    fn mk_session(app: &str, cat: &str, start_ts: i64, duration_secs: i64) -> ActivitySession {
        ActivitySession {
            id: uuid::Uuid::new_v4().to_string(),
            date: "2026-11-26".into(),
            app_name: app.into(),
            process_name: format!("{app}.exe"),
            window_title: "Window".into(),
            domain_context: None,
            category_id: cat.into(),
            start_ts,
            end_ts: start_ts + duration_secs * 1000,
            duration_secs,
            icon_key: None,
            tags: Vec::new(),
            is_manual: false,
        }
    }

    #[test]
    fn productivity_score_empty_day_returns_none() {
        assert_eq!(calculate_productivity_score(&[], &default_cats()), None);
    }

    #[test]
    fn productivity_score_weighted_calculation() {
        let cats = default_cats();
        let sessions = vec![
            mk_session("VS Code", CATEGORY_PRODUCTIVE_ID, 0, 1800),   // 1800 * 1.0 = 1800
            mk_session("Explorer", CATEGORY_NEUTRAL_ID, 1_800_000, 1200), // 1200 * 0.5 = 600
            mk_session("YouTube", CATEGORY_DISTRACTING_ID, 3_000_000, 600), // 600 * 0.0 = 0
        ];
        // (1800 + 600) / 3600 * 100 = 66.666 -> 67
        assert_eq!(calculate_productivity_score(&sessions, &cats), Some(67));
    }

    #[test]
    fn context_switches_per_hour_respects_debounce_and_distinct_apps() {
        let sessions = vec![
            mk_session("VS Code", CATEGORY_PRODUCTIVE_ID, 0, 1000),
            mk_session("VS Code", CATEGORY_PRODUCTIVE_ID, 1_000_000, 800), // same app -> no switch
            mk_session("Chrome", CATEGORY_NEUTRAL_ID, 1_800_000, 1),        // 1s flicker < 2s debounce -> ignored
            mk_session("Terminal", CATEGORY_PRODUCTIVE_ID, 1_801_000, 900), // switch #1
            mk_session("Slack", CATEGORY_NEUTRAL_ID, 2_701_000, 900),       // switch #2
        ];
        // Total active = 3601s (~1h), switches = 2 -> ~2.0/hr
        let (count, per_hr) = calculate_context_switches(&sessions, 2);
        assert_eq!(count, 2);
        assert!((per_hr - 2.0).abs() < 0.05);
    }

    #[test]
    fn previous_range_calculation_is_exact() {
        assert_eq!(
            compute_previous_range("2026-11-26", "2026-11-26").unwrap(),
            ("2026-11-25".to_string(), "2026-11-25".to_string())
        );
        assert_eq!(
            compute_previous_range("2026-11-20", "2026-11-26").unwrap(),
            ("2026-11-13".to_string(), "2026-11-19".to_string())
        );
    }
}
