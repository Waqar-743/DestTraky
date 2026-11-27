use chrono::{DateTime, Duration, Local, NaiveTime, TimeZone};
use uuid::Uuid;

use crate::browser::parse_browser_context;
use crate::models::{ActivitySession, AppSettings, CategoryRule, IgnoreRule};
use crate::rules::{derive_schedule_tag, is_ignored, match_rule_detailed};

/// Snapshot captured from the OS foreground window + input state on each ~1s tick.
#[derive(Debug, Clone)]
pub struct WindowSample {
    pub app_name: String,
    pub process_name: String,
    pub window_title: String,
    pub is_fullscreen: bool,
    pub idle_secs: u64,
    pub icon_key: Option<String>,
}

/// Active session buffered purely in memory to avoid constant 1s SQLite writes.
#[derive(Debug, Clone)]
pub struct ActiveBuffer {
    pub id: String,
    pub app_name: String,
    pub process_name: String,
    pub window_title: String,
    pub domain_context: Option<String>,
    pub category_id: String,
    pub start_ts: i64,
    pub last_active_ts: i64,
    pub last_checkpoint_ts: i64,
    pub icon_key: Option<String>,
    pub tags: Vec<String>,
}

/// Actions produced by `ActivityTracker::tick` for the caller to persist to SQLite.
#[derive(Debug, Clone, Default)]
pub struct TrackerOutput {
    /// Finalized sessions to upsert into SQLite (already split across midnight boundaries)
    pub flushed: Vec<ActivitySession>,
    /// Periodic in-progress checkpoint sessions to upsert safely (same ID, updated end_ts/duration)
    pub checkpoint: Vec<ActivitySession>,
    pub is_idle: bool,
    pub is_fullscreen_suppressed: bool,
    pub active_app: Option<String>,
    pub active_title: Option<String>,
    pub active_context: Option<String>,
    pub active_category_id: Option<String>,
    pub active_duration_secs: i64,
    pub sleep_gap_detected: bool,
}

pub struct ActivityTracker {
    pub paused: bool,
    pub is_idle: bool,
    pub last_tick_ms: Option<i64>,
    pub current: Option<ActiveBuffer>,
}

impl Default for ActivityTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl ActivityTracker {
    pub fn new() -> Self {
        Self {
            paused: false,
            is_idle: false,
            last_tick_ms: None,
            current: None,
        }
    }

    pub fn set_paused(&mut self, paused: bool, now_ms: i64) -> Vec<ActivitySession> {
        if self.paused == paused {
            return Vec::new();
        }
        self.paused = paused;
        if paused {
            self.is_idle = false;
            self.flush_current_at(now_ms, &Local)
        } else {
            self.last_tick_ms = Some(now_ms);
            Vec::new()
        }
    }

    /// Graceful shutdown flush so in-memory active time is never lost.
    pub fn shutdown(&mut self, now_ms: i64) -> Vec<ActivitySession> {
        self.flush_current_at(now_ms, &Local)
    }

    pub fn tick(
        &mut self,
        now_ms: i64,
        sample: Option<WindowSample>,
        settings: &AppSettings,
        rules: &[CategoryRule],
        ignore_rules: &[IgnoreRule],
    ) -> TrackerOutput {
        self.tick_with_tz(now_ms, sample, settings, rules, ignore_rules, &Local)
    }

