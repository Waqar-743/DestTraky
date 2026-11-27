use chrono::{Duration, Local, NaiveDate};
use uuid::Uuid;

use crate::models::{
    AlertNotification, FocusConfig, FocusPhase, FocusRuntimeState, FocusSessionRecord,
    ProductivityKind,
};

#[derive(Debug, Clone)]
pub struct FocusEngine {
    pub config: FocusConfig,
    pub phase: FocusPhase,
    pub running: bool,
    pub remaining_secs: u32,
    pub total_secs: u32,
    pub session_start_ms: Option<i64>,
    pub completed_cycles_today: u32,
    pub current_streak_days: u32,
    pub distractions_in_session: u32,
    last_distraction_app: Option<String>,
    last_distraction_ms: i64,
}

impl FocusEngine {
    pub fn new(config: FocusConfig, completed_cycles_today: u32, current_streak_days: u32) -> Self {
        let total = config.focus_mins.max(1) * 60;
        Self {
            config,
            phase: FocusPhase::Idle,
            running: false,
            remaining_secs: total,
            total_secs: total,
            session_start_ms: None,
            completed_cycles_today,
            current_streak_days,
            distractions_in_session: 0,
            last_distraction_app: None,
            last_distraction_ms: 0,
        }
    }

    pub fn update_config(&mut self, config: FocusConfig) {
        self.config = config;
        if self.phase == FocusPhase::Idle {
            let total = self.config.focus_mins.max(1) * 60;
            self.total_secs = total;
            self.remaining_secs = total;
        }
    }

    pub fn start_focus(&mut self, now_ms: i64) {
        let total = self.config.focus_mins.max(1) * 60;
        self.phase = FocusPhase::Focus;
        self.total_secs = total;
        self.remaining_secs = total;
        self.running = true;
        self.session_start_ms = Some(now_ms);
        self.distractions_in_session = 0;
        self.last_distraction_app = None;
    }

    pub fn pause(&mut self) {
        self.running = false;
    }

    pub fn resume(&mut self, now_ms: i64) {
        if self.phase == FocusPhase::Idle {
            self.start_focus(now_ms);
        } else {
            self.running = true;
        }
    }

    pub fn reset(&mut self) {
        let total = self.config.focus_mins.max(1) * 60;
        self.phase = FocusPhase::Idle;
        self.running = false;
        self.total_secs = total;
        self.remaining_secs = total;
        self.session_start_ms = None;
        self.distractions_in_session = 0;
        self.last_distraction_app = None;
    }

    /// Advance timer by 1 second. Returns completed FocusSessionRecord & notification if phase completes.
    pub fn tick_1s(&mut self, now_ms: i64) -> (Option<FocusSessionRecord>, Option<AlertNotification>) {
        if !self.running || self.phase == FocusPhase::Idle {
            return (None, None);
        }

        if self.remaining_secs > 1 {
            self.remaining_secs -= 1;
            return (None, None);
        }

        // Phase finished!
        self.remaining_secs = 0;
        self.running = false;

        match self.phase {
            FocusPhase::Focus => {
                self.completed_cycles_today += 1;
                let record = FocusSessionRecord {
                    id: Uuid::new_v4().to_string(),
                    date: Local::now().format("%Y-%m-%d").to_string(),
                    start_ts: self.session_start_ms.unwrap_or(now_ms - (self.total_secs as i64) * 1000),
                    end_ts: now_ms,
                    planned_secs: self.total_secs as i64,
                    completed_secs: self.total_secs as i64,
                    completed: true,
                    distractions_count: self.distractions_in_session,
                };

                let is_long = self.config.cycles_before_long_break > 0
                    && self.completed_cycles_today % self.config.cycles_before_long_break == 0;
                if is_long {
                    self.phase = FocusPhase::LongBreak;
                    self.total_secs = self.config.long_break_mins.max(1) * 60;
                } else {
                    self.phase = FocusPhase::ShortBreak;
                    self.total_secs = self.config.short_break_mins.max(1) * 60;
                }
                self.remaining_secs = self.total_secs;
                self.session_start_ms = None;

                let alert = AlertNotification {
                    kind: "focus_complete".into(),
                    title: "Focus complete".into(),
                    body: format!("{}m completed. Break ready.", self.config.focus_mins),
                    target: "focus".into(),
                    timestamp_ms: now_ms,
                };
                (Some(record), Some(alert))
            }
            FocusPhase::ShortBreak | FocusPhase::LongBreak => {
                self.phase = FocusPhase::Idle;
                self.total_secs = self.config.focus_mins.max(1) * 60;
                self.remaining_secs = self.total_secs;
                let alert = AlertNotification {
                    kind: "break_complete".into(),
                    title: "Break complete".into(),
                    body: "Ready for next focus block.".into(),
                    target: "focus".into(),
                    timestamp_ms: now_ms,
                };
                (None, Some(alert))
            }
            FocusPhase::Idle => (None, None),
        }
    }

