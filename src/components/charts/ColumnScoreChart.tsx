import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { CategoryBreakdownItem, TimeBucket } from "../../types/pulsetrack";
import { formatDurationCompact } from "../../lib/format";

interface ColumnScoreChartProps {
  buckets: TimeBucket[];
  categories: CategoryBreakdownItem[];
  overallScore: number | null;
  hourlyMode: boolean;
  selectedBucketKey: string | null;
  onSelectBucket: (key: string | null) => void;
}

export function ColumnScoreChart({
  buckets,
  categories,
  overallScore,
  hourlyMode,
  selectedBucketKey,
  onSelectBucket,
}: ColumnScoreChartProps) {
  const [mode, setMode] = useState<"bars" | "waves">("bars");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Pick up to 8 most active/recent buckets for crisp tall pill columns (matching reference clarity)
  const displayBuckets = useMemo(() => {
    const nonEmpty = buckets.filter((b) => b.totalSecs > 0);
    if (nonEmpty.length === 0) return buckets.slice(0, 6);
    if (nonEmpty.length <= 8) return nonEmpty;
    return nonEmpty.slice(-8);
  }, [buckets]);

  const peakKey = useMemo(() => {
    let best: TimeBucket | null = null;
    for (const b of displayBuckets) {
      if (!best || (b.score ?? 0) > (best.score ?? 0)) best = b;
    }
    return best?.key ?? null;
  }, [displayBuckets]);

  const avgScore = overallScore ?? 75;
  const activeKey = hoveredKey ?? selectedBucketKey ?? peakKey;

  // Build smooth Ember-style cubic wave curves + mirrored reflection below baseline
  const waveData = useMemo(() => {
    const src = displayBuckets.length >= 2 ? displayBuckets : buckets.slice(0, 7);
    const W = 540;
    const H = 220;
    const midY = 144;
    const padL = 32;
    const padR = 14;
    const plotW = W - padL - padR;
    const maxMins = Math.max(
      10,
      ...src.map((b) => Math.max(...categories.map((c) => (b.byCategory[c.categoryId] ?? 0) / 60), 0))
    );

    const catCurves = categories.slice(0, 4).map((cat) => {
      const pts = src.map((b, i) => {
        const x = padL + (i / Math.max(1, src.length - 1)) * plotW;
        const mins = (b.byCategory[cat.categoryId] ?? 0) / 60;
        const y = midY - (mins / maxMins) * 116;
        return { x, y };
      });
      return {
        id: cat.categoryId,
        name: cat.name,
        color: cat.color,
        d: smoothPath(pts),
      };
    });

    // Subtle mirrored reflection curves below the baseline
    const mirrors = [0.42, 0.3, 0.2, 0.12].map((amp, idx) => {
      const pts = src.map((b, i) => {
        const x = padL + (i / Math.max(1, src.length - 1)) * plotW;
        const norm = Math.min(1, b.totalSecs / Math.max(600, maxMins * 90));
        const y = midY + norm * amp * 115;
        return { x, y };
      });
      return { id: `m-${idx}`, d: smoothPath(pts), opacity: 0.24 - idx * 0.04 };
    });

    return { W, H, midY, padL, padR, plotW, src, catCurves, mirrors };
  }, [displayBuckets, buckets, categories]);

  return (
    <div className="pt-card p-5 flex flex-col justify-between h-full animate-pt-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-5 h-5 text-amberPulse shrink-0" strokeWidth={1.8} />
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            {hourlyMode ? "Hourly Focus" : "Daily Focus"}
          </h2>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-elevated border border-borderSubtle text-[11px] font-mono">
            {(["bars", "waves"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 rounded-md capitalize transition-colors ${
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-inkMuted hover:text-ink"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {selectedBucketKey && (
            <button
              type="button"
              onClick={() => onSelectBucket(null)}
              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amberPulse/15 text-amberPulse hover:bg-amberPulse/25"
            >
              {selectedBucketKey} ×
            </button>
          )}
        </div>

        {/* Overall Score + animated pulse ECG sparkline */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold font-mono tabular-nums text-ink">
            {overallScore !== null ? `${overallScore}%` : "—"}
          </span>
          <span className="text-xs text-inkMuted">overall</span>
          <svg width="34" height="16" viewBox="0 0 34 16" className="overflow-visible">
            <path
              d="M0 9 L9 9 L13 2 L17 14 L21 6 L24 9 L34 9"
              fill="none"
              stroke="var(--accent-productive)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-pt-ecg"
            />
          </svg>
        </div>
      </div>

      {mode === "bars" ? (
        /* Signature Tall Rounded Hatched Columns + Dashed Avg Reference Line */
        <div className="relative pt-2 pb-1">
          <div className="flex items-stretch gap-3">
            {/* Y-axis labels */}
            <div className="w-8 shrink-0 flex flex-col justify-between pb-6 text-[10px] font-mono text-inkFaint text-right select-none">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            {/* Plot area */}
            <div className="relative flex-1 min-w-0">
              {/* Dashed average reference line + amber left pill badge */}
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center transition-all duration-500"
                style={{ bottom: `calc(24px + ${Math.min(96, Math.max(8, avgScore))}% * 0.85)` }}
              >
                <span className="-ml-10 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amberPulse text-[#fffdf8] shadow-sm">
                  {avgScore}%
                </span>
                <div className="flex-1 border-t border-dashed border-amberPulse/70 ml-1" />
              </div>

              {/* Columns */}
              <div className="grid gap-2.5 items-end" style={{ gridTemplateColumns: `repeat(${displayBuckets.length}, minmax(0, 1fr))` }}>
                {displayBuckets.map((b, idx) => {
                  const score = b.score ?? 0;
                  const isActive = activeKey === b.key;
                  const heightPct = Math.max(10, Math.min(100, score));
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onMouseEnter={() => setHoveredKey(b.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => onSelectBucket(selectedBucketKey === b.key ? null : b.key)}
                      className="group flex flex-col items-center gap-2 focus:outline-none"
                    >
                      {/* Tall soft pill track */}
                      <div className="relative w-full h-[184px] rounded-2xl bg-elevated/75 border border-borderSubtle/70 overflow-hidden flex items-end">
                        {/* Filled column */}
                        <div
                          className={`relative w-full rounded-t-2xl animate-pt-bar transition-all duration-300 ${
                            isActive ? "" : "pt-hatch bg-surface/65 border-t border-borderStrong/60"
                          }`}
                          style={{
                            height: `${heightPct}%`,
                            animationDelay: `${idx * 45}ms`,
                            background: isActive
                              ? "linear-gradient(180deg, #D97706 0%, rgba(217,119,6,0.42) 65%, rgba(217,119,6,0.08) 100%)"
                              : undefined,
                          }}
                        >
                          {/* Floating value pill inside cap */}
                          <div
                            className={`mx-auto mt-2 w-fit max-w-[92%] px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums truncate transition-all duration-200 ${
                              isActive
                                ? "bg-[#B45309] text-[#FFFDF8] font-semibold shadow-sm scale-105"
                                : "bg-surface/95 text-ink border border-borderSubtle"
                            }`}
                          >
                            {score}%{" "}
                            <span className={isActive ? "opacity-80" : "text-inkFaint"}>
                              {formatDurationCompact(b.totalSecs)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-mono truncate max-w-full transition-colors ${
                          isActive ? "text-ink font-semibold" : "text-inkMuted"
                        }`}
                      >
                        {b.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Ember-inspired Glowing Mirrored Multi-Curve Wave Chart (Zero blue/pink/light-green) */
        <div className="pt-1">
          <svg viewBox={`0 0 ${waveData.W} ${waveData.H}`} className="w-full h-[212px] overflow-visible">
            <defs>
              <filter id="ptGlow" x="-10%" y="-20%" width="120%" height="140%">
                <feGaussianBlur stdDeviation="3.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal grid */}
            {[0, 0.5, 1].map((f) => {
              const y = waveData.midY - f * 116;
              return (
                <line
                  key={f}
                  x1={waveData.padL}
                  y1={y}
                  x2={waveData.W - waveData.padR}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="2 4"
                />
              );
            })}

            {/* Mirrored reflection curves below baseline */}
            {waveData.mirrors.map((m) => (
              <path
                key={m.id}
                d={m.d}
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.2"
                strokeOpacity={m.opacity}
                className="animate-pt-wave"
              />
            ))}

            {/* Glowing category wave lines above baseline */}
            {waveData.catCurves.map((c, idx) => (
              <path
                key={c.id}
                d={c.d}
                fill="none"
                stroke={c.color}
                strokeWidth="2.3"
                strokeLinecap="round"
                filter="url(#ptGlow)"
                className="animate-pt-wave"
                style={{ animationDelay: `${idx * 90}ms` }}
              >
                <title>{c.name}</title>
              </path>
            ))}

            {/* Baseline */}
            <line
              x1={waveData.padL}
              y1={waveData.midY}
              x2={waveData.W - waveData.padR}
              y2={waveData.midY}
              stroke="var(--border-strong)"
            />

            {/* X Labels */}
            {waveData.src.map((b, i) => {
              const x = waveData.padL + (i / Math.max(1, waveData.src.length - 1)) * waveData.plotW;
              return (
                <text
                  key={b.key}
                  x={x}
                  y={waveData.midY + 14}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="10"
                  className="font-mono"
                >
                  {b.label}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}
