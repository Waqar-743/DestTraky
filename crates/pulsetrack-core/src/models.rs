use serde::{Deserialize, Serialize};

pub const CATEGORY_PRODUCTIVE_ID: &str = "productive";
pub const CATEGORY_NEUTRAL_ID: &str = "neutral";
pub const CATEGORY_DISTRACTING_ID: &str = "distracting";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProductivityKind {
    Productive,
    Neutral,
    Distracting,
}

impl ProductivityKind {
    pub fn weight(self) -> f64 {
        match self {
            ProductivityKind::Productive => 1.0,
            ProductivityKind::Neutral => 0.5,
            ProductivityKind::Distracting => 0.0,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            ProductivityKind::Productive => "productive",
            ProductivityKind::Neutral => "neutral",
            ProductivityKind::Distracting => "distracting",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value.to_ascii_lowercase().as_str() {
            "productive" => ProductivityKind::Productive,
            "distracting" => ProductivityKind::Distracting,
            _ => ProductivityKind::Neutral,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub kind: ProductivityKind,
    pub weight: f64,
    pub is_system: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RuleMatchType {
    WindowTitle,
    AppName,
}

impl RuleMatchType {
    pub fn as_str(self) -> &'static str {
        match self {
            RuleMatchType::WindowTitle => "window_title",
            RuleMatchType::AppName => "app_name",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "window_title" | "windowTitle" => RuleMatchType::WindowTitle,
            _ => RuleMatchType::AppName,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRule {
    pub id: String,
    pub match_type: RuleMatchType,
    pub pattern: String,
    pub category_id: String,
    pub priority: i32,
    #[serde(default)]
    pub is_regex: bool,
    #[serde(default)]
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IgnoreRule {
    pub id: String,
    pub match_type: RuleMatchType,
    pub pattern: String,
    #[serde(default)]
    pub is_regex: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuleTestResult {
    pub category_id: String,
    pub matched_rule_id: Option<String>,
    pub matched_pattern: Option<String>,
    pub ignored: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySession {
    pub id: String,
    /// Local calendar date YYYY-MM-DD for exact daily totals
    pub date: String,
    pub app_name: String,
    pub process_name: String,
    pub window_title: String,
    pub domain_context: Option<String>,
    pub category_id: String,
    /// Epoch milliseconds (UTC)
    pub start_ts: i64,
    /// Epoch milliseconds (UTC)
    pub end_ts: i64,
    pub duration_secs: i64,
    pub icon_key: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub is_manual: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LimitTargetType {
    App,
    Category,
}

impl LimitTargetType {
    pub fn as_str(self) -> &'static str {
        match self {
            LimitTargetType::App => "app",
            LimitTargetType::Category => "category",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "category" => LimitTargetType::Category,
            _ => LimitTargetType::App,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DailyLimit {
    pub id: String,
    pub target_type: LimitTargetType,
    /// App name (case-insensitive) or Category ID
    pub target_value: String,
    pub daily_limit_mins: i64,
    pub enabled: bool,
    pub notify_at_80: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DailyLimitStatus {
    pub limit: DailyLimit,
    pub label: String,
    pub color: String,
    pub used_secs: i64,
    pub limit_secs: i64,
    pub remaining_secs: i64,
    pub percent: f64,
    pub exceeded: bool,
    pub warning_80: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FocusPhase {
    Idle,
    Focus,
    ShortBreak,
    LongBreak,
}

impl FocusPhase {
    pub fn as_str(self) -> &'static str {
        match self {
            FocusPhase::Idle => "idle",
            FocusPhase::Focus => "focus",
            FocusPhase::ShortBreak => "short_break",
            FocusPhase::LongBreak => "long_break",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FocusConfig {
    pub focus_mins: u32,
    pub short_break_mins: u32,
    pub long_break_mins: u32,
    pub cycles_before_long_break: u32,
    pub warn_on_distraction: bool,
}

impl Default for FocusConfig {
    fn default() -> Self {
        Self {
            focus_mins: 25,
            short_break_mins: 5,
            long_break_mins: 15,
            cycles_before_long_break: 4,
            warn_on_distraction: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionRecord {
    pub id: String,
    pub date: String,
    pub start_ts: i64,
    pub end_ts: i64,
    pub planned_secs: i64,
    pub completed_secs: i64,
    pub completed: bool,
    pub distractions_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FocusRuntimeState {
    pub phase: FocusPhase,
    pub running: bool,
    pub remaining_secs: u32,
    pub total_secs: u32,
    pub completed_cycles_today: u32,
    pub current_streak_days: u32,
    pub distractions_in_session: u32,
    pub config: FocusConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub idle_threshold_secs: u64,
    pub suppress_idle_fullscreen: bool,
    pub sleep_gap_threshold_secs: u64,
    pub auto_start_login: bool,
    pub minimize_to_tray: bool,
    pub theme: String,
    pub checkpoint_interval_secs: u64,
    pub context_switch_debounce_secs: i64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            idle_threshold_secs: 300,
            suppress_idle_fullscreen: true,
            sleep_gap_threshold_secs: 15,
            auto_start_login: false,
            minimize_to_tray: true,
            theme: "dark".to_string(),
            checkpoint_interval_secs: 60,
            context_switch_debounce_secs: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LiveTrackingStatus {
    pub paused: bool,
    pub is_idle: bool,
    pub is_fullscreen_suppressed: bool,
    pub active_app: Option<String>,
    pub active_title: Option<String>,
    pub active_context: Option<String>,
    pub active_category_id: Option<String>,
    pub active_duration_secs: i64,
    pub today_total_secs: i64,
    pub today_score: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DateRangePreset {
    Today,
    Yesterday,
    Last7Days,
    Last30Days,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DateRangeQuery {
    pub preset: DateRangePreset,
    /// YYYY-MM-DD inclusive
    pub start_date: String,
    /// YYYY-MM-DD inclusive
    pub end_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PeriodComparison {
    pub current: f64,
    pub previous: f64,
    /// Percentage delta; None if previous == 0 and current == 0
    pub delta_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CategoryBreakdownItem {
    pub category_id: String,
    pub name: String,
    pub color: String,
    pub kind: ProductivityKind,
    pub total_secs: i64,
    pub share_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppUsageItem {
    pub app_name: String,
    pub process_name: String,
    pub category_id: String,
    pub category_name: String,
    pub category_color: String,
    pub total_secs: i64,
    pub share_pct: f64,
    pub sessions_count: usize,
    pub top_context: Option<String>,
    pub icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimeBucket {
    pub key: String,
    pub label: String,
    pub total_secs: i64,
    pub score: Option<u32>,
    /// Map of category_id -> seconds
    pub by_category: std::collections::HashMap<String, i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub start_date: String,
    pub end_date: String,
    pub prev_start_date: String,
    pub prev_end_date: String,
    pub total_active_secs: i64,
    pub productive_secs: i64,
    pub neutral_secs: i64,
    pub distracting_secs: i64,
    pub productivity_score: Option<u32>,
    pub context_switches_per_hour: f64,
    pub total_context_switches: usize,
    pub active_comparison: PeriodComparison,
    pub productive_comparison: PeriodComparison,
    pub score_comparison: PeriodComparison,
    pub switches_comparison: PeriodComparison,
    pub categories: Vec<CategoryBreakdownItem>,
    pub top_apps: Vec<AppUsageItem>,
    pub buckets: Vec<TimeBucket>,
    pub hourly_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AlertNotification {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub target: String,
    pub timestamp_ms: i64,
}
