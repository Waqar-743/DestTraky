import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryBreakdownItem } from "../../types/pulsetrack";
import { formatDuration } from "../../lib/format";

interface CategoryDonutChartProps {
  categories: CategoryBreakdownItem[];
  score: number | null;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
}

export function CategoryDonutChart({
  categories,
  score,
  selectedCategoryId,
  onSelectCategory,
}: CategoryDonutChartProps) {
  const nonZero = categories.filter((c) => c.totalSecs > 0);

  return (
    <div className="pt-card p-4 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">Split</span>
        {selectedCategoryId && (
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className="text-[11px] font-mono text-amberPulse hover:text-ink"
          >
            Reset ×
          </button>
        )}
      </div>

      <div className="relative h-[180px] w-full flex items-center justify-center">
        {nonZero.length === 0 ? (
          <div className="text-xs font-mono text-inkFaint">No data</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={nonZero}
                  dataKey="totalSecs"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                  onClick={(entry: CategoryBreakdownItem) =>
                    onSelectCategory(
                      selectedCategoryId === entry.categoryId ? null : entry.categoryId
                    )
                  }
                >
                  {nonZero.map((entry) => {
                    const dimmed =
                      selectedCategoryId !== null && selectedCategoryId !== entry.categoryId;
                    return (
                      <Cell
                        key={entry.categoryId}
                        fill={entry.color}
                        fillOpacity={dimmed ? 0.28 : 1}
                        className="cursor-pointer outline-none"
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as CategoryBreakdownItem;
                    return (
                      <div className="pt-card border-borderStrong px-2.5 py-1.5 text-xs">
                        <div className="font-medium text-ink">{item.name}</div>
                        <div className="font-mono tabular-nums text-inkMuted">
                          {formatDuration(item.totalSecs)} · {item.sharePct}%
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-mono font-semibold tabular-nums text-ink">
                {score !== null ? score : "—"}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-inkFaint">
                Score
              </span>
            </div>
          </>
        )}
      </div>

      {/* Compact inline breakdown */}
      <div className="space-y-1.5 mt-2">
        {categories.slice(0, 4).map((c) => {
          const active = selectedCategoryId === c.categoryId;
          return (
            <button
              key={c.categoryId}
              type="button"
              onClick={() => onSelectCategory(active ? null : c.categoryId)}
              className={`w-full flex items-center justify-between text-xs px-2 py-1 rounded-md transition-colors ${
                active ? "bg-elevated text-ink" : "hover:bg-elevated/60 text-inkMuted"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: c.color }} />
                <span className="truncate">{c.name}</span>
              </span>
              <span className="font-mono tabular-nums text-ink shrink-0">
                {c.sharePct}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
