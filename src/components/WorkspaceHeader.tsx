import {
  Calendar,
  Clock,
  Gauge,
  LayoutGrid,
  Settings,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import type { DateRangePreset, NavTab } from "../types/pulsetrack";

interface WorkspaceHeaderProps {
  activeTab: NavTab;
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  onSelectTab: (tab: NavTab) => void;
  onSelectPreset: (preset: DateRangePreset) => void;
  onCustomRange: (start: string, end: string) => void;
}

const NAV_TABS: { id: NavTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "limits", label: "Limits", icon: Gauge },
  { id: "rules", label: "Rules", icon: SlidersHorizontal },
  { id: "settings", label: "Settings", icon: Settings },
];

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7Days", label: "7D" },
  { id: "last30Days", label: "30D" },
  { id: "custom", label: "Custom" },
];

export function WorkspaceHeader({
  activeTab,
  preset,
  startDate,
  endDate,
  onSelectTab,
  onSelectPreset,
  onCustomRange,
}: WorkspaceHeaderProps) {
  const current = NAV_TABS.find((t) => t.id === activeTab) ?? NAV_TABS[0];
  const ActiveIcon = current.icon;
  const showDateRange =
    activeTab === "overview" ||
    activeTab === "timeline" ||
    activeTab === "focus" ||
    activeTab === "limits";

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto mb-5">
      {/* Row 1: Page Icon + Title (left) & Persistent Date Range Filter (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ActiveIcon className="w-6 h-6 text-amberPulse shrink-0" strokeWidth={1.8} />
          <h1 className="text-lg font-semibold tracking-tight text-ink">{current.label}</h1>
        </div>

        {showDateRange && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 bg-surface p-1 rounded-xl border border-borderSubtle">
              <Calendar className="w-3.5 h-3.5 text-inkFaint ml-2 mr-1" />
              {PRESETS.map((p) => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    id={`range-${p.id}`}
                    type="button"
                    onClick={() => onSelectPreset(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? "bg-elevated text-ink font-semibold shadow-sm"
                        : "text-inkMuted hover:text-ink"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {preset === "custom" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => onCustomRange(e.target.value, endDate)}
                  className="pt-input py-1 px-2 text-xs font-mono"
                />
                <span className="text-inkFaint text-xs">→</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => onCustomRange(startDate, e.target.value)}
                  className="pt-input py-1 px-2 text-xs font-mono"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Persistent Horizontal Underline Tabs on ALL pages (zero scrollbar arrows) */}
      <nav
        className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-borderSubtle text-xs overflow-hidden no-scrollbar"
        aria-label="Workspace tabs"
      >
        {NAV_TABS.map(({ id, label, icon: TabIcon }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              onClick={() => onSelectTab(id)}
              className={`relative pb-2.5 pt-0.5 inline-flex items-center gap-2 font-medium whitespace-nowrap transition-colors ${
                active ? "text-ink font-semibold" : "text-inkMuted hover:text-ink"
              }`}
            >
              <TabIcon
                className={`w-4 h-4 ${active ? "text-amberPulse" : "text-inkFaint"}`}
                strokeWidth={1.85}
              />
              <span>{label}</span>
              {active && (
                <span className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-ink" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
