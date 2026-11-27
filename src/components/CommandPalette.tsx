import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Clock,
  Download,
  EyeOff,
  Gauge,
  Moon,
  Play,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  Timer,
} from "lucide-react";
import type { AppUsageItem, NavTab } from "../types/pulsetrack";
import { formatDuration } from "../lib/format";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  apps: AppUsageItem[];
  paused: boolean;
  theme: "dark" | "light";
  onNavigate: (tab: NavTab) => void;
  onInspectApp: (appName: string) => void;
  onTogglePause: () => void;
  onToggleTheme: () => void;
  onStartFocus: () => void;
  onExport: (format: "csv" | "json") => void;
}

export function CommandPalette({
  open,
  onClose,
  apps,
  paused,
  theme,
  onNavigate,
  onInspectApp,
  onTogglePause,
  onToggleTheme,
  onStartFocus,
  onExport,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const actions = useMemo(
    () => [
      { id: "nav-overview", label: "Overview", group: "Navigate", icon: BarChart3, run: () => onNavigate("overview") },
      { id: "nav-timeline", label: "Timeline", group: "Navigate", icon: Clock, run: () => onNavigate("timeline") },
      { id: "nav-focus", label: "Focus", group: "Navigate", icon: Timer, run: () => onNavigate("focus") },
      { id: "nav-limits", label: "Limits", group: "Navigate", icon: Gauge, run: () => onNavigate("limits") },
      { id: "nav-rules", label: "Rules", group: "Navigate", icon: SlidersHorizontal, run: () => onNavigate("rules") },
      { id: "nav-settings", label: "Settings", group: "Navigate", icon: Settings, run: () => onNavigate("settings") },
      {
        id: "act-pause",
        label: paused ? "Resume Tracking" : "Pause Tracking (Incognito)",
        group: "Action",
        icon: paused ? Play : EyeOff,
        run: onTogglePause,
      },
      { id: "act-focus", label: "Start Focus Timer", group: "Action", icon: Timer, run: onStartFocus },
      {
        id: "act-theme",
        label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        group: "Action",
        icon: theme === "dark" ? Sun : Moon,
        run: onToggleTheme,
      },
      { id: "act-csv", label: "Export CSV", group: "Action", icon: Download, run: () => onExport("csv") },
      { id: "act-json", label: "Export JSON", group: "Action", icon: Download, run: () => onExport("json") },
    ],
    [paused, theme, onNavigate, onTogglePause, onToggleTheme, onStartFocus, onExport]
  );

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filteredActions = actions.filter((a) => !q || a.label.toLowerCase().includes(q));
  const filteredApps = apps
    .filter((a) => !q || a.appName.toLowerCase().includes(q) || (a.topContext ?? "").toLowerCase().includes(q))
    .slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[13vh] bg-black/55 backdrop-blur-[3px] p-4"
      onClick={onClose}
    >
      <div
        className="pt-card w-full max-w-lg overflow-hidden border-borderStrong animate-pt-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-borderSubtle">
          <Search className="w-4 h-4 text-inkFaint shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps, views, actions..."
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-inkFaint outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-elevated border border-borderSubtle text-inkMuted">
            ESC
          </kbd>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 space-y-2">
          {filteredApps.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-inkFaint">
                Apps
              </div>
              {filteredApps.map((app) => (
                <button
                  key={app.appName}
                  type="button"
                  onClick={() => {
                    onInspectApp(app.appName);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-elevated transition-colors"
                >
                  <span className="flex items-center gap-2 text-ink font-medium">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: app.categoryColor }} />
                    {app.appName}
                  </span>
                  <span className="font-mono tabular-nums text-inkMuted">
                    {formatDuration(app.totalSecs)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredActions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-inkFaint">
                Commands
              </div>
              {filteredActions.map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      act.run();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-ink hover:bg-elevated transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5 text-inkMuted" />
                      <span>{act.label}</span>
                    </span>
                    <span className="text-[10px] font-mono text-inkFaint">{act.group}</span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredApps.length === 0 && filteredActions.length === 0 && (
            <div className="py-8 text-center text-xs font-mono text-inkFaint">No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}
