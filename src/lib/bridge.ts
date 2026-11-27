import type {
  ActivitySession,
  AlertNotification,
  AppSettings,
  Category,
  CategoryRule,
  DailyLimit,
  DailyLimitStatus,
  DashboardSummary,
  FocusConfig,
  FocusRuntimeState,
  FocusSessionRecord,
  IgnoreRule,
  LiveTrackingStatus,
} from "../types/pulsetrack";
import { mockEngine } from "./mockEngine";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export const api = {
  async getLiveStatus(): Promise<LiveTrackingStatus> {
    if (isTauriRuntime()) return tauriInvoke("get_live_status");
    return { ...mockEngine.live };
  },

  async setPaused(paused: boolean): Promise<LiveTrackingStatus> {
    if (isTauriRuntime()) return tauriInvoke("set_paused", { paused });
    return mockEngine.setPaused(paused);
  },

  async getDashboardSummary(startDate: string, endDate: string): Promise<DashboardSummary> {
    if (isTauriRuntime()) {
      return tauriInvoke("get_dashboard_summary", { startDate, endDate });
    }
    return mockEngine.getDashboardSummary(startDate, endDate);
  },

  async getSessions(startDate: string, endDate: string): Promise<ActivitySession[]> {
    if (isTauriRuntime()) return tauriInvoke("get_sessions", { startDate, endDate });
    return mockEngine.sessions.filter((s) => s.date >= startDate && s.date <= endDate);
  },

  async listCategories(): Promise<Category[]> {
    if (isTauriRuntime()) return tauriInvoke("list_categories");
    return [...mockEngine.categories];
  },

  async saveCategory(category: Category): Promise<Category[]> {
    if (isTauriRuntime()) return tauriInvoke("save_category", { category });
    const idx = mockEngine.categories.findIndex((c) => c.id === category.id);
    if (idx >= 0) mockEngine.categories[idx] = category;
    else mockEngine.categories.push(category);
    return [...mockEngine.categories];
  },

  async deleteCategory(id: string): Promise<Category[]> {
    if (isTauriRuntime()) return tauriInvoke("delete_category", { id });
    mockEngine.categories = mockEngine.categories.filter((c) => c.isSystem || c.id !== id);
    mockEngine.sessions.forEach((s) => {
      if (s.categoryId === id) s.categoryId = "neutral";
    });
    return [...mockEngine.categories];
  },

  async listRules(): Promise<CategoryRule[]> {
    if (isTauriRuntime()) return tauriInvoke("list_rules");
    return [...mockEngine.rules];
  },

  async saveRule(rule: CategoryRule): Promise<CategoryRule[]> {
    if (isTauriRuntime()) return tauriInvoke("save_rule", { rule });
    const idx = mockEngine.rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) mockEngine.rules[idx] = rule;
    else mockEngine.rules.unshift(rule);
    mockEngine.recategorize();
    return [...mockEngine.rules];
  },

  async deleteRule(id: string): Promise<CategoryRule[]> {
    if (isTauriRuntime()) return tauriInvoke("delete_rule", { id });
    mockEngine.rules = mockEngine.rules.filter((r) => r.id !== id);
    mockEngine.recategorize();
    return [...mockEngine.rules];
  },

  async listIgnoreRules(): Promise<IgnoreRule[]> {
    if (isTauriRuntime()) return tauriInvoke("list_ignore_rules");
    return [...mockEngine.ignoreRules];
  },

  async saveIgnoreRule(rule: IgnoreRule): Promise<IgnoreRule[]> {
    if (isTauriRuntime()) return tauriInvoke("save_ignore_rule", { rule });
    const idx = mockEngine.ignoreRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) mockEngine.ignoreRules[idx] = rule;
    else mockEngine.ignoreRules.push(rule);
    return [...mockEngine.ignoreRules];
  },

  async deleteIgnoreRule(id: string): Promise<IgnoreRule[]> {
    if (isTauriRuntime()) return tauriInvoke("delete_ignore_rule", { id });
    mockEngine.ignoreRules = mockEngine.ignoreRules.filter((r) => r.id !== id);
    return [...mockEngine.ignoreRules];
  },

  async listLimitStatuses(): Promise<DailyLimitStatus[]> {
    if (isTauriRuntime()) return tauriInvoke("list_limit_statuses");
    return mockEngine.getLimitStatuses();
  },

  async saveLimit(limit: DailyLimit): Promise<DailyLimitStatus[]> {
    if (isTauriRuntime()) return tauriInvoke("save_limit", { limit });
    const idx = mockEngine.limits.findIndex((l) => l.id === limit.id);
    if (idx >= 0) mockEngine.limits[idx] = limit;
    else mockEngine.limits.push(limit);
    return mockEngine.getLimitStatuses();
  },

  async deleteLimit(id: string): Promise<DailyLimitStatus[]> {
    if (isTauriRuntime()) return tauriInvoke("delete_limit", { id });
    mockEngine.limits = mockEngine.limits.filter((l) => l.id !== id);
    return mockEngine.getLimitStatuses();
  },

  async getFocusState(): Promise<FocusRuntimeState> {
    if (isTauriRuntime()) return tauriInvoke("get_focus_state");
    return { ...mockEngine.focusState };
  },

  async focusStart(): Promise<FocusRuntimeState> {
    if (isTauriRuntime()) return tauriInvoke("focus_start");
    const total = mockEngine.focusConfig.focusMins * 60;
    mockEngine.focusState = {
      ...mockEngine.focusState,
      phase: "focus",
      running: true,
      totalSecs: total,
      remainingSecs: total,
      distractionsInSession: 0,
    };
    return { ...mockEngine.focusState };
  },

  async focusPause(): Promise<FocusRuntimeState> {
    if (isTauriRuntime()) return tauriInvoke("focus_pause");
    mockEngine.focusState.running = false;
    return { ...mockEngine.focusState };
  },

  async focusResume(): Promise<FocusRuntimeState> {
    if (isTauriRuntime()) return tauriInvoke("focus_resume");
    if (mockEngine.focusState.phase === "idle") return this.focusStart();
    mockEngine.focusState.running = true;
    return { ...mockEngine.focusState };
  },

  async focusReset(): Promise<FocusRuntimeState> {
    if (isTauriRuntime()) return tauriInvoke("focus_reset");
    const total = mockEngine.focusConfig.focusMins * 60;
    mockEngine.focusState = {
      ...mockEngine.focusState,
      phase: "idle",
      running: false,
      totalSecs: total,
      remainingSecs: total,
      distractionsInSession: 0,
    };
    return { ...mockEngine.focusState };
  },

  async updateFocusConfig(config: FocusConfig): Promise<FocusRuntimeState> {
    if (isTauriRuntime()) return tauriInvoke("update_focus_config", { config });
    mockEngine.focusConfig = { ...config };
    mockEngine.focusState.config = { ...config };
    if (mockEngine.focusState.phase === "idle") {
      mockEngine.focusState.totalSecs = config.focusMins * 60;
      mockEngine.focusState.remainingSecs = config.focusMins * 60;
    }
    return { ...mockEngine.focusState };
  },

  async listFocusSessions(startDate: string, endDate: string): Promise<FocusSessionRecord[]> {
    if (isTauriRuntime()) return tauriInvoke("list_focus_sessions", { startDate, endDate });
    return mockEngine.focusSessions.filter((s) => s.date >= startDate && s.date <= endDate);
  },

  async getSettings(): Promise<AppSettings> {
    if (isTauriRuntime()) return tauriInvoke("get_settings");
    return { ...mockEngine.settings };
  },

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    if (isTauriRuntime()) return tauriInvoke("save_settings", { settings });
    mockEngine.settings = { ...settings };
    return { ...mockEngine.settings };
  },

  async exportData(format: "csv" | "json", startDate: string, endDate: string): Promise<string | null> {
    if (isTauriRuntime()) {
      return tauriInvoke("export_data", { format, startDate, endDate });
    }
    return mockEngine.exportDownload(format, startDate, endDate);
  },

  async logManualSession(
    title: string,
    categoryId: string,
    durationMins: number,
    tag: string | null
  ): Promise<ActivitySession> {
    if (isTauriRuntime()) {
      return tauriInvoke("log_manual_session", { title, categoryId, durationMins, tag });
    }
    return mockEngine.logManualSession(title, categoryId, durationMins, tag);
  },

  async testRuleMatch(appName: string, windowTitle: string) {
    if (isTauriRuntime()) {
      return tauriInvoke<{
        categoryId: string;
        matchedRuleId: string | null;
        matchedPattern: string | null;
        ignored: boolean;
        tags: string[];
      }>("test_rule_match", { appName, windowTitle });
    }
    return mockEngine.testRuleMatch(appName, windowTitle);
  },

  async clearAllData(): Promise<void> {
    if (isTauriRuntime()) return tauriInvoke("clear_all_data");
    mockEngine.sessions = [];
    mockEngine.focusSessions = [];
    mockEngine.live.todayTotalSecs = 0;
    mockEngine.live.todayScore = null;
    mockEngine.live.activeDurationSecs = 0;
  },

  async subscribeEvents(handlers: {
    onLive: (s: LiveTrackingStatus) => void;
    onFocus: (s: FocusRuntimeState) => void;
    onAlert: (a: AlertNotification) => void;
  }): Promise<() => void> {
    if (isTauriRuntime()) {
      const { listen } = await import("@tauri-apps/api/event");
      const un1 = await listen<LiveTrackingStatus>("pulsetrack:live", (e) => handlers.onLive(e.payload));
      const un2 = await listen<FocusRuntimeState>("pulsetrack:focus", (e) => handlers.onFocus(e.payload));
      const un3 = await listen<AlertNotification>("pulsetrack:alert", (e) => handlers.onAlert(e.payload));
      return () => {
        un1();
        un2();
        un3();
      };
    }
    const u1 = mockEngine.onLive(handlers.onLive);
    const u2 = mockEngine.onFocus(handlers.onFocus);
    const u3 = mockEngine.onAlert(handlers.onAlert);
    return () => {
      u1();
      u2();
      u3();
    };
  },
};
