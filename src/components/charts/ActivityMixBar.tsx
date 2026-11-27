import { PieChart } from "lucide-react";
import type { CategoryBreakdownItem } from "../../types/pulsetrack";
import { formatDuration, formatDurationCompact } from "../../lib/format";

interface ActivityMixBarProps {
  totalActiveSecs: number;
  categories: CategoryBreakdownItem[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  rangeLabel: string;
}

export function ActivityMixBar({
  totalActiveSecs,
  categories,
  selectedCategoryId,
  onSelectCategory,
  rangeLabel,
}: ActivityMixBarProps) {
  const activeCats = categories.filter((c) => c.totalSecs > 0);
  const topCallouts = activeCats.slice(0, 3);

  return (
    <div className="pt-card p-5 flex flex-col justify-between h-full animate-pt-in" style={{ animationDelay: "60ms" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <PieChart className="w-5 h-5 text-amberPulse shrink-0 mt-0.5" strokeWidth={1.8} />
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Activity mix</h2>
            <div className="text-xs text-inkMuted mt-0.5">Time by category</div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-elevated border border-borderSubtle text-[11px] font-mono text-inkMuted">
          {rangeLabel}
        </span>
      </div>

      {/* Big total */}
      <div className="mt-4 mb-5 flex items-baseline gap-2">
        <span className="text-3xl font-semibold font-mono tabular-nums tracking-tight text-ink">
          {formatDuration(totalActiveSecs)}
        </span>
        <span className="text-xs text-inkMuted">active</span>
      </div>

      {/* Proportional percentage callouts with hairline leader lines */}
      <div className="space-y-2">
        {topCallouts.length > 0 && (
          <div className="flex items-end gap-1.5">
            {topCallouts.map((c) => {
              const flexWeight = Math.max(16, c.sharePct);
              return (
                <div
                  key={c.categoryId}
                  className="min-w-0 flex flex-col justify-end"
                  style={{ flex: `${flexWeight} 1 0%` }}
                >
                  <div className="flex items-baseline gap-1.5 mb-1.5 truncate">
                    <span className="text-sm font-semibold font-mono tabular-nums text-ink">
                      {Math.round(c.sharePct)}%
                    </span>
                    <span className="text-[11px] font-mono text-inkFaint truncate">
                      {formatDurationCompact(c.totalSecs)}
                    </span>
                  </div>
                  <div className="h-14 border-l border-borderStrong/80 ml-0.5" />
                </div>
              );
            })}
          </div>
        )}

        {/* Thick segmented rounded pill bar */}
        <div className="flex items-center gap-1.5 h-3.5 w-full">
          {activeCats.length === 0 ? (
            <div className="h-full w-full rounded-full pt-hatch border border-borderSubtle" />
          ) : (
            activeCats.map((c, idx) => {
              const selected = selectedCategoryId === c.categoryId;
              const dimmed = selectedCategoryId !== null && !selected;
              return (
                <button
                  key={c.categoryId}
                  type="button"
                  title={`${c.name}: ${formatDuration(c.totalSecs)} (${c.sharePct}%)`}
                  onClick={() => onSelectCategory(selected ? null : c.categoryId)}
                  className="h-full rounded-full animate-pt-width transition-opacity hover:brightness-110 focus:outline-none"
                  style={{
                    flex: `${Math.max(4, c.sharePct)} 1 0%`,
                    backgroundColor: c.color,
                    opacity: dimmed ? 0.25 : 1,
                    animationDelay: `${idx * 70}ms`,
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Inline dot legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-borderSubtle">
        {categories.map((c) => {
          const active = selectedCategoryId === c.categoryId;
          return (
            <button
              key={c.categoryId}
              type="button"
              onClick={() => onSelectCategory(active ? null : c.categoryId)}
              className={`inline-flex items-center gap-1.5 text-xs transition-opacity ${
                selectedCategoryId && !active ? "opacity-40" : "opacity-100"
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-inkMuted">{c.name}</span>
              <span className="font-mono tabular-nums text-inkFaint">
                {formatDurationCompact(c.totalSecs)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
