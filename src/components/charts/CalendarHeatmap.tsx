import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import type { ActivitySession } from "../../types/pulsetrack";
import { addDays, formatDurationCompact, formatShortDateLabel, toLocalDateString } from "../../lib/format";

interface CalendarHeatmapProps {
  sessions: ActivitySession[];
  selectedDate: string;
  onPickDate: (date: string) => void;
}

/**
 * Tockler-inspired 28-day activity intensity strip rendered strictly in warm Burnished Amber steps.
 */
export function CalendarHeatmap({ sessions, selectedDate, onPickDate }: CalendarHeatmapProps) {
  const days = useMemo(() => {
    const today = toLocalDateString(new Date());
    const byDate = new Map<string, number>();
    for (const s of sessions) {
      byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.durationSecs);
    }
    const maxSecs = Math.max(3600, ...Array.from(byDate.values()));

    return Array.from({ length: 28 }, (_, i) => {
      const date = addDays(today, i - 27);
      const secs = byDate.get(date) ?? 0;
      const ratio = secs / maxSecs;
      return {
        date,
        label: formatShortDateLabel(date),
        secs,
        level: secs === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.55 ? 2 : ratio < 0.8 ? 3 : 4,
      };
    });
  }, [sessions]);

  const bgForLevel = (lvl: number) => {
    switch (lvl) {
      case 1:
        return "rgba(217, 119, 6, 0.20)";
      case 2:
        return "rgba(217, 119, 6, 0.44)";
      case 3:
        return "rgba(217, 119, 6, 0.72)";
      case 4:
        return "#D97706";
      default:
        return "var(--bg-elevated)";
    }
  };

  return (
    <div className="pt-card px-5 py-3.5 animate-pt-in">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-amberPulse shrink-0" strokeWidth={1.85} />
          <span className="text-xs font-semibold text-ink">28-Day Activity</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-inkFaint">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span
              key={l}
              className="w-2.5 h-2.5 rounded-[3px] border border-borderSubtle/60"
              style={{ backgroundColor: bgForLevel(l) }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}
      >
        {days.map((d) => {
          const active = d.date === selectedDate;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onPickDate(d.date)}
              title={`${d.label}: ${d.secs > 0 ? formatDurationCompact(d.secs) : "0m"}`}
              className={`h-6 rounded-md transition-transform hover:scale-110 focus:outline-none ${
                active ? "ring-2 ring-ink" : "border border-borderSubtle/50"
              }`}
              style={{ backgroundColor: bgForLevel(d.level) }}
            />
          );
        })}
      </div>
    </div>
  );
}