    pub fn tick_with_tz<Tz: TimeZone>(
        &mut self,
        now_ms: i64,
        sample: Option<WindowSample>,
        settings: &AppSettings,
        rules: &[CategoryRule],
        ignore_rules: &[IgnoreRule],
        tz: &Tz,
    ) -> TrackerOutput {
        let mut out = TrackerOutput::default();

        if self.paused {
            self.last_tick_ms = Some(now_ms);
            return out;
        }

        // 1. Sleep / hibernation gap detection
        if let Some(prev_ms) = self.last_tick_ms {
            let delta_ms = now_ms - prev_ms;
            let sleep_limit_ms = (settings.sleep_gap_threshold_secs.max(5) as i64) * 1000;
            if delta_ms > sleep_limit_ms {
                // Close pre-sleep session strictly at prev_ms so sleep duration is never counted.
                out.flushed.extend(self.flush_current_at(prev_ms, tz));
                out.sleep_gap_detected = true;
                self.is_idle = false;
            }
        }
        self.last_tick_ms = Some(now_ms);

        let Some(sample) = sample else {
            out.flushed.extend(self.flush_current_at(now_ms, tz));
            return out;
        };

        // 2. Idle detection with optional fullscreen suppression & inactive tail trimming
        let fullscreen_suppressed = settings.suppress_idle_fullscreen && sample.is_fullscreen;
        out.is_fullscreen_suppressed = fullscreen_suppressed;

        let exceeded_idle = !fullscreen_suppressed
            && settings.idle_threshold_secs > 0
            && sample.idle_secs >= settings.idle_threshold_secs;

        if exceeded_idle {
            if !self.is_idle {
                // Transition active -> idle: trim the inactive tail!
                let idle_ms = (sample.idle_secs as i64) * 1000;
                let trimmed_end_ms = (now_ms - idle_ms).max(0);
                out.flushed.extend(self.flush_current_at(trimmed_end_ms, tz));
                self.is_idle = true;
            }
            out.is_idle = true;
            return out;
        } else if self.is_idle {
            // User returned from idle
            self.is_idle = false;
        }

        // 3. Ignore list enforcement (never buffer or persist blacklisted apps/titles)
        if is_ignored(
            &sample.app_name,
            &sample.process_name,
            &sample.window_title,
            ignore_rules,
        ) {
            out.flushed.extend(self.flush_current_at(now_ms, tz));
            return out;
        }

        let (category_id, _, mut rule_tags) = match_rule_detailed(
            &sample.app_name,
            &sample.process_name,
            &sample.window_title,
            rules,
        );
        let sched = derive_schedule_tag(now_ms);
        if !rule_tags.iter().any(|t| t == &sched) {
            rule_tags.push(sched);
        }
        let domain_context =
            parse_browser_context(&sample.process_name, &sample.app_name, &sample.window_title);

        // 4. App / Window-title / Category transition check
        let same_as_current = self.current.as_ref().is_some_and(|buf| {
            buf.app_name == sample.app_name
                && buf.process_name == sample.process_name
                && buf.window_title == sample.window_title
                && buf.category_id == category_id
        });

        if same_as_current {
            if let Some(buf) = self.current.as_mut() {
                buf.last_active_ts = now_ms;
                if buf.icon_key.is_none() && sample.icon_key.is_some() {
                    buf.icon_key = sample.icon_key.clone();
                }

                // Check if midnight crossed while in the same window -> flush prior day immediately
                let start_date = ms_to_date_str(buf.start_ts, tz);
                let now_date = ms_to_date_str(now_ms, tz);
                if start_date != now_date {
                    let split = split_session_by_midnight_with_tz(buf, now_ms, tz);
                    if let Some((last, prior)) = split.split_last() {
                        out.flushed.extend_from_slice(prior);
                        buf.id = last.id.clone();
                        buf.start_ts = last.start_ts;
                        buf.last_active_ts = now_ms;
                        buf.last_checkpoint_ts = now_ms;
                        if last.duration_secs > 0 {
                            out.checkpoint.push(last.clone());
                        }
                    }
                } else {
                    // Periodic safety checkpoint
                    let checkpoint_ms = (settings.checkpoint_interval_secs.max(10) as i64) * 1000;
                    if now_ms - buf.last_checkpoint_ts >= checkpoint_ms {
                        buf.last_checkpoint_ts = now_ms;
                        let snap = split_session_by_midnight_with_tz(buf, now_ms, tz);
                        out.checkpoint.extend(snap);
                    }
                }
            }
        } else {
            // Transition -> flush previous buffer and start a new in-memory buffer
            out.flushed.extend(self.flush_current_at(now_ms, tz));
            self.current = Some(ActiveBuffer {
                id: Uuid::new_v4().to_string(),
                app_name: sample.app_name,
                process_name: sample.process_name,
                window_title: sample.window_title,
                domain_context,
                category_id,
                start_ts: now_ms,
                last_active_ts: now_ms,
                last_checkpoint_ts: now_ms,
                icon_key: sample.icon_key,
                tags: rule_tags,
            });
        }

        if let Some(buf) = &self.current {
            out.active_app = Some(buf.app_name.clone());
            out.active_title = Some(buf.window_title.clone());
            out.active_context = buf.domain_context.clone();
            out.active_category_id = Some(buf.category_id.clone());
            out.active_duration_secs = ((now_ms - buf.start_ts) / 1000).max(0);
        }

        out
    }

