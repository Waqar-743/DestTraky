import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Clock,
  Flame,
  Target,
} from "lucide-react";
import type {
  ActivitySession,
  DailyLimitStatus,
  DashboardSummary,
  DateRangePreset,
  NavTab,
  PeriodComparison,
} from "../types/pulsetrack";
import { formatDelta, formatDuration, formatDurationLive, toLocalDateString } from "../lib/format";
import { ColumnScoreChart } from "../components/charts/ColumnScoreChart";
import { ActivityMixBar } from "../components/charts/ActivityMixBar";
import { TopAppsTable } from "../components/charts/TopAppsTable";
import { SessionFlowerChart } from "../components/charts/SessionFlowerChart";
import { CalendarHeatmap } from "../components/charts/CalendarHeatmap";

interface OverviewViewProps {
  summary: DashboardSummary | null;
  sessions: ActivitySession[];
  heatmapSessions: ActivitySession[];
  limits: DailyLimitStatus[];
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  onPickDate: (date: string) => void;
  onSelectTab: (tab: NavTab) => void;
  onInspectApp: (appName: string) => void;
}

function TrendLine({
  comp,
  invertGood = false,
}: {
  comp: PeriodComparison;
  invertGood?: boolean;
}) {
  if (comp.deltaPct === null) {
    return <span className="text-[11px] font-mono text-inkFaint">No prior period</span>;
  }
  const positive = comp.deltaPct >= 0;
  const favorable = invertGood ? !positive : positive;
  const color =
    comp.deltaPct === 0 ? "text-inkFaint" : favorable ? "text-amberPulse" : "text-rustPulse";

  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span
        className={`inline-flex items-center font-mono font-semibold tabular-nums ${color}`}
      >
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {formatDelta(comp.deltaPct)}
      </span>
      <span className="text-inkFaint">vs prev</span>
    </span>
  );
}

