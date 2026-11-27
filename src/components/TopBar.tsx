import { useState } from "react";
import { Download, EyeOff, Flame, Play, Search } from "lucide-react";
import type { FocusRuntimeState, LiveTrackingStatus, NavTab } from "../types/pulsetrack";
import { formatDuration } from "../lib/format";
import { BrandLogo } from "./BrandLogo";

interface TopBarProps {
  activeTab: NavTab;
  live: LiveTrackingStatus;
  focus: FocusRuntimeState;
  theme: "dark" | "light";
  onSelectTab: (tab: NavTab) => void;
  onOpenCommand: () => void;
  onTogglePause: () => void;
  onExport: (format: "csv" | "json") => void;
}

const TITLES: Record<NavTab, string> = {
  overview: "Overview",
  timeline: "Timeline",
  focus: "Focus",
  limits: "Limits",
  rules: "Rules",
  settings: "Settings",
};

export function TopBar({
  activeTab,
  live,
  focus,
  theme,
  onSelectTab,
  onOpenCommand,
  onTogglePause,
  onExport,
}: TopBarProps) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <header className="h-14 shrink-0 px-6 bg-surface border-b border-borderSubtle flex items-center justify-between gap-4">
      {/* Left breadcrumb + compact live pill */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-xs shrink-0">
          <BrandLogo theme={theme} size={20} />
          <span className="font-semibold tracking-tight text-ink">DestTraky</span>
          <span className="text-borderStrong">/</span>
          <span className="text-inkMuted font-medium">{TITLES[activeTab]}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-borderSubtle">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-canvas border border-borderSubtle text-[11px] font-mono text-inkMuted">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: live.paused
                  ? "#C84630"
                  : live.isIdle
                  ? "#8A8478"
                  : "#D97706",
              }}
            />
            <span className="text-ink font-medium truncate max-w-[110px]">
              {live.paused ? "Paused" : live.activeApp ?? "Idle"}
            </span>
            <span className="text-inkFaint">·</span>
            <span className="tabular-nums">{formatDuration(live.todayTotalSecs)}</span>
          </span>

          <button
            type="button"
            onClick={() => onSelectTab("focus")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amberPulse/12 text-amberPulse text-[11px] font-mono font-medium hover:bg-amberPulse/20 transition-colors"
            title="Daily Focus"
          >
            <Flame className="w-3 h-3" />
            <span>{focus.currentStreakDays}d</span>
            <span className="opacity-70">
              ({focus.completedCyclesToday}/{Math.max(1, focus.config.cyclesBeforeLongBreak)})
            </span>
          </button>
        </div>
      </div>

      {/* Center ⌘K search bar */}
      <button
        id="btn-command-palette"
        type="button"
        onClick={onOpenCommand}
        className="hidden sm:flex items-center justify-between gap-3 w-full max-w-sm px-3.5 py-1.5 rounded-xl bg-canvas border border-borderSubtle hover:border-borderStrong transition-colors text-xs text-inkFaint"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Search apps, titles, actions...</span>
        </span>
        <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-surface border border-borderSubtle text-inkMuted shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button
            id="btn-export-menu"
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            className="pt-btn-ghost px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          {exportOpen && (
            <div
              className="absolute right-0 mt-1.5 w-32 pt-card p-1 z-30 border-borderStrong"
              onMouseLeave={() => setExportOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExport("csv");
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-ink hover:bg-elevated font-mono"
              >
                CSV (.csv)
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  onExport("json");
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-ink hover:bg-elevated font-mono"
              >
                JSON (.json)
              </button>
            </div>
          )}
        </div>

        <button
          id="btn-pause-toggle"
          type="button"
          onClick={onTogglePause}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            live.paused
              ? "bg-rustPulse text-[#fffdf8] hover:brightness-110"
              : "pt-btn-primary"
          }`}
        >
          {live.paused ? (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Pause</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
