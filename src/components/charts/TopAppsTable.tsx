import { FilterX, Layers } from "lucide-react";
import type { AppUsageItem, DailyLimitStatus } from "../../types/pulsetrack";
import { formatDuration } from "../../lib/format";
import { AppIcon } from "../AppIcon";

interface TopAppsTableProps {
  apps: AppUsageItem[];
  productiveSecs: number;
  totalActiveSecs: number;
  limitByApp: Map<string, DailyLimitStatus>;
  hasFilter: boolean;
  onClearFilter: () => void;
  onInspectApp: (appName: string) => void;
}

export function TopAppsTable({
  apps,
  productiveSecs,
  totalActiveSecs,
  limitByApp,
  hasFilter,
  onClearFilter,
  onInspectApp,
}: TopAppsTableProps) {
  const prodPct = totalActiveSecs > 0 ? Math.round((productiveSecs / totalActiveSecs) * 100) : 0;
  const maxSecs = apps[0]?.totalSecs || 1;

  return (
    <div className="pt-card p-5 flex flex-col justify-between h-full animate-pt-in" style={{ animationDelay: "90ms" }}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amberPulse shrink-0" strokeWidth={1.8} />
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Top applications</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasFilter && (
              <button
                type="button"
                onClick={onClearFilter}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-amberPulse hover:underline"
              >
                <FilterX className="w-3 h-3" />
                Clear
              </button>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amberPulse/15 text-amberPulse">
              {prodPct}% productive
            </span>
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-semibold font-mono tabular-nums text-ink">
            {formatDuration(productiveSecs)}
          </span>
          <span className="text-xs text-inkMuted">productive time</span>
        </div>

        {apps.length === 0 ? (
          <div className="py-10 text-center text-xs font-mono text-inkFaint">No apps in filter</div>
        ) : (
          <div className="divide-y divide-borderSubtle/70">
            {apps.slice(0, 5).map((app) => {
              const filledSegs = Math.max(1, Math.round((app.totalSecs / maxSecs) * 5));
              const appLimit = limitByApp.get(app.appName.toLowerCase());
              return (
                <button
                  key={app.appName}
                  type="button"
                  onClick={() => onInspectApp(app.appName)}
                  className="w-full py-2.5 px-1.5 -mx-1.5 rounded-lg hover:bg-elevated/70 transition-colors grid grid-cols-12 items-center gap-2 text-left"
                >
                  <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                    <AppIcon
                      name={app.appName}
                      iconDataUrl={app.iconDataUrl}
                      accentColor={app.categoryColor}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-ink truncate">{app.appName}</div>
                      {app.topContext && (
                        <div className="text-[10px] font-mono text-inkFaint truncate">
                          {app.topContext}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-right font-mono tabular-nums text-xs text-inkMuted">
                    {app.sessionsCount}
                  </div>

                  <div className="col-span-2 text-right font-mono tabular-nums text-xs font-medium text-ink">
                    {formatDuration(app.totalSecs)}
                  </div>

                  {/* Signature 5-segment vertical micro-bar meter + % */}
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <div className="flex items-center gap-[3px]">
                      {[0, 1, 2, 3, 4].map((seg) => (
                        <span
                          key={seg}
                          className="w-[4px] h-3.5 rounded-[2px] transition-all"
                          style={{
                            backgroundColor:
                              seg < filledSegs
                                ? appLimit?.exceeded
                                  ? "#C84630"
                                  : app.categoryColor
                                : "var(--border-subtle)",
                          }}
                        />
                      ))}
                    </div>
                    <span className="font-mono tabular-nums text-xs text-ink w-8 text-right">
                      {Math.round(app.sharePct)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
