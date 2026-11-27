import type {
  ActivitySession,
  AlertNotification,
  AppSettings,
  AppUsageItem,
  Category,
  CategoryBreakdownItem,
  CategoryRule,
  DailyLimit,
  DailyLimitStatus,
  DashboardSummary,
  FocusConfig,
  FocusRuntimeState,
  FocusSessionRecord,
  IgnoreRule,
  LiveTrackingStatus,
  PeriodComparison,
  TimeBucket,
} from "../types/pulsetrack";
import { addDays, formatShortDateLabel, toLocalDateString } from "./format";

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function defaultCategories(): Category[] {
  return [
    { id: "productive", name: "Productive", color: "#D98A1C", kind: "productive", weight: 1.0, isSystem: true },
    { id: "neutral", name: "Neutral", color: "#8A8478", kind: "neutral", weight: 0.5, isSystem: true },
    { id: "distracting", name: "Distracting", color: "#C84630", kind: "distracting", weight: 0.0, isSystem: true },
    { id: "deep-work", name: "Deep Code", color: "#9E7B3B", kind: "productive", weight: 1.0, isSystem: false },
  ];
}

function defaultRules(): CategoryRule[] {
  return [
    { id: "r-t-pr", matchType: "windowTitle", pattern: "PR #\\d+|pull/\\d+", categoryId: "productive", priority: 40, isRegex: true, tag: "code-review" },
    { id: "r-t-yt", matchType: "windowTitle", pattern: "youtube", categoryId: "distracting", priority: 30, isRegex: false, tag: "video" },
    { id: "r-t-rd", matchType: "windowTitle", pattern: "reddit", categoryId: "distracting", priority: 30, isRegex: false, tag: "social" },
    { id: "r-t-gh", matchType: "windowTitle", pattern: "github", categoryId: "productive", priority: 35, isRegex: false, tag: "git" },
    { id: "r-t-fg", matchType: "windowTitle", pattern: "figma", categoryId: "productive", priority: 35, isRegex: false, tag: "design" },
    { id: "r-t-ln", matchType: "windowTitle", pattern: "linear", categoryId: "productive", priority: 30, isRegex: false, tag: "planning" },
    { id: "r-a-code", matchType: "appName", pattern: "Code.exe", categoryId: "deep-work", priority: 20, isRegex: false, tag: "coding" },
    { id: "r-a-wt", matchType: "appName", pattern: "WindowsTerminal.exe", categoryId: "productive", priority: 20, isRegex: false, tag: "cli" },
    { id: "r-a-fig", matchType: "appName", pattern: "Figma.exe", categoryId: "productive", priority: 15, isRegex: false, tag: "design" },
    { id: "r-a-obs", matchType: "appName", pattern: "Obsidian.exe", categoryId: "productive", priority: 15, isRegex: false, tag: "notes" },
    { id: "r-a-slk", matchType: "appName", pattern: "Slack.exe", categoryId: "neutral", priority: 10, isRegex: false, tag: "comms" },
    { id: "r-a-dis", matchType: "appName", pattern: "Discord.exe", categoryId: "distracting", priority: 15, isRegex: false, tag: "chat" },
  ];
}

function defaultLimits(): DailyLimit[] {
  return [
    { id: "lim-1", targetType: "category", targetValue: "distracting", dailyLimitMins: 45, enabled: true, notifyAt80: true },
    { id: "lim-2", targetType: "app", targetValue: "Discord", dailyLimitMins: 25, enabled: true, notifyAt80: true },
    { id: "lim-3", targetType: "app", targetValue: "Google Chrome", dailyLimitMins: 150, enabled: true, notifyAt80: false },
  ];
}

function defaultSettings(): AppSettings {
  return {
    idleThresholdSecs: 300,
    suppressIdleFullscreen: true,
    sleepGapThresholdSecs: 15,
    autoStartLogin: true,
    minimizeToTray: true,
    theme: "light",
    checkpointIntervalSecs: 60,
    contextSwitchDebounceSecs: 2,
  };
}

function defaultFocusConfig(): FocusConfig {
  return {
    focusMins: 25,
    shortBreakMins: 5,
    longBreakMins: 15,
    cyclesBeforeLongBreak: 4,
    warnOnDistraction: true,
  };
}

