import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeBucket } from "../../types/pulsetrack";

interface ScoreTrendChartProps {
  buckets: TimeBucket[];
}

export function ScoreTrendChart({ buckets }: ScoreTrendChartProps) {
  const data = buckets
    .filter((b) => b.score !== null)
    .map((b) => ({
      label: b.label,
      score: b.score ?? 0,
    }));

  return (
    <div className="pt-card p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">
          Focus Trend
        </span>
        <span className="text-[11px] font-mono text-inkFaint">Target 70</span>
      </div>

      <div className="h-[170px] w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-inkFaint">
            No score data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="amberScoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D98A1C" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#D98A1C" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--border-subtle)"
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={{ stroke: "var(--border-subtle)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine y={70} stroke="#8A8478" strokeDasharray="3 3" strokeOpacity={0.6} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0].payload as { label: string; score: number };
                  return (
                    <div className="pt-card border-borderStrong px-2.5 py-1.5 text-xs font-mono">
                      <span className="text-inkMuted">{pt.label}</span>
                      <span className="mx-2 text-borderStrong">|</span>
                      <span className="text-amberPulse font-semibold">{pt.score}/100</span>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#D98A1C"
                strokeWidth={2}
                fill="url(#amberScoreGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#D98A1C", stroke: "var(--bg-surface)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
