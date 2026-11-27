import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActivitySession,
  AlertNotification,
  AppSettings,
  Category,
  CategoryRule,
  DailyLimit,
  DailyLimitStatus,
  DashboardSummary,
  DateRangePreset,
  FocusConfig,
  FocusRuntimeState,
  FocusSessionRecord,
  IgnoreRule,
  LiveTrackingStatus,
  NavTab,
} from "./types/pulsetrack";
import { api } from "./lib/bridge";
import { addDays, resolvePresetRange, toLocalDateString } from "./lib/format";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { PausedBanner } from "./components/PausedBanner";
import { AlertToast } from "./components/AlertToast";
import { CommandPalette } from "./components/CommandPalette";
import { OverviewView } from "./views/OverviewView";
import { TimelineView } from "./views/TimelineView";
import { FocusView } from "./views/FocusView";
import { LimitsView } from "./views/LimitsView";
import { RulesView } from "./views/RulesView";
import { SettingsView } from "./views/SettingsView";

const INITIAL_LIVE: LiveTrackingStatus = {
  paused: false,
  isIdle: false,
  isFullscreenSuppressed: false,
  activeApp: null,
  activeTitle: null,
  activeContext: null,
  activeCategoryId: null,
  activeDurationSecs: 0,
  todayTotalSecs: 0,
  todayScore: null,
};

const INITIAL_FOCUS: FocusRuntimeState = {
  phase: "idle",
  running: false,
  remainingSecs: 1500,
  totalSecs: 1500,
  completedCyclesToday: 0,
  currentStreakDays: 0,
  distractionsInSession: 0,
  config: {
    focusMins: 25,
    shortBreakMins: 5,
    longBreakMins: 15,
    cyclesBeforeLongBreak: 4,
    warnOnDistraction: true,
  },
};

