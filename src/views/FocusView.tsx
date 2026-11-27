import { Flame, Pause, Play, RotateCcw, ShieldAlert } from "lucide-react";
import type { FocusConfig, FocusRuntimeState, FocusSessionRecord } from "../types/pulsetrack";
import { formatClock } from "../lib/format";
import { FocusStreakChart } from "../components/charts/FocusStreakChart";
import { isTauriRuntime } from "../lib/bridge";
import { mockEngine } from "../lib/mockEngine";

interface FocusViewProps {
  focus: FocusRuntimeState;
  history: FocusSessionRecord[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onUpdateConfig: (cfg: FocusConfig) => void;
}

const PHASE_LABEL: Record<FocusRuntimeState["phase"], string> = {
  idle: "Ready",
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

export function FocusView({
  focus,
  history,
  onStart,
  onPause,
  onResume,
  onReset,
  onUpdateConfig,
}: FocusViewProps) {
  const progress =
    focus.totalSecs > 0 ? 1 - focus.remainingSecs / focus.totalSecs : 0;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  const handlePrimary = () => {
    if (focus.running) onPause();
    else if (focus.phase === "idle") onStart();
    else onResume();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Chronograph Timer */}
      <div className="lg:col-span-7 pt-card p-6 flex flex-col items-center justify-between gap-6">
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">
            {PHASE_LABEL[focus.phase]}
          </span>
          <div className="flex items-center gap-2">
            {!isTauriRuntime() && focus.running && focus.phase === "focus" && (
              <button
                type="button"
                onClick={() => mockEngine.simulateDistraction()}
                className="pt-btn-ghost px-2 py-1 text-[11px] font-mono text-rustPulse"
              >
                Test Alert
              </button>
            )}
            <span className="text-xs font-mono tabular-nums text-amberPulse flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              {focus.currentStreakDays}d
            </span>
          </div>
        </div>

        {/* SVG Circular Chronograph */}
        <div className="relative w-56 h-56 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="8"
            />
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={focus.phase === "focus" || focus.phase === "idle" ? "#D98A1C" : "#8A8478"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-mono font-semibold tabular-nums tracking-tight text-ink">
              {formatClock(focus.remainingSecs)}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-inkFaint mt-1">
              {focus.completedCyclesToday} cycles today
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5">
          <button
            id="btn-focus-primary"
            type="button"
            onClick={handlePrimary}
            className="pt-btn-primary px-6 py-2.5 text-xs font-semibold flex items-center gap-2"
          >
            {focus.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{focus.running ? "Pause" : focus.phase === "idle" ? "Start" : "Resume"}</span>
          </button>
          <button
            id="btn-focus-reset"
            type="button"
            onClick={onReset}
            className="pt-btn-ghost p-2.5"
            aria-label="Reset timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Duration Config */}
        <div className="w-full grid grid-cols-3 gap-2.5 pt-4 border-t border-borderSubtle">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-inkFaint">Focus (m)</span>
            <input
              type="number"
              min={5}
              max={120}
              value={focus.config.focusMins}
              onChange={(e) =>
                onUpdateConfig({
                  ...focus.config,
                  focusMins: Math.max(5, Math.min(120, Number(e.target.value) || 25)),
                })
              }
              className="pt-input font-mono text-xs tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-inkFaint">Short (m)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={focus.config.shortBreakMins}
              onChange={(e) =>
                onUpdateConfig({
                  ...focus.config,
                  shortBreakMins: Math.max(1, Math.min(30, Number(e.target.value) || 5)),
                })
              }
              className="pt-input font-mono text-xs tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-inkFaint">Long (m)</span>
            <input
              type="number"
              min={5}
              max={60}
              value={focus.config.longBreakMins}
              onChange={(e) =>
                onUpdateConfig({
                  ...focus.config,
                  longBreakMins: Math.max(5, Math.min(60, Number(e.target.value) || 15)),
                })
              }
              className="pt-input font-mono text-xs tabular-nums"
            />
          </label>
        </div>

        <label className="w-full flex items-center justify-between pt-1 cursor-pointer">
          <span className="flex items-center gap-2 text-xs text-inkMuted">
            <ShieldAlert className="w-3.5 h-3.5 text-rustPulse" />
            <span>Distraction alert</span>
          </span>
          <input
            type="checkbox"
            checked={focus.config.warnOnDistraction}
            onChange={(e) =>
              onUpdateConfig({ ...focus.config, warnOnDistraction: e.target.checked })
            }
            className="w-4 h-4 accent-[#D98A1C]"
          />
        </label>
      </div>

      {/* Right: Metrics + 7D Bar Chart */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="pt-card px-3.5 py-3">
            <div className="text-[10px] font-mono uppercase text-inkFaint">Streak</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-amberPulse mt-1">
              {focus.currentStreakDays}d
            </div>
          </div>
          <div className="pt-card px-3.5 py-3">
            <div className="text-[10px] font-mono uppercase text-inkFaint">Today</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-ink mt-1">
              {focus.completedCyclesToday}
            </div>
          </div>
          <div className="pt-card px-3.5 py-3">
            <div className="text-[10px] font-mono uppercase text-inkFaint">Alerts</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-rustPulse mt-1">
              {focus.distractionsInSession}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <FocusStreakChart sessions={history} />
        </div>
      </div>
    </div>
  );
}