function patMatch(haystack: string, pattern: string, isRegex?: boolean): boolean {
  const pat = pattern.trim();
  if (!pat) return false;
  if (isRegex) {
    try {
      return new RegExp(pat, "i").test(haystack);
    } catch {
      return false;
    }
  }
  return haystack.toLowerCase().includes(pat.toLowerCase());
}

function appPatMatch(appName: string, procName: string, pattern: string, isRegex?: boolean): boolean {
  const pat = pattern.trim();
  if (!pat) return false;
  if (isRegex) return patMatch(appName, pat, true) || patMatch(procName, pat, true);
  const al = appName.toLowerCase();
  const pl = procName.toLowerCase();
  const pstem = pl.replace(/\.exe$/, "");
  const patL = pat.toLowerCase();
  const patStem = patL.replace(/\.exe$/, "");
  return al === patL || al.includes(patL) || pl === patL || pstem === patStem;
}

function scheduleTagForTs(ts: number): string {
  const d = new Date(ts);
  const day = d.getDay();
  if (day === 0 || day === 6) return "Weekend";
  const h = d.getHours();
  if (h >= 9 && h < 18) return "Work Hours";
  if (h >= 22 || h < 6) return "Late Night";
  return "After Hours";
}

function matchDetailed(
  appName: string,
  processName: string,
  windowTitle: string,
  rules: CategoryRule[]
): { categoryId: string; matched: CategoryRule | null; tags: string[] } {
  const tags: string[] = [];
  let matched: CategoryRule | null = null;

  const titleRules = rules
    .filter((r) => r.matchType === "windowTitle" && r.pattern.trim())
    .sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length);

  for (const r of titleRules) {
    if (patMatch(windowTitle, r.pattern, r.isRegex)) {
      if (r.tag && !tags.includes(r.tag)) tags.push(r.tag);
      if (!matched) matched = r;
    }
  }

  const appRules = rules
    .filter((r) => r.matchType === "appName" && r.pattern.trim())
    .sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length);

  for (const r of appRules) {
    if (appPatMatch(appName, processName, r.pattern, r.isRegex)) {
      if (r.tag && !tags.includes(r.tag)) tags.push(r.tag);
      if (!matched) matched = r;
    }
  }

  return { categoryId: matched?.categoryId ?? "neutral", matched, tags };
}