    /// Trigger a warning when the user switches to a distracting app during an active focus block.
    pub fn check_distraction(
        &mut self,
        app_name: &str,
        kind: ProductivityKind,
        now_ms: i64,
    ) -> Option<AlertNotification> {
        if !self.running || self.phase != FocusPhase::Focus || !self.config.warn_on_distraction {
            return None;
        }
        if kind != ProductivityKind::Distracting {
            self.last_distraction_app = None;
            return None;
        }

        let same_app = self
            .last_distraction_app
            .as_deref()
            .is_some_and(|a| a.eq_ignore_ascii_case(app_name));

        // Re-warn on new distracting app immediately, or every 45s if staying on it
        if !same_app || now_ms - self.last_distraction_ms >= 45_000 {
            self.distractions_in_session += 1;
            self.last_distraction_app = Some(app_name.to_string());
            self.last_distraction_ms = now_ms;
            return Some(AlertNotification {
                kind: "focus_distraction".into(),
                title: format!("Distraction: {app_name}"),
                body: "Focus timer is active.".into(),
                target: app_name.to_string(),
                timestamp_ms: now_ms,
            });
        }
        None
    }

    pub fn runtime_state(&self) -> FocusRuntimeState {
        FocusRuntimeState {
            phase: self.phase,
            running: self.running,
            remaining_secs: self.remaining_secs,
            total_secs: self.total_secs,
            completed_cycles_today: self.completed_cycles_today,
            current_streak_days: self.current_streak_days,
            distractions_in_session: self.distractions_in_session,
            config: self.config.clone(),
        }
    }
}

/// Compute consecutive calendar days with >= 1 completed focus session ending today or yesterday.
pub fn compute_focus_streak(completed_dates: &[String], today: NaiveDate) -> u32 {
    let mut unique: std::collections::HashSet<NaiveDate> = completed_dates
        .iter()
        .filter_map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .collect();

    if unique.is_empty() {
        return 0;
    }

    let mut cursor = if unique.contains(&today) {
        today
    } else if unique.contains(&(today - Duration::days(1))) {
        today - Duration::days(1)
    } else {
        return 0;
    };

    let mut streak = 0u32;
    while unique.remove(&cursor) {
        streak += 1;
        cursor -= Duration::days(1);
    }
    streak
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn focus_streak_counts_consecutive_days_and_breaks_on_gap() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 26).unwrap();
        let dates = vec![
            "2026-11-26".to_string(),
            "2026-11-25".to_string(),
            "2026-11-24".to_string(),
            "2026-11-22".to_string(), // gap on Nov 23
        ];
        assert_eq!(compute_focus_streak(&dates, today), 3);
    }

    #[test]
    fn focus_engine_warns_on_distracting_app_during_active_focus() {
        let mut engine = FocusEngine::new(FocusConfig::default(), 0, 0);
        engine.start_focus(1000);

        // Productive app -> no alert
        assert!(engine.check_distraction("VS Code", ProductivityKind::Productive, 2000).is_none());

        // Distracting app -> alert fires immediately
        let alert = engine.check_distraction("YouTube", ProductivityKind::Distracting, 3000);
        assert!(alert.is_some());
        assert_eq!(engine.distractions_in_session, 1);

        // Immediate repeat on same app within 45s -> suppressed
        assert!(engine.check_distraction("YouTube", ProductivityKind::Distracting, 5000).is_none());
    }
}

