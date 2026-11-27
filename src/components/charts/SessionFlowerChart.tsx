import { useState } from "react";
import { ArrowRight, Compass } from "lucide-react";
import type { CategoryBreakdownItem } from "../../types/pulsetrack";
import { formatDuration, formatDurationCompact } from "../../lib/format";

interface SessionFlowerChartProps {
  totalActiveSecs: number;
  productiveSecs: number;
  neutralSecs: number;
  distractingSecs: number;
  score: number | null;
  totalSwitches: number;
  categories: CategoryBreakdownItem[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onOpenTimeline: () => void;
}

interface PetalSpec {
  id: string;
  label: string;
  value: string;
  angleDeg: number;
  color: string;
  filterCatId: string | null;
}

export function SessionFlowerChart({
  totalActiveSecs,
  productiveSecs,
  neutralSecs,
  distractingSecs,
  score,
  totalSwitches,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onOpenTimeline,
}: SessionFlowerChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const deepCat = categories.find((c) => c.categoryId !== "productive" && c.kind === "productive");
  const deepSecs = deepCat?.totalSecs ?? Math.round(productiveSecs * 0.55);
  const coreProdSecs = Math.max(0, productiveSecs - deepSecs);

  // 6 symmetric warm petals (strictly zero blue, zero pink, zero light green)
  const petals: PetalSpec[] = [
    {
      id: "deep",
      label: deepCat?.name ?? "Deep",
      value: formatDurationCompact(deepSecs),
      angleDeg: -90,
      color: "#D97706", // Burnished Amber
      filterCatId: deepCat?.categoryId ?? "productive",
    },
    {
      id: "productive",
      label: "Focus",
      value: formatDurationCompact(coreProdSecs),
      angleDeg: -30,
      color: "#E09F3E", // Warm Ochre
      filterCatId: "productive",
    },
    {
      id: "neutral",
      label: "Neutral",
      value: formatDurationCompact(neutralSecs),
      angleDeg: 30,
      color: "#9E7B3B", // Aged Brass
      filterCatId: "neutral",
    },
    {
      id: "switches",
      label: "Switches",
      value: String(totalSwitches),
      angleDeg: 90,
      color: "#8A8478", // Warm Stone
      filterCatId: null,
    },
    {
      id: "distracting",
      label: "Distract",
      value: formatDurationCompact(distractingSecs),
      angleDeg: 150,
      color: "#C84630", // Burnt Vermilion
      filterCatId: "distracting",
    },
    {
      id: "score",
      label: "Score",
      value: score !== null ? `${score}%` : "—",
      angleDeg: 210,
      color: "#B56537", // Terracotta
      filterCatId: null,
    },
  ];

  const cx = 140;
  const cy = 140;
  const ringR = 64;

  return (
    <div className="pt-card p-5 flex flex-col justify-between h-full animate-pt-in" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-amberPulse shrink-0" strokeWidth={1.8} />
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Session anatomy</h2>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amberPulse/15 text-amberPulse">
          {score !== null ? `${score}% focus` : "Empty"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 my-auto">
        {/* 6-Petal Radial Flower SVG */}
        <div className="sm:col-span-7 flex items-center justify-center">
          <svg viewBox="0 0 280 280" className="w-[225px] h-[225px] overflow-visible">
            <defs>
              {petals.map((p) => (
                <radialGradient key={p.id} id={`petal-grad-${p.id}`} cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor={p.color} stopOpacity="0.62" />
                  <stop offset="68%" stopColor={p.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={p.color} stopOpacity="0.06" />
                </radialGradient>
              ))}
            </defs>

            {petals.map((p) => {
              const rad = (p.angleDeg * Math.PI) / 180;
              const px = cx + Math.cos(rad) * ringR;
              const py = cy + Math.sin(rad) * ringR;
              const isSel = selectedCategoryId !== null && selectedCategoryId === p.filterCatId;
              const isHov = hoveredId === p.id;
              const dimmed =
                selectedCategoryId !== null &&
                p.filterCatId !== null &&
                selectedCategoryId !== p.filterCatId;

              return (
                <g
                  key={p.id}
                  className="pt-petal"
                  style={{ opacity: dimmed ? 0.35 : 1 }}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (p.filterCatId) {
                      onSelectCategory(isSel ? null : p.filterCatId);
                    }
                  }}
                >
                  <circle
                    cx={px}
                    cy={py}
                    r={isHov || isSel ? 49 : 46}
                    fill={`url(#petal-grad-${p.id})`}
                    stroke={isSel || isHov ? p.color : "var(--border-subtle)"}
                    strokeWidth={isSel ? 1.8 : 1}
                    style={{ transition: "all 220ms ease" }}
                  />
                  <text
                    x={px}
                    y={py - 3}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="13"
                    fontWeight="700"
                    className="font-mono tabular-nums"
                  >
                    {p.value}
                  </text>
                  <text
                    x={px}
                    y={py + 12}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontSize="10"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}

            {/* Clean center hub */}
            <circle
              cx={cx}
              cy={cy}
              r="22"
              fill="var(--bg-surface)"
              stroke="var(--border-subtle)"
              strokeWidth="1.2"
            />
            <circle cx={cx} cy={cy} r="5" fill="var(--accent-productive)" />
          </svg>
        </div>

        {/* Right Readout */}
        <div className="sm:col-span-5 space-y-3">
          <div>
            <div className="text-2xl font-semibold font-mono tabular-nums text-ink">
              {formatDuration(totalActiveSecs)}
            </div>
            <div className="text-xs text-inkMuted">tracked</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-ink">
              {score !== null ? `${score}% Focus Score` : "No sessions"}
            </div>
            <div className="text-xs text-inkMuted font-mono tabular-nums">
              {formatDuration(productiveSecs)} productive
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenTimeline}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amberPulse hover:underline"
          >
            <span>Inspect timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
