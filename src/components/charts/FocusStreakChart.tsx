import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FocusSessionRecord } from "../../types/pulsetrack";
import { addDays, formatShortDateLabel, toLocalDateString } from "../../lib/format";

interface FocusStreakChartProps {
  sessions: FocusSessionRecord[];
}

export function FocusStreakChart({ sessions }: FocusStreakChartProps) {
  const today = toLocalDateString(new Date());
  const data = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const mins = Math.round(
      sessions
        .filter((s) => s.date === date && s.completed)
        .reduce((acc, s) => acc + s.completedSecs, 0) / 60
    );
    return {
      date,
      label: formatShortDateLabel(date),
      mins,
    };
  });

  return (
    <div className="pt-card p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">7D Focus</span>
        <span className="text-[11px] font-mono text-inkFaint">Minutes</span>
      </div>
      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--bg-elevated)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { label: string; mins: number };
                return (
                  <div className="pt-card border-borderStrong px-2.5 py-1.5 text-xs font-mono">
                    <span className="text-inkMuted">{d.label}</span>
                    <span className="mx-2 text-borderStrong">|</span>
                    <span className="text-amberPulse font-semibold">{d.mins}m</span>
                  </div>
                );
              }}
            />
            <Bar dataKey="mins" fill="#D98A1C" radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