    /// Non-destructive snapshot of the currently running in-memory session up to `now_ms`.
    /// Used to overlay live second-by-second timings onto stored SQLite sessions without double-counting.
    pub fn active_snapshot(&self, now_ms: i64) -> Vec<ActivitySession> {
        self.active_snapshot_with_tz(now_ms, &Local)
    }

    pub fn active_snapshot_with_tz<Tz: TimeZone>(&self, now_ms: i64, tz: &Tz) -> Vec<ActivitySession> {
        if self.paused || self.is_idle {
            return Vec::new();
        }
        let Some(buf) = &self.current else {
            return Vec::new();
        };
        let effective_end = now_ms.max(buf.last_active_ts);
        if effective_end <= buf.start_ts {
            return Vec::new();
        }
        split_session_by_midnight_with_tz(buf, effective_end, tz)
    }

    fn flush_current_at<Tz: TimeZone>(&mut self, end_ms: i64, tz: &Tz) -> Vec<ActivitySession> {
        let Some(buf) = self.current.take() else {
            return Vec::new();
        };
        if end_ms <= buf.start_ts {
            return Vec::new();
        }
        split_session_by_midnight_with_tz(&buf, end_ms, tz)
    }
}

/// Overlay in-memory live session segments onto stored SQLite sessions for `[start_date, end_date]`.
/// If a checkpointed row with the same session `id` already exists in `stored`, it is replaced in-place
/// with the fresher live segment so long sessions (e.g. 32+ min in Chrome) are never double-counted.
pub fn merge_live_sessions(
    stored: &[ActivitySession],
    live_segments: &[ActivitySession],
    start_date: &str,
    end_date: &str,
) -> Vec<ActivitySession> {
    let mut merged = stored.to_vec();
    for seg in live_segments {
        if seg.date.as_str() < start_date || seg.date.as_str() > end_date || seg.duration_secs <= 0 {
            continue;
        }
        if let Some(existing) = merged.iter_mut().find(|s| s.id == seg.id) {
            *existing = seg.clone();
        } else {
            merged.push(seg.clone());
        }
    }
    merged.sort_by_key(|s| s.start_ts);
    merged
}

/// Split an activity session across every local midnight boundary so daily records remain exact.
pub fn split_session_by_midnight(buf: &ActiveBuffer, end_ms: i64) -> Vec<ActivitySession> {
    split_session_by_midnight_with_tz(buf, end_ms, &Local)
}

pub fn split_session_by_midnight_with_tz<Tz: TimeZone>(
    buf: &ActiveBuffer,
    end_ms: i64,
    tz: &Tz,
) -> Vec<ActivitySession> {
    if end_ms <= buf.start_ts {
        return Vec::new();
    }

    let mut segments = Vec::new();
    let mut cursor_ms = buf.start_ts;
    let mut is_first = true;

    while cursor_ms < end_ms {
        let cursor_dt = match DateTime::from_timestamp_millis(cursor_ms) {
            Some(dt) => dt.with_timezone(tz),
            None => break,
        };
        let cur_date = cursor_dt.date_naive();
        let next_date = cur_date + Duration::days(1);
        let next_midnight_naive = next_date.and_time(NaiveTime::MIN);

        let next_midnight_ms = tz
            .from_local_datetime(&next_midnight_naive)
            .earliest()
            .map(|dt| dt.timestamp_millis())
            .unwrap_or(end_ms);

        let seg_end_ms = end_ms.min(next_midnight_ms);
        let duration_secs = ((seg_end_ms - cursor_ms) as f64 / 1000.0).round() as i64;

        if duration_secs > 0 {
            segments.push(ActivitySession {
                id: if is_first {
                    buf.id.clone()
                } else {
                    Uuid::new_v4().to_string()
                },
                date: cur_date.format("%Y-%m-%d").to_string(),
                app_name: buf.app_name.clone(),
                process_name: buf.process_name.clone(),
                window_title: buf.window_title.clone(),
                domain_context: buf.domain_context.clone(),
                category_id: buf.category_id.clone(),
                start_ts: cursor_ms,
                end_ts: seg_end_ms,
                duration_secs,
                icon_key: buf.icon_key.clone(),
                tags: buf.tags.clone(),
                is_manual: false,
            });
            is_first = false;
        }

        if seg_end_ms <= cursor_ms {
            break;
        }
        cursor_ms = seg_end_ms;
    }

    segments
}