const INITIAL_SETTINGS: AppSettings = {
  idleThresholdSecs: 300,
  suppressIdleFullscreen: true,
  sleepGapThresholdSecs: 15,
  autoStartLogin: false,
  minimizeToTray: true,
  theme: "light",
  checkpointIntervalSecs: 60,
  contextSwitchDebounceSecs: 2,
};

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [{ startDate, endDate }, setRange] = useState(() => resolvePresetRange("today"));
  const [timelineAppFilter, setTimelineAppFilter] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const [live, setLive] = useState<LiveTrackingStatus>(INITIAL_LIVE);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [heatmapSessions, setHeatmapSessions] = useState<ActivitySession[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([]);
  const [limits, setLimits] = useState<DailyLimitStatus[]>([]);
  const [focus, setFocus] = useState<FocusRuntimeState>(INITIAL_FOCUS);
  const [focusHistory, setFocusHistory] = useState<FocusSessionRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [alert, setAlert] = useState<AlertNotification | null>(null);

  const rangeRef = useRef({ startDate, endDate });
  const liveRefreshInFlight = useRef(false);

  useEffect(() => {
    rangeRef.current = { startDate, endDate };
  }, [startDate, endDate]);

  const refreshData = useCallback(async (sDate: string, eDate: string) => {
    const today = toLocalDateString(new Date());
    const [sum, sess, heatSess, cats, rls, igs, lims, foc, fHist, stg, lv] = await Promise.all([
      api.getDashboardSummary(sDate, eDate),
      api.getSessions(sDate, eDate),
      api.getSessions(addDays(today, -27), today),
      api.listCategories(),
      api.listRules(),
      api.listIgnoreRules(),
      api.listLimitStatuses(),
      api.getFocusState(),
      api.listFocusSessions(sDate === eDate ? addDays(eDate, -6) : sDate, eDate),
      api.getSettings(),
      api.getLiveStatus(),
    ]);
    setSummary(sum);
    setSessions(sess);
    setHeatmapSessions(heatSess);
    setCategories(cats);
    setRules(rls);
    setIgnoreRules(igs);
    setLimits(lims);
    setFocus(foc);
    setFocusHistory(fHist);
    setSettings(stg);
    setLive(lv);
  }, []);

  // Lightweight 1-second live refresh: updates ONLY dynamic dashboard metrics, sessions, and limits
  // without re-fetching static settings/rules/categories or overlapping in-flight requests.
  const refreshLiveMetrics = useCallback(async () => {
    if (liveRefreshInFlight.current || (typeof document !== "undefined" && document.hidden)) {
      return;
    }
    const { startDate: sDate, endDate: eDate } = rangeRef.current;
    const today = toLocalDateString(new Date());
    if (today < sDate || today > eDate) {
      return;
    }
    liveRefreshInFlight.current = true;
    try {
      const [sum, sess, lims] = await Promise.all([
        api.getDashboardSummary(sDate, eDate),
        api.getSessions(sDate, eDate),
        api.listLimitStatuses(),
      ]);
      setSummary(sum);
      setSessions(sess);
      setLimits(lims);
    } finally {
      liveRefreshInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refreshData(startDate, endDate);
  }, [startDate, endDate, refreshData]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    void api
      .subscribeEvents({
        onLive: (lv) => {
          setLive(lv);
          void refreshLiveMetrics();
        },
        onFocus: (fc) => setFocus(fc),
        onAlert: (al) => {
          setAlert(al);
          window.setTimeout(() => {
            setAlert((cur) => (cur?.timestampMs === al.timestampMs ? null : cur));
          }, 5000);
        },
      })
      .then((unsub) => {
        cleanup = unsub;
      });
    return () => {
      cleanup?.();
    };
  }, [refreshLiveMetrics]);

  const handleSelectPreset = (next: DateRangePreset) => {
    setPreset(next);
    if (next !== "custom") {
      setRange(resolvePresetRange(next));
    }
  };

  const handleCustomRange = (s: string, e: string) => {
    setPreset("custom");
    setRange({ startDate: s, endDate: e });
  };

  const handlePickDate = (date: string) => {
    const today = toLocalDateString(new Date());
    const yesterday = addDays(today, -1);
    if (date === today) setPreset("today");
    else if (date === yesterday) setPreset("yesterday");
    else setPreset("custom");
    setRange({ startDate: date, endDate: date });
  };

  const handleTogglePause = async () => {
    const updated = await api.setPaused(!live.paused);
    setLive(updated);
  };

  const handleToggleTheme = async () => {
    const nextTheme = settings.theme === "dark" ? "light" : "dark";
    const saved = await api.saveSettings({ ...settings, theme: nextTheme });
    setSettings(saved);
  };

  const handleExport = async (format: "csv" | "json") => {
    const path = await api.exportData(format, startDate, endDate);
    if (path) {
      setAlert({
        kind: "export_done",
        title: `Exported ${format.toUpperCase()}`,
        body: path,
        target: "export",
        timestampMs: Date.now(),
      });
    }
  };

  const handleInspectApp = (appName: string) => {
    setTimelineAppFilter(appName);
    setActiveTab("timeline");
  };

  const handleLogManualTask = async (
    title: string,
    categoryId: string,
    durationMins: number,
    tag: string | null
  ) => {
    await api.logManualSession(title, categoryId, durationMins, tag);
    void refreshData(startDate, endDate);
    setAlert({
      kind: "task_logged",
      title: "Task logged",
      body: `${title} (${durationMins}m)`,
      target: "timeline",
      timestampMs: Date.now(),
    });
  };

  const handleTestRule = useCallback(
    (appName: string, windowTitle: string) => api.testRuleMatch(appName, windowTitle),
    []
  );

  const handleSaveCategory = async (cat: Category) => {
    const next = await api.saveCategory(cat);
    setCategories(next);
    void refreshData(startDate, endDate);
  };

  const handleDeleteCategory = async (id: string) => {
    const next = await api.deleteCategory(id);
    setCategories(next);
    void refreshData(startDate, endDate);
  };

  const handleSaveRule = async (rule: CategoryRule) => {
    const next = await api.saveRule(rule);
    setRules(next);
    void refreshData(startDate, endDate);
  };

  const handleDeleteRule = async (id: string) => {
    const next = await api.deleteRule(id);
    setRules(next);
    void refreshData(startDate, endDate);
  };

  const handleSaveIgnore = async (rule: IgnoreRule) => {
    const next = await api.saveIgnoreRule(rule);
    setIgnoreRules(next);
  };

  const handleDeleteIgnore = async (id: string) => {
    const next = await api.deleteIgnoreRule(id);
    setIgnoreRules(next);
  };

  const handleSaveLimit = async (limit: DailyLimit) => {
    const next = await api.saveLimit(limit);
    setLimits(next);
  };

  const handleDeleteLimit = async (id: string) => {
    const next = await api.deleteLimit(id);
    setLimits(next);
  };

  const handleUpdateFocusConfig = async (cfg: FocusConfig) => {
    const next = await api.updateFocusConfig(cfg);
    setFocus(next);
  };

  const handleSaveSettings = async (next: AppSettings) => {
    const saved = await api.saveSettings(next);
    setSettings(saved);
  };

  const handleClearAll = async () => {
    await api.clearAllData();
    void refreshData(startDate, endDate);
    setAlert({
      kind: "cleared",
      title: "Data cleared",
      body: "Local activity history removed.",
      target: "data",
      timestampMs: Date.now(),
    });
  };

  const knownApps = summary?.topApps.map((a) => a.appName) ?? [];

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-canvas text-ink">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        live={live}
        focus={focus}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full">
        <TopBar
          activeTab={activeTab}
          live={live}
          focus={focus}
          theme={settings.theme}
          onSelectTab={setActiveTab}
          onOpenCommand={() => setCommandOpen(true)}
          onTogglePause={handleTogglePause}
          onExport={handleExport}
        />

        {live.paused && <PausedBanner onResume={handleTogglePause} />}

        <main className="flex-1 overflow-y-auto p-6">
          {/* Persistent Workspace Header: horizontal tabs across ALL pages + date range on Overview/Timeline/Focus/Limits */}
          <WorkspaceHeader
            activeTab={activeTab}
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            onSelectTab={setActiveTab}
            onSelectPreset={handleSelectPreset}
            onCustomRange={handleCustomRange}
          />

          {activeTab === "overview" && (
            <OverviewView
              summary={summary}
              sessions={sessions}
              heatmapSessions={heatmapSessions}
              limits={limits}
              preset={preset}
              startDate={startDate}
              endDate={endDate}
              onPickDate={handlePickDate}
              onSelectTab={setActiveTab}
              onInspectApp={handleInspectApp}
            />
          )}

          {activeTab === "timeline" && (
            <TimelineView
              sessions={sessions}
              categories={categories}
              initialAppFilter={timelineAppFilter}
              onClearAppFilter={() => setTimelineAppFilter(null)}
              onQuickIgnoreApp={(proc) =>
                handleSaveIgnore({
                  id: `ig-${Date.now()}`,
                  matchType: "appName",
                  pattern: proc,
                  isRegex: false,
                })
              }
              onLogManualTask={handleLogManualTask}
            />
          )}

          {activeTab === "focus" && (
            <div className="max-w-[1400px] mx-auto">
              <FocusView
                focus={focus}
                history={focusHistory}
                onStart={() => void api.focusStart().then(setFocus)}
                onPause={() => void api.focusPause().then(setFocus)}
                onResume={() => void api.focusResume().then(setFocus)}
                onReset={() => void api.focusReset().then(setFocus)}
                onUpdateConfig={handleUpdateFocusConfig}
              />
            </div>
          )}

          {activeTab === "limits" && (
            <div className="max-w-[1400px] mx-auto">
              <LimitsView
                limits={limits}
                categories={categories}
                knownApps={knownApps}
                onSaveLimit={handleSaveLimit}
                onDeleteLimit={handleDeleteLimit}
              />
            </div>
          )}

          {activeTab === "rules" && (
            <RulesView
              categories={categories}
              rules={rules}
              ignoreRules={ignoreRules}
              onSaveCategory={handleSaveCategory}
              onDeleteCategory={handleDeleteCategory}
              onSaveRule={handleSaveRule}
              onDeleteRule={handleDeleteRule}
              onSaveIgnore={handleSaveIgnore}
              onDeleteIgnore={handleDeleteIgnore}
              onTestRule={handleTestRule}
            />
          )}

          {activeTab === "settings" && (
            <div className="max-w-[1400px] mx-auto">
              <SettingsView
                settings={settings}
                onSave={handleSaveSettings}
                onExport={handleExport}
                onClearAll={handleClearAll}
              />
            </div>
          )}
        </main>
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        apps={summary?.topApps ?? []}
        paused={live.paused}
        theme={settings.theme}
        onNavigate={setActiveTab}
        onInspectApp={handleInspectApp}
        onTogglePause={handleTogglePause}
        onToggleTheme={handleToggleTheme}
        onStartFocus={() => {
          void api.focusStart().then(setFocus);
          setActiveTab("focus");
        }}
        onExport={handleExport}
      />

      <AlertToast alert={alert} onDismiss={() => setAlert(null)} />
    </div>
  );
}
export default App;
