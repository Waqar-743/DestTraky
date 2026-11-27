use std::collections::{HashMap, HashSet};

use crate::models::{
    ActivitySession, AlertNotification, Category, DailyLimit, DailyLimitStatus, LimitTargetType,
};

pub fn evaluate_daily_limits(
    limits: &[DailyLimit],
    today_sessions: &[ActivitySession],
    categories: &[Category],
) -> Vec<DailyLimitStatus> {
    let cat_map: HashMap<&str, &Category> = categories.iter().map(|c| (c.id.as_str(), c)).collect();

    let mut app_secs: HashMap<String, i64> = HashMap::new();
    let mut cat_secs: HashMap<String, i64> = HashMap::new();

    for s in today_sessions {
        let dur = s.duration_secs.max(0);
        *app_secs.entry(s.app_name.to_ascii_lowercase()).or_insert(0) += dur;
        *cat_secs.entry(s.category_id.clone()).or_insert(0) += dur;
    }

    limits
        .iter()
        .map(|limit| {
            let limit_secs = (limit.daily_limit_mins.max(1)) * 60;
            let (used_secs, label, color) = match limit.target_type {
                LimitTargetType::App => {
                    let key = limit.target_value.to_ascii_lowercase();
                    let used = *app_secs.get(&key).unwrap_or(&0);
                    (used, limit.target_value.clone(), "#C84630".to_string())
                }
                LimitTargetType::Category => {
                    let used = *cat_secs.get(&limit.target_value).unwrap_or(&0);
                    let (name, color) = cat_map
                        .get(limit.target_value.as_str())
                        .map(|c| (c.name.clone(), c.color.clone()))
                        .unwrap_or_else(|| (limit.target_value.clone(), "#8A8478".to_string()));
                    (used, name, color)
                }
            };

            let remaining_secs = (limit_secs - used_secs).max(0);
            let percent = ((used_secs as f64 / limit_secs as f64) * 1000.0).round() / 10.0;
            let exceeded = limit.enabled && used_secs >= limit_secs;
            let warning_80 = limit.enabled && limit.notify_at_80 && percent >= 80.0 && !exceeded;

            DailyLimitStatus {
                limit: limit.clone(),
                label,
                color,
                used_secs,
                limit_secs,
                remaining_secs,
                percent,
                exceeded,
                warning_80,
            }
        })
        .collect()
}

/// Tracks which daily limit alerts have already fired for the current local date so users aren't spammed every second.
#[derive(Debug, Default)]
pub struct LimitAlertTracker {
    current_date: String,
    fired_keys: HashSet<String>,
}

impl LimitAlertTracker {
    pub fn check_alerts(
        &mut self,
        today_date: &str,
        now_ms: i64,
        statuses: &[DailyLimitStatus],
    ) -> Vec<AlertNotification> {
        if self.current_date != today_date {
            self.current_date = today_date.to_string();
            self.fired_keys.clear();
        }

        let mut alerts = Vec::new();
        for st in statuses {
            if !st.limit.enabled {
                continue;
            }
            if st.exceeded {
                let key = format!("{}:100", st.limit.id);
                if self.fired_keys.insert(key) {
                    alerts.push(AlertNotification {
                        kind: "limit_reached".into(),
                        title: format!("Limit reached: {}", st.label),
                        body: format!("Daily budget of {}m exceeded.", st.limit.daily_limit_mins),
                        target: st.label.clone(),
                        timestamp_ms: now_ms,
                    });
                }
            } else if st.warning_80 {
                let key = format!("{}:80", st.limit.id);
                if self.fired_keys.insert(key) {
                    alerts.push(AlertNotification {
                        kind: "limit_warning".into(),
                        title: format!("80% budget used: {}", st.label),
                        body: format!(
                            "{}m left of {}m daily limit.",
                            (st.remaining_secs + 59) / 60,
                            st.limit.daily_limit_mins
                        ),
                        target: st.label.clone(),
                        timestamp_ms: now_ms,
                    });
                }
            }
        }
        alerts
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ProductivityKind, CATEGORY_DISTRACTING_ID};

    #[test]
    fn daily_limit_triggers_once_per_day_when_exceeded() {
        let limits = vec![DailyLimit {
            id: "lim-1".into(),
            target_type: LimitTargetType::Category,
            target_value: CATEGORY_DISTRACTING_ID.into(),
            daily_limit_mins: 30,
            enabled: true,
            notify_at_80: true,
        }];
        let cats = vec![Category {
            id: CATEGORY_DISTRACTING_ID.into(),
            name: "Distracting".into(),
            color: "#C84630".into(),
            kind: ProductivityKind::Distracting,
            weight: 0.0,
            is_system: true,
        }];
        let sessions = vec![ActivitySession {
            id: "s1".into(),
            date: "2026-11-26".into(),
            app_name: "YouTube".into(),
            process_name: "chrome.exe".into(),
            window_title: "Video - YouTube".into(),
            domain_context: Some("YouTube".into()),
            category_id: CATEGORY_DISTRACTING_ID.into(),
            start_ts: 0,
            end_ts: 1_900_000,
            duration_secs: 1900, // 31.6m > 30m limit
            icon_key: None,
            tags: Vec::new(),
            is_manual: false,
        }];

        let statuses = evaluate_daily_limits(&limits, &sessions, &cats);
        assert!(statuses[0].exceeded);
        assert_eq!(statuses[0].remaining_secs, 0);

        let mut tracker = LimitAlertTracker::default();
        let first = tracker.check_alerts("2026-11-26", 10_000, &statuses);
        assert_eq!(first.len(), 1);
        assert_eq!(first[0].kind, "limit_reached");

        // Second check same day -> deduplicated
        let second = tracker.check_alerts("2026-11-26", 15_000, &statuses);
        assert!(second.is_empty());
    }
}

