export type ProductivityKind = "productive" | "neutral" | "distracting";
export type RuleMatchType = "windowTitle" | "appName";
export type LimitTargetType = "app" | "category";
export type FocusPhase = "idle" | "focus" | "shortBreak" | "longBreak";
export type DateRangePreset = "today" | "yesterday" | "last7Days" | "last30Days" | "custom";
export type NavTab = "overview" | "timeline" | "focus" | "limits" | "rules" | "settings";

export interface Category {
  id: string;
  name: string;
  color: string;
  kind: ProductivityKind;
  weight: number;
  isSystem: boolean;
}

export interface CategoryRule {
  id: string;
  matchType: RuleMatchType;
  pattern: string;
  categoryId: string;
  priority: number;
  isRegex?: boolean;
  tag?: string | null;
}

export interface IgnoreRule {
  id: string;
  matchType: RuleMatchType;
  pattern: string;
  isRegex?: boolean;
}

export interface RuleTestResult {
  categoryId: string;
  matchedRuleId: string | null;
  matchedPattern: string | null;
  ignored: boolean;
  tags: string[];
}

export interface ActivitySession {
  id: string;
  date: string;
  appName: string;
  processName: string;
  windowTitle: string;
  domainContext: string | null;
  categoryId: string;
  startTs: number;
  endTs: number;
  durationSecs: number;
  iconKey: string | null;
  tags?: string[];
  isManual?: boolean;
}

export interface DailyLimit {
  id: string;
  targetType: LimitTargetType;
  targetValue: string;
  dailyLimitMins: number;
  enabled: boolean;
  notifyAt80: boolean;
}

export interface DailyLimitStatus {
  limit: DailyLimit;
  label: string;
  color: string;
  usedSecs: number;
  limitSecs: number;
  remainingSecs: number;
  percent: number;
  exceeded: boolean;
  warning80: boolean;
}

export interface FocusConfig {
  focusMins: number;
  shortBreakMins: number;
  longBreakMins: number;
  cyclesBeforeLongBreak: number;
  warnOnDistraction: boolean;
}

export interface FocusSessionRecord {
  id: string;
  date: string;
  startTs: number;
  endTs: number;
  plannedSecs: number;
  completedSecs: number;
  completed: boolean;
  distractionsCount: number;
}

export interface FocusRuntimeState {
  phase: FocusPhase;
  running: boolean;
  remainingSecs: number;
  totalSecs: number;
  completedCyclesToday: number;
  currentStreakDays: number;
  distractionsInSession: number;
  config: FocusConfig;
}

export interface AppSettings {
  idleThresholdSecs: number;
  suppressIdleFullscreen: boolean;
  sleepGapThresholdSecs: number;
  autoStartLogin: boolean;
  minimizeToTray: boolean;
  theme: "dark" | "light";
  checkpointIntervalSecs: number;
  contextSwitchDebounceSecs: number;
}

export interface LiveTrackingStatus {
  paused: boolean;
  isIdle: boolean;
  isFullscreenSuppressed: boolean;
  activeApp: string | null;
  activeTitle: string | null;
  activeContext: string | null;
  activeCategoryId: string | null;
  activeDurationSecs: number;
  todayTotalSecs: number;
  todayScore: number | null;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  deltaPct: number | null;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  kind: ProductivityKind;
  totalSecs: number;
  sharePct: number;
}

export interface AppUsageItem {
  appName: string;
  processName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalSecs: number;
  sharePct: number;
  sessionsCount: number;
  topContext: string | null;
  iconDataUrl: string | null;
}

export interface TimeBucket {
  key: string;
  label: string;
  totalSecs: number;
  score: number | null;
  byCategory: Record<string, number>;
}

export interface DashboardSummary {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  totalActiveSecs: number;
  productiveSecs: number;
  neutralSecs: number;
  distractingSecs: number;
  productivityScore: number | null;
  contextSwitchesPerHour: number;
  totalContextSwitches: number;
  activeComparison: PeriodComparison;
  productiveComparison: PeriodComparison;
  scoreComparison: PeriodComparison;
  switchesComparison: PeriodComparison;
  categories: CategoryBreakdownItem[];
  topApps: AppUsageItem[];
  buckets: TimeBucket[];
  hourlyMode: boolean;
}

export interface AlertNotification {
  kind: string;
  title: string;
  body: string;
  target: string;
  timestampMs: number;
}

// Curated warm palette: strictly zero blue, zero pink, zero light green
export const WARM_SWATCHES = [
  "#D98A1C", // Burnished Amber
  "#C84630", // Burnt Vermilion
  "#8A8478", // Warm Stone
  "#B56537", // Terracotta
  "#9E7B3B", // Aged Brass
  "#6E5A3E", // Raw Umber
  "#5B5E3F", // Deep Olive
  "#8E443D", // Rust Brick
  "#C2A673", // Warm Sand
  "#4E4C46", // Graphite
] as const;