function generateSeedSessions(rules: CategoryRule[]): ActivitySession[] {
  const rand = seededRand(42077);
  const today = toLocalDateString(new Date());
  const templates = [
    { app: "VS Code", proc: "Code.exe", title: "tracker.rs — DestTraky — Visual Studio Code", ctx: null, weight: 32 },
    { app: "VS Code", proc: "Code.exe", title: "OverviewView.tsx — DestTraky — Visual Studio Code", ctx: null, weight: 20 },
    { app: "Windows Terminal", proc: "WindowsTerminal.exe", title: "cargo test -p pulsetrack-core", ctx: null, weight: 14 },
    { app: "Google Chrome", proc: "chrome.exe", title: "PR #128 · DestTraky · GitHub - Google Chrome", ctx: "GitHub", weight: 15 },
    { app: "Google Chrome", proc: "chrome.exe", title: "Design Tokens · Figma - Google Chrome", ctx: "Figma", weight: 10 },
    { app: "Obsidian", proc: "Obsidian.exe", title: "Architecture Notes - Obsidian", ctx: null, weight: 9 },
    { app: "Slack", proc: "Slack.exe", title: "#engineering - Workspace - Slack", ctx: null, weight: 11 },
    { app: "File Explorer", proc: "explorer.exe", title: "DestTraky — File Explorer", ctx: null, weight: 5 },
    { app: "Google Chrome", proc: "chrome.exe", title: "Systems Engineering Talk - YouTube - Google Chrome", ctx: "YouTube", weight: 8 },
    { app: "Google Chrome", proc: "chrome.exe", title: "r/rust - Reddit - Google Chrome", ctx: "Reddit", weight: 6 },
    { app: "Discord", proc: "Discord.exe", title: "#general — Rust Community — Discord", ctx: null, weight: 6 },
  ];

  const totalW = templates.reduce((a, b) => a + b.weight, 0);
  const pick = () => {
    let r = rand() * totalW;
    for (const t of templates) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return templates[0];
  };

  const sessions: ActivitySession[] = [];
  let seq = 1;

  for (let offset = 29; offset >= 0; offset--) {
    const dateStr = addDays(today, -offset);
    const [y, m, d] = dateStr.split("-").map(Number);
    const isToday = offset === 0;
    const now = new Date();
    const maxHour = isToday ? Math.max(10, Math.min(22, now.getHours())) : 21;

    // Morning + afternoon + evening blocks with natural lunch/idle gaps
    const blocks = [
      { startH: 9, endH: Math.min(12, maxHour) },
      { startH: 13, endH: Math.min(17, maxHour) },
      { startH: 18, endH: Math.min(21, maxHour) },
    ];

    for (const blk of blocks) {
      if (blk.endH <= blk.startH) continue;
      let cursorMs = new Date(y, m - 1, d, blk.startH, Math.floor(rand() * 18), 0).getTime();
      const endMs = new Date(y, m - 1, d, blk.endH, Math.floor(rand() * 35), 0).getTime();

      while (cursorMs < endMs) {
        const item = pick();
        const durSecs = Math.floor((6 + rand() * 24) * 60);
        const segEnd = Math.min(endMs, cursorMs + durSecs * 1000);
        const actualSecs = Math.floor((segEnd - cursorMs) / 1000);
        if (actualSecs >= 60) {
          const det = matchDetailed(item.app, item.proc, item.title, rules);
          const sched = scheduleTagForTs(cursorMs);
          const tags = det.tags.includes(sched) ? det.tags : [...det.tags, sched];
          sessions.push({
            id: `seed-${seq++}`,
            date: dateStr,
            appName: item.app,
            processName: item.proc,
            windowTitle: item.title,
            domainContext: item.ctx,
            categoryId: det.categoryId,
            startTs: cursorMs,
            endTs: segEnd,
            durationSecs: actualSecs,
            iconKey: item.proc.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            tags,
            isManual: false,
          });
        }
        // Small gap / idle between some blocks
        cursorMs = segEnd + (rand() > 0.72 ? Math.floor((3 + rand() * 8) * 60_000) : 1000);
      }
    }
  }
  return sessions;
}

function generateSeedFocusSessions(): FocusSessionRecord[] {
  const rand = seededRand(9911);
  const today = toLocalDateString(new Date());
  const out: FocusSessionRecord[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const dateStr = addDays(today, -offset);
    const [y, m, d] = dateStr.split("-").map(Number);
    const cycles = offset === 0 ? 3 : Math.floor(2 + rand() * 4);
    for (let i = 0; i < cycles; i++) {
      const start = new Date(y, m - 1, d, 9 + i * 2, 15, 0).getTime();
      out.push({
        id: `foc-${dateStr}-${i}`,
        date: dateStr,
        startTs: start,
        endTs: start + 25 * 60 * 1000,
        plannedSecs: 1500,
        completedSecs: 1500,
        completed: true,
        distractionsCount: rand() > 0.7 ? 1 : 0,
      });
    }
  }
  return out;
}

export class BrowserMockEngine {
  categories: Category[];
  rules: CategoryRule[];
  ignoreRules: IgnoreRule[];
  limits: DailyLimit[];
  settings: AppSettings;
  sessions: ActivitySession[];
  focusSessions: FocusSessionRecord[];
  focusConfig: FocusConfig;
  focusState: FocusRuntimeState;
  live: LiveTrackingStatus;
  private liveListeners = new Set<(s: LiveTrackingStatus) => void>();
  private focusListeners = new Set<(s: FocusRuntimeState) => void>();
  private alertListeners = new Set<(a: AlertNotification) => void>();
  private tickCount = 0;

