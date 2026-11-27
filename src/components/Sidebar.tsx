import {
  Clock,
  Gauge,
  LayoutGrid,
  Moon,
  Settings,
  SlidersHorizontal,
  Sun,
  Timer,
} from "lucide-react";
import type { FocusRuntimeState, LiveTrackingStatus, NavTab } from "../types/pulsetrack";
import { formatDuration } from "../lib/format";
import { BrandLogo } from "./BrandLogo";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  live: LiveTrackingStatus;
  focus: FocusRuntimeState;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "limits", label: "Limits", icon: Gauge },
  { id: "rules", label: "Rules", icon: SlidersHorizontal },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  live,
  focus,
  theme,
  onToggleTheme,
}: SidebarProps) {
  return (
    <aside className="w-[58px] h-full shrink-0 bg-surface border-r border-borderSubtle flex flex-col items-center justify-between py-3.5 select-none z-20">
      {/* Top: Theme-aware DestTraky Logo + Icon Navigation */}
      <div className="flex flex-col items-center gap-3 w-full">
        <button
          type="button"
          onClick={() => onSelectTab("overview")}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105 focus:outline-none"
          aria-label="DestTraky"
          title="DestTraky"
        >
          <BrandLogo theme={theme} size={30} />
        </button>

        <div className="w-5 h-px bg-borderSubtle my-0.5" />

        <nav className="flex flex-col items-center gap-1.5 w-full" aria-label="Primary">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <div key={id} className="relative group w-full flex justify-center">
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-amberPulse" />
                )}
                <button
                  id={`nav-${id}`}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  aria-label={label}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    active
                      ? "bg-elevated text-amberPulse border border-borderStrong shadow-sm"
                      : "text-inkFaint hover:text-ink hover:bg-elevated/75 border border-transparent"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.9} />
                  {id === "focus" && focus.running && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amberPulse" />
                  )}
                </button>

                {/* Crisp floating dark tooltip */}
                <div className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 absolute left-[62px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#181714] text-[#F4F1E8] text-[11px] font-medium whitespace-nowrap shadow-lg">
                  {label}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Theme Toggle + Live Status Dot */}
      <div className="flex flex-col items-center gap-2.5">
        <div className="relative group">
          <button
            id="btn-theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-inkMuted hover:text-ink hover:bg-elevated transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 absolute left-[56px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#181714] text-[#F4F1E8] text-[11px] font-medium whitespace-nowrap shadow-lg">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </div>
        </div>

        <div className="relative group">
          <div className="w-8 h-8 rounded-full flex items-center justify-center border border-borderStrong bg-elevated cursor-default">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: live.paused
                  ? "#C84630"
                  : live.isIdle
                  ? "#8A8478"
                  : "#D97706",
              }}
            />
          </div>
          <div className="pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 absolute left-[52px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 rounded-lg bg-[#181714] text-[#F4F1E8] text-[11px] font-mono whitespace-nowrap shadow-lg">
            {live.paused
              ? "Paused · Incognito"
              : `${live.activeApp ?? "Active"} · ${formatDuration(live.todayTotalSecs)}`}
          </div>
        </div>
      </div>
    </aside>
  );
}
