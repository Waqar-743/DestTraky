import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import type { ActivitySession, Category } from "../../types/pulsetrack";
import { formatDuration, formatTimeOfDay } from "../../lib/format";

interface TimelineStripProps {
  sessions: ActivitySession[];
  categories: Category[];
  dateLabel: string;
}

type ZoomHours = 24 | 12 | 6;

interface StateSpan {
  kind: "online" | "idle" | "offline";
  startMs: number;
  endMs: number;
}

/**
 * Tockler-inspired dual-lane interactive timeline:
 *  - Lane 1: Computer State (Online / Idle / Offline-Sleep spans)
 *  - Lane 2: Active Apps & Manual Task blocks
 * Supports 24h / 12h / 6h zoom and left/right pan.
 */
export function TimelineStrip({ sessions, categories, dateLabel }: TimelineStripProps) {
  const [hovered, setHovered] = useState<ActivitySession | null>(null);
  const [hoveredState, setHoveredState] = useState<StateSpan | null>(null);
  const [zoomHours, setZoomHours] = useState<ZoomHours>(24);
  const [startHour, setStartHour] = useState<number>(0);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const ordered = useMemo(
    () => [...sessions].filter((s) => s.durationSecs > 0).sort((a, b) => a.startTs - b.startTs),
    [sessions]
  );

  const dayStartMs = useMemo(() => {
    if (ordered.length === 0) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    }
    const d = new Date(ordered[0].startTs);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  }, [ordered]);

  // Derive Tockler-style Online / Idle / Offline state spans from session timestamps
  const stateSpans = useMemo<StateSpan[]>(() => {
    if (ordered.length === 0) return [];
    const spans: StateSpan[] = [];
    let curStart = ordered[0].startTs;
    let curEnd = ordered[0].endTs;

    for (let i = 1; i < ordered.length; i++) {
      const s = ordered[i];
      const gapMs = s.startTs - curEnd;
      if (gapMs <= 3 * 60 * 1000) {
        curEnd = Math.max(curEnd, s.endTs);
      } else {
        spans.push({ kind: "online", startMs: curStart, endMs: curEnd });
        // Gaps between 3m and 30m = Idle; gaps > 30m = Offline/Sleep
        spans.push({
          kind: gapMs <= 30 * 60 * 1000 ? "idle" : "offline",
          startMs: curEnd,
          endMs: s.startTs,
        });
        curStart = s.startTs;
        curEnd = s.endTs;
      }
    }
    spans.push({ kind: "online", startMs: curStart, endMs: curEnd });
    return spans;
  }, [ordered]);

  const clampedStart = Math.min(startHour, 24 - zoomHours);
  const winStartMs = dayStartMs + clampedStart * 3600 * 1000;
  const winSpanMs = zoomHours * 3600 * 1000;
  const winEndMs = winStartMs + winSpanMs;

  const setZoom = (next: ZoomHours) => {
    setZoomHours(next);
    if (next === 24) {
      setStartHour(0);
    } else if (ordered.length > 0) {
      const firstH = new Date(ordered[0].startTs).getHours();
      setStartHour(Math.max(0, Math.min(24 - next, firstH)));
    }
  };

  const pan = (delta: number) => {
    setStartHour((h) => Math.max(0, Math.min(24 - zoomHours, h + delta)));
  };

  const marks = useMemo(() => {
    const step = zoomHours === 24 ? 4 : zoomHours === 12 ? 2 : 1;
    const arr: number[] = [];
    for (let h = clampedStart; h <= clampedStart + zoomHours; h += step) {
      arr.push(h);
    }
    return arr;
  }, [clampedStart, zoomHours]);

  const toWindowPos = (sMs: number, eMs: number) => {
    if (eMs <= winStartMs || sMs >= winEndMs) return null;
    const cs = Math.max(sMs, winStartMs);
    const ce = Math.min(eMs, winEndMs);
    const leftPct = ((cs - winStartMs) / winSpanMs) * 100;
    const widthPct = Math.max(0.35, ((ce - cs) / winSpanMs) * 100);
    return { leftPct, widthPct };
  };

  return (
    <div className="pt-card p-5 space-y-3 animate-pt-in">
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[24px]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">
            Timeline · {dateLabel}
          </span>

          {/* Zoom & Pan controls (Tockler-style) */}
          <div className="flex items-center gap-1 bg-canvas p-0.5 rounded-lg border border-borderSubtle text-[11px] font-mono">
            <ZoomIn className="w-3 h-3 text-inkFaint ml-1.5 mr-0.5" />
            {([24, 12, 6] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  zoomHours === z ? "bg-elevated text-ink font-semibold" : "text-inkMuted hover:text-ink"
                }`}
              >
                {z}h
              </button>
            ))}
          </div>

          {zoomHours < 24 && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => pan(-2)}
                disabled={clampedStart <= 0}
                className="p-1 rounded-md border border-borderSubtle text-inkMuted hover:text-ink disabled:opacity-30"
                aria-label="Pan earlier"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => pan(2)}
                disabled={clampedStart >= 24 - zoomHours}
                className="p-1 rounded-md border border-borderSubtle text-inkMuted hover:text-ink disabled:opacity-30"
                aria-label="Pan later"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Live hover inspector */}
        {hovered ? (
          <div className="text-xs font-mono tabular-nums text-ink flex items-center gap-2">
            <span className="text-amberPulse font-semibold">{hovered.appName}</span>
            <span className="text-inkFaint">
              {formatTimeOfDay(hovered.startTs)}–{formatTimeOfDay(hovered.endTs)}
            </span>
            <span>{formatDuration(hovered.durationSecs)}</span>
          </div>
        ) : hoveredState ? (
          <div className="text-xs font-mono tabular-nums text-ink flex items-center gap-2">
            <span className="uppercase text-amberPulse">{hoveredState.kind}</span>
            <span className="text-inkFaint">
              {formatTimeOfDay(hoveredState.startMs)}–{formatTimeOfDay(hoveredState.endMs)}
            </span>
            <span>{formatDuration((hoveredState.endMs - hoveredState.startMs) / 1000)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[11px] font-mono text-inkFaint">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-amberPulse" /> Online
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-stonePulse" /> Idle
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm pt-hatch border border-borderStrong" /> Offline
            </span>
          </div>
        )}
      </div>

      {/* Lane 1: Computer State (Online / Idle / Offline) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[10px] font-mono uppercase text-inkFaint">State</span>
          <div className="relative flex-1 h-4 rounded-md bg-canvas border border-borderSubtle overflow-hidden">
            {stateSpans.map((sp, i) => {
              const pos = toWindowPos(sp.startMs, sp.endMs);
              if (!pos) return null;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredState(sp)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={`absolute top-0.5 bottom-0.5 rounded-[2px] cursor-pointer ${
                    sp.kind === "offline" ? "pt-hatch" : ""
                  }`}
                  style={{
                    left: `${pos.leftPct}%`,
                    width: `${pos.widthPct}%`,
                    backgroundColor:
                      sp.kind === "online"
                        ? "#D97706"
                        : sp.kind === "idle"
                        ? "#8A8478"
                        : "transparent",
                    opacity: sp.kind === "online" ? 0.8 : 0.65,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Lane 2: Apps & Manual Task Blocks */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[10px] font-mono uppercase text-inkFaint">Apps</span>
          <div className="relative flex-1 h-10 rounded-lg bg-canvas border border-borderSubtle overflow-hidden">
            {ordered.map((s) => {
              const pos = toWindowPos(s.startTs, s.endTs);
              if (!pos) return null;
              const color = catMap.get(s.categoryId)?.color ?? "#8A8478";
              return (
                <div
                  key={s.id}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(null)}
                  className={`absolute top-1 bottom-1 rounded-[3px] cursor-pointer transition-opacity hover:opacity-100 opacity-90 ${
                    s.isManual ? "pt-hatch ring-1 ring-ink/30" : ""
                  }`}
                  style={{
                    left: `${pos.leftPct}%`,
                    width: `${pos.widthPct}%`,
                    backgroundColor: color,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Time Axis */}
      <div className="flex items-center justify-between pl-14 text-[10px] font-mono text-inkFaint">
        {marks.map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
    </div>
  );
}