  constructor() {
    this.categories = defaultCategories();
    this.rules = defaultRules();
    this.ignoreRules = [
      { id: "ig-1", matchType: "appName", pattern: "1Password.exe" },
      { id: "ig-2", matchType: "windowTitle", pattern: "InPrivate" },
    ];
    this.limits = defaultLimits();
    this.settings = defaultSettings();
    this.sessions = generateSeedSessions(this.rules);
    this.focusSessions = generateSeedFocusSessions();
    this.focusConfig = defaultFocusConfig();
    this.focusState = {
      phase: "idle",
      running: false,
      remainingSecs: this.focusConfig.focusMins * 60,
      totalSecs: this.focusConfig.focusMins * 60,
      completedCyclesToday: 3,
      currentStreakDays: 7,
      distractionsInSession: 0,
      config: { ...this.focusConfig },
    };

    const today = toLocalDateString(new Date());
    const todaySess = this.sessions.filter((s) => s.date === today);
    const todayTotal = todaySess.reduce((acc, s) => acc + s.durationSecs, 0);

    this.live = {
      paused: false,
      isIdle: false,
      isFullscreenSuppressed: false,
      activeApp: "VS Code",
      activeTitle: "tracker.rs — DestTraky — Visual Studio Code",
      activeContext: null,
      activeCategoryId: "deep-work",
      activeDurationSecs: 412,
      todayTotalSecs: todayTotal + 412,
      todayScore: this.calcScore(todaySess),
    };

    if (typeof window !== "undefined") {
      window.setInterval(() => this.tick1s(), 1000);
    }
  }

  onLive(cb: (s: LiveTrackingStatus) => void): () => void {
    this.liveListeners.add(cb);
    return () => this.liveListeners.delete(cb);
  }

  onFocus(cb: (s: FocusRuntimeState) => void): () => void {
    this.focusListeners.add(cb);
    return () => this.focusListeners.delete(cb);
  }

  onAlert(cb: (a: AlertNotification) => void): () => void {
    this.alertListeners.add(cb);
    return () => this.alertListeners.delete(cb);
  }

  private emitLive() {
    this.liveListeners.forEach((cb) => cb({ ...this.live }));
  }

  private emitFocus() {
    this.focusListeners.forEach((cb) => cb({ ...this.focusState }));
  }

  private emitAlert(a: AlertNotification) {
    this.alertListeners.forEach((cb) => cb(a));
  }

  private tick1s() {
    this.tickCount += 1;
    if (!this.live.paused) {
      this.live.activeDurationSecs += 1;
      this.live.todayTotalSecs += 1;
      const today = toLocalDateString(new Date());
      for (let i = this.sessions.length - 1; i >= 0; i--) {
        if (this.sessions[i].date === today) {
          this.sessions[i].durationSecs += 1;
          this.sessions[i].endTs += 1000;
          break;
        }
      }
      this.emitLive();
    }

    if (this.focusState.running && this.focusState.phase !== "idle") {
      if (this.focusState.remainingSecs > 1) {
        this.focusState.remainingSecs -= 1;
      } else {
        if (this.focusState.phase === "focus") {
          const today = toLocalDateString(new Date());
          const now = Date.now();
          this.focusSessions.unshift({
            id: `foc-live-${now}`,
            date: today,
            startTs: now - this.focusState.totalSecs * 1000,
            endTs: now,
            plannedSecs: this.focusState.totalSecs,
            completedSecs: this.focusState.totalSecs,
            completed: true,
            distractionsCount: this.focusState.distractionsInSession,
          });
          this.focusState.completedCyclesToday += 1;
          this.focusState.phase = "shortBreak";
          this.focusState.totalSecs = this.focusConfig.shortBreakMins * 60;
          this.focusState.remainingSecs = this.focusState.totalSecs;
          this.focusState.running = false;
          this.emitAlert({
            kind: "focus_complete",
            title: "Focus complete",
            body: `${this.focusConfig.focusMins}m completed.`,
            target: "focus",
            timestampMs: now,
          });
        } else {
          this.focusState.phase = "idle";
          this.focusState.running = false;
          this.focusState.totalSecs = this.focusConfig.focusMins * 60;
          this.focusState.remainingSecs = this.focusState.totalSecs;
        }
      }
      this.emitFocus();
    }
  }

  simulateDistraction() {
    if (this.focusState.running && this.focusState.phase === "focus" && this.focusConfig.warnOnDistraction) {
      this.focusState.distractionsInSession += 1;
      this.emitFocus();
      this.emitAlert({
        kind: "focus_distraction",
        title: "Distraction: YouTube",
        body: "Focus timer is active.",
        target: "YouTube",
        timestampMs: Date.now(),
      });
    }
  }

  setPaused(paused: boolean): LiveTrackingStatus {
    this.live.paused = paused;
    if (paused) this.live.isIdle = false;
    this.emitLive();
    return { ...this.live };
  }