fn ms_to_date_str<Tz: TimeZone>(ts_ms: i64, tz: &Tz) -> String {
    DateTime::from_timestamp_millis(ts_ms)
        .map(|dt| dt.with_timezone(tz).date_naive().format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;
    use crate::models::{CategoryRule, RuleMatchType, CATEGORY_PRODUCTIVE_ID};

    fn sample(app: &str, title: &str, idle_secs: u64, is_fullscreen: bool) -> WindowSample {
        WindowSample {
            app_name: app.into(),
            process_name: format!("{app}.exe"),
            window_title: title.into(),
            is_fullscreen,
            idle_secs,
            icon_key: None,
        }
    }

    #[test]
    fn splits_session_cleanly_across_midnight() {
        let utc = FixedOffset::east_opt(0).unwrap();
        // 2026-11-26 23:55:00 UTC -> 2026-11-27 00:10:00 UTC (5m + 10m)
        let start_ms = utc
            .with_ymd_and_hms(2026, 11, 26, 23, 55, 0)
            .unwrap()
            .timestamp_millis();
        let end_ms = utc
            .with_ymd_and_hms(2026, 11, 27, 0, 10, 0)
            .unwrap()
            .timestamp_millis();

        let buf = ActiveBuffer {
            id: "sess-1".into(),
            app_name: "VS Code".into(),
            process_name: "Code.exe".into(),
            window_title: "main.rs".into(),
            domain_context: None,
            category_id: CATEGORY_PRODUCTIVE_ID.into(),
            start_ts: start_ms,
            last_active_ts: end_ms,
            last_checkpoint_ts: start_ms,
            icon_key: None,
            tags: Vec::new(),
        };

        let parts = split_session_by_midnight_with_tz(&buf, end_ms, &utc);
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0].date, "2026-11-26");
        assert_eq!(parts[0].duration_secs, 300);
        assert_eq!(parts[0].id, "sess-1");
        assert_eq!(parts[1].date, "2026-11-27");
        assert_eq!(parts[1].duration_secs, 600);
        assert_ne!(parts[1].id, "sess-1");
    }

    #[test]
    fn idle_detection_trims_inactive_tail() {
        let utc = FixedOffset::east_opt(0).unwrap();
        let mut tracker = ActivityTracker::new();
        let mut settings = AppSettings::default();
        settings.idle_threshold_secs = 300;
        let rules = vec![CategoryRule {
            id: "r1".into(),
            match_type: RuleMatchType::AppName,
            pattern: "Code".into(),
            category_id: CATEGORY_PRODUCTIVE_ID.into(),
            priority: 10,
            is_regex: false,
            tag: None,
        }];

        let t0 = utc.with_ymd_and_hms(2026, 11, 26, 10, 0, 0).unwrap().timestamp_millis();
        // Active for 600s (t0 .. t0 + 600s), then idle rises from 1..300s over the next 300s
        for sec in 0..=899i64 {
            let idle = if sec <= 600 { 0 } else { (sec - 600) as u64 };
            tracker.tick_with_tz(
                t0 + sec * 1000,
                Some(sample("Code", "main.rs", idle, false)),
                &settings,
                &rules,
                &[],
                &utc,
            );
        }
        // At t0 + 900s, idle_secs hits 300s -> tail of 300s MUST be trimmed -> logged duration = 600s!
        let t_idle = t0 + 900_000;
        let out = tracker.tick_with_tz(
            t_idle,
            Some(sample("Code", "main.rs", 300, false)),
            &settings,
            &rules,
            &[],
            &utc,
        );

        assert!(out.is_idle);
        assert_eq!(out.flushed.len(), 1);
        assert_eq!(out.flushed[0].duration_secs, 600);
        assert_eq!(out.flushed[0].end_ts, t0 + 600_000);
    }

    #[test]
    fn fullscreen_suppresses_idle_when_enabled() {
        let utc = FixedOffset::east_opt(0).unwrap();
        let mut tracker = ActivityTracker::new();
        let mut settings = AppSettings::default();
        settings.idle_threshold_secs = 300;
        settings.suppress_idle_fullscreen = true;

        let t0 = utc.with_ymd_and_hms(2026, 11, 26, 12, 0, 0).unwrap().timestamp_millis();
        let mut out = TrackerOutput::default();
        for sec in 0..=400i64 {
            out = tracker.tick_with_tz(
                t0 + sec * 1000,
                Some(sample("VLC", "Lecture.mp4", sec as u64, true)),
                &settings,
                &[],
                &[],
                &utc,
            );
        }
        assert!(!out.is_idle);
        assert!(out.is_fullscreen_suppressed);
        assert!(out.flushed.is_empty());
        assert_eq!(out.active_duration_secs, 400);
    }

    #[test]
    fn sleep_gap_closes_prior_session_without_counting_asleep_time() {
        let utc = FixedOffset::east_opt(0).unwrap();
        let mut tracker = ActivityTracker::new();
        let settings = AppSettings::default();

        let t0 = utc.with_ymd_and_hms(2026, 11, 26, 9, 0, 0).unwrap().timestamp_millis();
        tracker.tick_with_tz(t0, Some(sample("Code", "lib.rs", 0, false)), &settings, &[], &[], &utc);
        tracker.tick_with_tz(t0 + 10_000, Some(sample("Code", "lib.rs", 0, false)), &settings, &[], &[], &utc);

        // Laptop sleeps for 2 hours!
        let t_wake = t0 + 10_000 + 7_200_000;
        let out = tracker.tick_with_tz(t_wake, Some(sample("Code", "lib.rs", 0, false)), &settings, &[], &[], &utc);
        assert!(out.sleep_gap_detected);
        assert_eq!(out.flushed.len(), 1);
        assert_eq!(out.flushed[0].duration_secs, 10);
    }

    #[test]
    fn ignored_app_is_never_logged() {
        let utc = FixedOffset::east_opt(0).unwrap();
        let mut tracker = ActivityTracker::new();
        let settings = AppSettings::default();
        let ignores = vec![IgnoreRule {
            id: "ig1".into(),
            match_type: RuleMatchType::AppName,
            pattern: "1Password".into(),
            is_regex: false,
        }];

        let t0 = utc.with_ymd_and_hms(2026, 11, 26, 10, 0, 0).unwrap().timestamp_millis();
        tracker.tick_with_tz(t0, Some(sample("1Password", "Vault", 0, false)), &settings, &[], &ignores, &utc);
        let out = tracker.tick_with_tz(t0 + 60_000, Some(sample("Code", "app.rs", 0, false)), &settings, &[], &ignores, &utc);
        assert!(out.flushed.is_empty());
    }

    #[test]
    fn long_chrome_session_never_double_counts_after_checkpoints() {
        let utc = FixedOffset::east_opt(0).unwrap();
        let mut tracker = ActivityTracker::new();
        let settings = AppSettings::default(); // checkpoint every 60s
        let t0 = utc.with_ymd_and_hms(2026, 11, 27, 10, 0, 0).unwrap().timestamp_millis();
        let mut stored: Vec<ActivitySession> = Vec::new();

        // Simulate 32 minutes + 15 seconds continuously in Google Chrome (1935 seconds)
        for sec in 0..=1935i64 {
            let out = tracker.tick_with_tz(
                t0 + sec * 1000,
                Some(sample("Google Chrome", "DestTraky - Google Chrome", 0, false)),
                &settings,
                &[],
                &[],
                &utc,
            );
            for s in out.flushed.into_iter().chain(out.checkpoint.into_iter()) {
                if let Some(existing) = stored.iter_mut().find(|x| x.id == s.id) {
                    *existing = s;
                } else {
                    stored.push(s);
                }
            }
        }

        // At 1935s, SQLite has the 32m (1920s) checkpoint, and live snapshot has 1935s with the SAME id.
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].duration_secs, 1920);

        let live = tracker.active_snapshot_with_tz(t0 + 1935_000, &utc);
        let merged = merge_live_sessions(&stored, &live, "2026-11-27", "2026-11-27");
        let total_secs: i64 = merged.iter().map(|s| s.duration_secs).sum();
        assert_eq!(merged.len(), 1);
        assert_eq!(total_secs, 1935);
    }
}