export function OverviewView({
  summary,
  sessions,
  heatmapSessions,
  limits,
  preset,
  startDate,
  endDate,
  onPickDate,
  onSelectTab,
  onInspectApp,
}: OverviewViewProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

  const filteredApps = useMemo(() => {
    if (!summary) return [];
    if (!selectedCategoryId && !selectedBucketKey) {
      return summary.topApps;
    }

    const bucketFiltered = sessions.filter((s) => {
      if (selectedCategoryId && s.categoryId !== selectedCategoryId) return false;
      if (selectedBucketKey) {
        if (summary.hourlyMode) {
          const h = String(new Date(s.startTs).getHours()).padStart(2, "0");
          if (h !== selectedBucketKey) return false;
        } else if (s.date !== selectedBucketKey) {
          return false;
        }
      }
      return true;
    });

    const total = bucketFiltered.reduce((acc, s) => acc + s.durationSecs, 0);
    const catMap = new Map(summary.categories.map((c) => [c.categoryId, c]));
    const iconMap = new Map(summary.topApps.map((a) => [a.appName.toLowerCase(), a.iconDataUrl]));

    const map = new Map<
      string,
      {
        appName: string;
        processName: string;
        categoryId: string;
        totalSecs: number;
        count: number;
        topContext: string | null;
      }
    >();
    for (const s of bucketFiltered) {
      const k = s.appName.toLowerCase();
      const prev = map.get(k);
      if (!prev) {
        map.set(k, {
          appName: s.appName,
          processName: s.processName,
          categoryId: s.categoryId,
          totalSecs: s.durationSecs,
          count: 1,
          topContext: s.domainContext,
        });
      } else {
        prev.totalSecs += s.durationSecs;
        prev.count += 1;
        if (!prev.topContext && s.domainContext) prev.topContext = s.domainContext;
      }
    }

    return Array.from(map.values())
      .map((a) => {
        const cat = catMap.get(a.categoryId);
        return {
          appName: a.appName,
          processName: a.processName,
          categoryId: a.categoryId,
          categoryName: cat?.name ?? "Neutral",
          categoryColor: cat?.color ?? "#8A8478",
          totalSecs: a.totalSecs,
          sharePct: total > 0 ? Math.round((a.totalSecs / total) * 1000) / 10 : 0,
          sessionsCount: a.count,
          topContext: a.topContext,
          iconDataUrl: iconMap.get(a.appName.toLowerCase()) ?? null,
        };
      })
      .sort((a, b) => b.totalSecs - a.totalSecs);
  }, [summary, sessions, selectedCategoryId, selectedBucketKey]);

  const limitByApp = useMemo(() => {
    const map = new Map<string, DailyLimitStatus>();
    limits
      .filter((l) => l.limit.targetType === "app" && l.limit.enabled)
      .forEach((l) => map.set(l.limit.targetValue.toLowerCase(), l));
    return map;
  }, [limits]);

  if (!summary) {
    return (
      <div className="h-full flex items-center justify-center text-xs font-mono text-inkFaint">
        Loading...
      </div>
    );
  }

  const isEmpty = summary.totalActiveSecs === 0;
  const todayStr = toLocalDateString(new Date());
  const includesToday = startDate <= todayStr && endDate >= todayStr;
  const fmtKpi = includesToday ? formatDurationLive : formatDuration;
  const rangeLabel =
    preset === "today"
      ? "Today"
      : preset === "yesterday"
      ? "Yesterday"
      : preset === "last7Days"
      ? "7 Days"
      : preset === "last30Days"
      ? "30 Days"
      : `${startDate} → ${endDate}`;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* 4 Crisp KPI Cards — larger 24px background-free icons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          {
            label: "Active Time",
            value: isEmpty ? "0s" : fmtKpi(summary.totalActiveSecs),
            comp: summary.activeComparison,
            icon: Clock,
            accent: "#D97706",
            invert: false,
          },
          {
            label: "Focus Score",
            value: summary.productivityScore !== null ? `${summary.productivityScore}` : "—",
            suffix: summary.productivityScore !== null ? "/100" : "",
            comp: summary.scoreComparison,
            icon: Target,
            accent: "#B45309",
            invert: false,
          },
          {
            label: "Productive",
            value: isEmpty ? "0s" : fmtKpi(summary.productiveSecs),
            comp: summary.productiveComparison,
            icon: Flame,
            accent: "#9E7B3B",
            invert: false,
          },
          {
            label: "Switches / hr",
            value: summary.contextSwitchesPerHour.toFixed(1),
            comp: summary.switchesComparison,
            icon: ArrowLeftRight,
            accent: "#C84630",
            invert: true,
          },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="pt-card pt-card-interactive relative overflow-hidden p-4 animate-pt-in"
              style={{ animationDelay: `${idx * 45}ms` }}
            >
              <div className="pt-dot-corner absolute top-0 right-0 w-24 h-16 opacity-80 pointer-events-none" />
              <div className="relative flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-inkMuted">{kpi.label}</span>
                <Icon
                  className="w-6 h-6 shrink-0"
                  style={{ color: kpi.accent }}
                  strokeWidth={1.75}
                />
              </div>
              <div className="relative flex items-baseline gap-1 mb-1.5">
                <span className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-ink">
                  {kpi.value}
                </span>
                {kpi.suffix && (
                  <span className="text-xs font-mono text-inkFaint">{kpi.suffix}</span>
                )}
              </div>
              <div className="relative">
                <TrendLine comp={kpi.comp} invertGood={kpi.invert} />
              </div>
            </div>
          );
        })}
      </div>

      {isEmpty ? (
        <div className="pt-card py-20 flex flex-col items-center justify-center gap-2 text-center">
          <div className="text-sm font-mono text-ink">No activity recorded</div>
          <div className="text-xs font-mono text-inkFaint">{rangeLabel}</div>
        </div>
      ) : (
        <>
          {/* Row 1: Hatched Pill Columns (+ Waves Toggle) & Activity Mix Leader-Line Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <ColumnScoreChart
                buckets={summary.buckets}
                categories={summary.categories}
                overallScore={summary.productivityScore}
                hourlyMode={summary.hourlyMode}
                selectedBucketKey={selectedBucketKey}
                onSelectBucket={setSelectedBucketKey}
              />
            </div>
            <div className="lg:col-span-5">
              <ActivityMixBar
                totalActiveSecs={summary.totalActiveSecs}
                categories={summary.categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                rangeLabel={rangeLabel}
              />
            </div>
          </div>

          {/* Row 2: Segmented Micro-Bar Top Apps Table & 6-Petal Radial Session Anatomy Flower */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <TopAppsTable
                apps={filteredApps}
                productiveSecs={summary.productiveSecs}
                totalActiveSecs={summary.totalActiveSecs}
                limitByApp={limitByApp}
                hasFilter={selectedCategoryId !== null || selectedBucketKey !== null}
                onClearFilter={() => {
                  setSelectedCategoryId(null);
                  setSelectedBucketKey(null);
                }}
                onInspectApp={onInspectApp}
              />
            </div>
            <div className="lg:col-span-5">
              <SessionFlowerChart
                totalActiveSecs={summary.totalActiveSecs}
                productiveSecs={summary.productiveSecs}
                neutralSecs={summary.neutralSecs}
                distractingSecs={summary.distractingSecs}
                score={summary.productivityScore}
                totalSwitches={summary.totalContextSwitches}
                categories={summary.categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                onOpenTimeline={() => onSelectTab("timeline")}
              />
            </div>
          </div>

          {/* Row 3: Tockler-inspired 28-Day Activity Intensity Heatmap */}
          <CalendarHeatmap
            sessions={heatmapSessions}
            selectedDate={endDate}
            onPickDate={onPickDate}
          />
        </>
      )}
    </div>
  );
}