  private calcScore(sessions: ActivitySession[]): number | null {
    const map = new Map(this.categories.map((c) => [c.id, c]));
    let total = 0;
    let weighted = 0;
    for (const s of sessions) {
      if (s.durationSecs <= 0) continue;
      total += s.durationSecs;
      weighted += s.durationSecs * (map.get(s.categoryId)?.weight ?? 0.5);
    }
    if (total <= 0) return null;
    return Math.round(Math.min(100, Math.max(0, (weighted / total) * 100)));
  }

  private calcSwitches(sessions: ActivitySession[]): { count: number; perHr: number } {
    const ordered = [...sessions].filter((s) => s.durationSecs > 0).sort((a, b) => a.startTs - b.startTs);
    const total = ordered.reduce((acc, s) => acc + s.durationSecs, 0);
    if (total <= 0) return { count: 0, perHr: 0 };
    let count = 0;
    let prev: string | null = null;
    for (const s of ordered) {
      if (s.durationSecs < this.settings.contextSwitchDebounceSecs) continue;
      const key = s.appName.toLowerCase();
      if (prev && prev !== key) count += 1;
      prev = key;
    }
    return { count, perHr: Math.round((count / (total / 3600)) * 10) / 10 };
  }

  private compare(curr: number, prev: number): PeriodComparison {
    let deltaPct: number | null = null;
    if (prev > 0) deltaPct = Math.round(((curr - prev) / prev) * 1000) / 10;
    else if (curr > 0) deltaPct = 100;
    return { current: curr, previous: prev, deltaPct };
  }

