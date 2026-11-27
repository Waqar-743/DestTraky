import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryBreakdownItem, TimeBucket } from "../../types/pulsetrack";
import { formatDuration, formatDurationCompact } from "../../lib/format";

interface ActivityBarChartProps {
  buckets: TimeBucket[];
  categories: CategoryBreakdownItem[];
  hiddenCategories: Set<string>;
  selectedBucketKey: string | null;
  hourlyMode: boolean;
  onToggleCategory: (catId: string) => void;
  onSelectBucket: (bucketKey: string | null) => void;
}

export function ActivityBarChart({
  buckets,
  categories,
  hiddenCategories,
  selectedBucketKey,
  hourlyMode,
  onToggleCategory,
  onSelectBucket,
}: ActivityBarChartProps) {
  const activeCats = categories.filter((c) => !hiddenCategories.has(c.categoryId));

  const data = buckets.map((b) => {
    const row: Record<string, string | number | null> = {
      key: b.key,
      label: b.label,
      score: b.score,
      totalMins: Math.round(b.totalSecs / 60),
    };
    for (const c of categories) {
      row[c.categoryId] = Math.round(((b.byCategory[c.categoryId] ?? 0) / 60) * 10) / 10;
    }
    return row;
  });

  return (
    <div className="pt-card p-4 flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">
            {hourlyMode ? "Hourly" : "Daily"} Activity
          </span>
          {selectedBucketKey && (
            <button
              type="button"
              onClick={() => onSelectBucket(null)}
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-elevated border border-borderStrong text-amberPulse hover:text-ink"
            >
              {selectedBucketKey} ×
            </button>
          )}
        </div>

        {/* Interactive Legend Filtering */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const hidden = hiddenCategories.has(cat.categoryId);
            return (
              <button
                key={cat.categoryId}
                type="button"
                onClick={() => onToggleCategory(cat.categoryId)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-opacity ${
                  hidden
                    ? "opacity-35 border-borderSubtle text-inkFaint"
                    : "border-borderSubtle bg-canvas text-inkMuted hover:text-ink"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
            onClick={(state) => {
              const payload = state?.activePayload?.[0]?.payload as { key?: string } | undefined;
              if (payload?.key) {
                onSelectBucket(selectedBucketKey === payload.key ? null : payload.key);
              }
            }}
          >
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
              interval={hourlyMode ? 2 : "preserveStartEnd"}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(m: number) => (m >= 60 ? `${(m / 60).toFixed(0)}h` : `${m}m`)}
            />
            <Tooltip
              cursor={{ fill: "var(--bg-elevated)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Record<string, unknown>;
                const totalMins = payload.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
                return (
                  <div className="pt-card border-borderStrong px-3 py-2 text-xs min-w-[160px]">
                    <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-borderSubtle">
                      <span className="font-mono font-semibold text-ink">{String(row.label)}</span>
                      <span className="font-mono tabular-nums text-inkMuted">
                        {formatDurationCompact(totalMins * 60)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {payload.map((entry) => {
                        const mins = Number(entry.value) || 0;
                        if (mins <= 0) return null;
                        return (
                          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-inkMuted">
                              <span
                                className="w-2 h-2 rounded-sm"
                                style={{ backgroundColor: String(entry.color) }}
                              />
                              {entry.name}
                            </span>
                            <span className="font-mono tabular-nums text-ink">
                              {formatDuration(mins * 60)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {row.score !== null && row.score !== undefined && (
                      <div className="mt-1.5 pt-1 border-t border-borderSubtle flex items-center justify-between font-mono text-[11px]">
                        <span className="text-inkFaint">Score</span>
                        <span className="text-amberPulse font-semibold">{String(row.score)}</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {activeCats.map((cat, idx) => (
              <Bar
                key={cat.categoryId}
                dataKey={cat.categoryId}
                name={cat.name}
                stackId="activity"
                fill={cat.color}
                radius={idx === activeCats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={26}
                className="cursor-pointer"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