  getDashboardSummary(startDate: string, endDate: string): DashboardSummary {
    const startDt = new Date(startDate + "T00:00:00");
    const endDt = new Date(endDate + "T00:00:00");
    const spanDays = Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / 86400000) + 1);
    const prevEndDate = addDays(startDate, -1);
    const prevStartDate = addDays(prevEndDate, -(spanDays - 1));

    const current = this.sessions.filter((s) => s.date >= startDate && s.date <= endDate);
    const previous = this.sessions.filter((s) => s.date >= prevStartDate && s.date <= prevEndDate);
    const catMap = new Map(this.categories.map((c) => [c.id, c]));

    let totalActiveSecs = 0;
    let productiveSecs = 0;
    let neutralSecs = 0;
    let distractingSecs = 0;
    const byCat = new Map<string, number>();

    for (const s of current) {
      totalActiveSecs += s.durationSecs;
      byCat.set(s.categoryId, (byCat.get(s.categoryId) ?? 0) + s.durationSecs);
      const kind = catMap.get(s.categoryId)?.kind ?? "neutral";
      if (kind === "productive") productiveSecs += s.durationSecs;
      else if (kind === "distracting") distractingSecs += s.durationSecs;
      else neutralSecs += s.durationSecs;
    }

    const prevTotalSecs = previous.reduce((acc, s) => acc + s.durationSecs, 0);
    const prevProdSecs = previous
      .filter((s) => (catMap.get(s.categoryId)?.kind ?? "neutral") === "productive")
      .reduce((acc, s) => acc + s.durationSecs, 0);

    const score = this.calcScore(current);
    const prevScore = this.calcScore(previous);
    const sw = this.calcSwitches(current);
    const prevSw = this.calcSwitches(previous);

    const categories: CategoryBreakdownItem[] = this.categories
      .map((c) => {
        const secs = byCat.get(c.id) ?? 0;
        return {
          categoryId: c.id,
          name: c.name,
          color: c.color,
          kind: c.kind,
          totalSecs: secs,
          sharePct: totalActiveSecs > 0 ? Math.round((secs / totalActiveSecs) * 1000) / 10 : 0,
        };
      })
      .filter((c) => c.totalSecs > 0 || ["productive", "neutral", "distracting"].includes(c.categoryId))
      .sort((a, b) => b.totalSecs - a.totalSecs);

    const appAgg = new Map<
      string,
      {
        appName: string;
        processName: string;
        totalSecs: number;
        count: number;
        catSecs: Map<string, number>;
        ctxSecs: Map<string, number>;
      }
    >();
    for (const s of current) {
      const k = s.appName.toLowerCase();
      let e = appAgg.get(k);
      if (!e) {
        e = {
          appName: s.appName,
          processName: s.processName,
          totalSecs: 0,
          count: 0,
          catSecs: new Map(),
          ctxSecs: new Map(),
        };
        appAgg.set(k, e);
      }
      e.totalSecs += s.durationSecs;
      e.count += 1;
      e.catSecs.set(s.categoryId, (e.catSecs.get(s.categoryId) ?? 0) + s.durationSecs);
      if (s.domainContext) {
        e.ctxSecs.set(s.domainContext, (e.ctxSecs.get(s.domainContext) ?? 0) + s.durationSecs);
      }
    }

    const topApps: AppUsageItem[] = Array.from(appAgg.values())
      .map((a) => {
        let domCat = "neutral";
        let maxC = -1;
        a.catSecs.forEach((v, k) => {
          if (v > maxC) {
            maxC = v;
            domCat = k;
          }
        });
        let topCtx: string | null = null;
        let maxCtx = -1;
        a.ctxSecs.forEach((v, k) => {
          if (v > maxCtx) {
            maxCtx = v;
            topCtx = k;
          }
        });
        const cat = catMap.get(domCat);
        return {
          appName: a.appName,
          processName: a.processName,
          categoryId: domCat,
          categoryName: cat?.name ?? "Neutral",
          categoryColor: cat?.color ?? "#8A8478",
          totalSecs: a.totalSecs,
          sharePct: totalActiveSecs > 0 ? Math.round((a.totalSecs / totalActiveSecs) * 1000) / 10 : 0,
          sessionsCount: a.count,
          topContext: topCtx,
          iconDataUrl: null,
        };
      })
      .sort((a, b) => b.totalSecs - a.totalSecs);

    const hourlyMode = startDate === endDate;
    const buckets: TimeBucket[] = [];

    if (hourlyMode) {
      for (let h = 0; h < 24; h++) {
        const hs = current.filter((s) => new Date(s.startTs).getHours() === h);
        const bc: Record<string, number> = {};
        let t = 0;
        for (const s of hs) {
          t += s.durationSecs;
          bc[s.categoryId] = (bc[s.categoryId] ?? 0) + s.durationSecs;
        }
        buckets.push({
          key: String(h).padStart(2, "0"),
          label: `${String(h).padStart(2, "0")}:00`,
          totalSecs: t,
          score: this.calcScore(hs),
          byCategory: bc,
        });
      }
    } else {
      let cur = startDate;
      while (cur <= endDate) {
        const ds = current.filter((s) => s.date === cur);
        const bc: Record<string, number> = {};
        let t = 0;
        for (const s of ds) {
          t += s.durationSecs;
          bc[s.categoryId] = (bc[s.categoryId] ?? 0) + s.durationSecs;
        }
        buckets.push({
          key: cur,
          label: formatShortDateLabel(cur),
          totalSecs: t,
          score: this.calcScore(ds),
          byCategory: bc,
        });
        cur = addDays(cur, 1);
      }
    }

    return {
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      totalActiveSecs,
      productiveSecs,
      neutralSecs,
      distractingSecs,
      productivityScore: score,
      contextSwitchesPerHour: sw.perHr,
      totalContextSwitches: sw.count,
      activeComparison: this.compare(totalActiveSecs, prevTotalSecs),
      productiveComparison: this.compare(productiveSecs, prevProdSecs),
      scoreComparison: this.compare(score ?? 0, prevScore ?? 0),
      switchesComparison: this.compare(sw.perHr, prevSw.perHr),
      categories,
      topApps,
      buckets,
      hourlyMode,
    };
  }

  recategorize() {
    for (const s of this.sessions) {
      if (s.isManual) continue;
      const det = matchDetailed(s.appName, s.processName, s.windowTitle, this.rules);
      s.categoryId = det.categoryId;
      const sched = scheduleTagForTs(s.startTs);
      s.tags = det.tags.includes(sched) ? det.tags : [...det.tags, sched];
    }
  }

  logManualSession(
    title: string,
    categoryId: string,
    durationMins: number,
    tag: string | null
  ): ActivitySession {
    const now = Date.now();
    const durSecs = Math.max(1, durationMins) * 60;
    const tags = ["manual"];
    if (tag && tag.trim()) tags.push(tag.trim());
    tags.push(scheduleTagForTs(now));
    const sess: ActivitySession = {
      id: `manual-${now}`,
      date: toLocalDateString(new Date()),
      appName: "Manual Task",
      processName: "manual",
      windowTitle: title.trim(),
      domainContext: tag?.trim() || null,
      categoryId,
      startTs: now - durSecs * 1000,
      endTs: now,
      durationSecs: durSecs,
      iconKey: null,
      tags,
      isManual: true,
    };
    this.sessions.push(sess);
    return sess;
  }

  testRuleMatch(appName: string, windowTitle: string) {
    const procName = `${appName.trim().replace(/\s+/g, "")}.exe`;
    const ignored = this.ignoreRules.some((ig) =>
      ig.matchType === "windowTitle"
        ? patMatch(windowTitle, ig.pattern, ig.isRegex)
        : appPatMatch(appName, procName, ig.pattern, ig.isRegex)
    );
    const det = matchDetailed(appName, procName, windowTitle, this.rules);
    const sched = scheduleTagForTs(Date.now());
    const tags = det.tags.includes(sched) ? det.tags : [...det.tags, sched];
    return {
      categoryId: det.categoryId,
      matchedRuleId: det.matched?.id ?? null,
      matchedPattern: det.matched?.pattern ?? null,
      ignored,
      tags,
    };
  }

  getLimitStatuses(): DailyLimitStatus[] {
    const today = toLocalDateString(new Date());
    const todaySess = this.sessions.filter((s) => s.date === today);
    const catMap = new Map(this.categories.map((c) => [c.id, c]));

    return this.limits.map((limit) => {
      const limitSecs = Math.max(1, limit.dailyLimitMins) * 60;
      let usedSecs = 0;
      let label = limit.targetValue;
      let color = "#C84630";

      if (limit.targetType === "app") {
        const target = limit.targetValue.toLowerCase();
        usedSecs = todaySess
          .filter((s) => s.appName.toLowerCase() === target)
          .reduce((a, s) => a + s.durationSecs, 0);
      } else {
        usedSecs = todaySess
          .filter((s) => s.categoryId === limit.targetValue)
          .reduce((a, s) => a + s.durationSecs, 0);
        const cat = catMap.get(limit.targetValue);
        if (cat) {
          label = cat.name;
          color = cat.color;
        }
      }

      const remainingSecs = Math.max(0, limitSecs - usedSecs);
      const percent = Math.round((usedSecs / limitSecs) * 1000) / 10;
      const exceeded = limit.enabled && usedSecs >= limitSecs;
      const warning80 = limit.enabled && limit.notifyAt80 && percent >= 80 && !exceeded;
      return {
        limit,
        label,
        color,
        usedSecs,
        limitSecs,
        remainingSecs,
        percent,
        exceeded,
        warning80,
      };
    });
  }

  exportDownload(format: "csv" | "json", startDate: string, endDate: string): string {
    const sessions = this.sessions.filter((s) => s.date >= startDate && s.date <= endDate);
    let content: string;
    let mime: string;
    const filename = `desttraky_${startDate}_to_${endDate}.${format}`;

    if (format === "json") {
      const summary = this.getDashboardSummary(startDate, endDate);
      content = JSON.stringify({ exportedAt: new Date().toISOString(), summary, sessions }, null, 2);
      mime = "application/json";
    } else {
      const catMap = new Map(this.categories.map((c) => [c.id, c.name]));
      const esc = (v: string) =>
        v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
      const rows = [
        "Date,StartTimestampMs,EndTimestampMs,DurationSecs,AppName,ProcessName,Context,Category,Tags,WindowTitle",
        ...sessions.map((s) =>
          [
            esc(s.date),
            s.startTs,
            s.endTs,
            s.durationSecs,
            esc(s.appName),
            esc(s.processName),
            esc(s.domainContext ?? ""),
            esc(catMap.get(s.categoryId) ?? "Neutral"),
            esc((s.tags ?? []).join(";")),
            esc(s.windowTitle),
          ].join(",")
        ),
      ];
      content = "\uFEFF" + rows.join("\n");
      mime = "text/csv;charset=utf-8";
    }

    if (typeof document !== "undefined") {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    return filename;
  }
}

export const mockEngine = new BrowserMockEngine();
