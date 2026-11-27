import { useMemo, useState } from "react";
import { Ban, Plus, Search, Tag, X } from "lucide-react";
import type { ActivitySession, Category } from "../types/pulsetrack";
import { formatDuration, formatTimeOfDay } from "../lib/format";
import { AppIcon } from "../components/AppIcon";
import { Modal } from "../components/Modal";
import { TimelineStrip } from "../components/charts/TimelineStrip";

interface TimelineViewProps {
  sessions: ActivitySession[];
  categories: Category[];
  initialAppFilter: string | null;
  onClearAppFilter: () => void;
  onQuickIgnoreApp: (processName: string) => void;
  onLogManualTask: (title: string, categoryId: string, durationMins: number, tag: string | null) => void;
}

export function TimelineView({
  sessions,
  categories,
  initialAppFilter,
  onClearAppFilter,
  onQuickIgnoreApp,
  onLogManualTask,
}: TimelineViewProps) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Tockler LogTrack manual task modal
  const [taskModal, setTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCat, setTaskCat] = useState("productive");
  const [taskMins, setTaskMins] = useState(30);
  const [taskTag, setTaskTag] = useState("meeting");

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Unique arbtt tags present across sessions
  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      for (const t of s.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + s.durationSecs);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, secs]) => ({ tag, secs }));
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...sessions]
      .filter((s) => {
        if (initialAppFilter && s.appName.toLowerCase() !== initialAppFilter.toLowerCase()) {
          return false;
        }
        if (catFilter && s.categoryId !== catFilter) return false;
        if (tagFilter && !(s.tags ?? []).includes(tagFilter)) return false;
        if (q) {
          const hay = `${s.appName} ${s.windowTitle} ${s.domainContext ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.startTs - a.startTs);
  }, [sessions, initialAppFilter, catFilter, tagFilter, search]);

  const matchedSecs = useMemo(
    () => filtered.reduce((acc, s) => acc + s.durationSecs, 0),
    [filtered]
  );

  const latestDate = filtered[0]?.date ?? sessions[sessions.length - 1]?.date ?? "Today";
  const stripSessions = useMemo(
    () => filtered.filter((s) => s.date === latestDate),
    [filtered, latestDate]
  );

  const submitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onLogManualTask(taskTitle.trim(), taskCat, Math.max(1, taskMins), taskTag.trim() || null);
    setTaskTitle("");
    setTaskModal(false);
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <TimelineStrip sessions={stripSessions} categories={categories} dateLabel={latestDate} />

      {/* Filter bar + Tockler Search Totals + Log Task */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCatFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              catFilter === null
                ? "bg-elevated text-ink border-borderStrong"
                : "border-borderSubtle text-inkMuted hover:text-ink"
            }`}
          >
            All
          </button>
          {categories.map((c) => {
            const active = catFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(active ? null : c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                  active
                    ? "bg-elevated text-ink border-borderStrong"
                    : "border-borderSubtle text-inkMuted hover:text-ink"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
              </button>
            );
          })}
          {initialAppFilter && (
            <button
              type="button"
              onClick={onClearAppFilter}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-amberPulse/15 text-amberPulse border border-amberPulse/30 flex items-center gap-1"
            >
              <span>{initialAppFilter}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tabular-nums px-2.5 py-1 rounded-lg bg-surface border border-borderSubtle text-inkMuted">
            {filtered.length} logs · <strong className="text-ink">{formatDuration(matchedSecs)}</strong>
          </span>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-inkFaint absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search app, title, tag..."
              className="pt-input pl-8 w-52 text-xs"
            />
          </div>

          <button
            id="btn-log-task"
            type="button"
            onClick={() => setTaskModal(true)}
            className="pt-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Task</span>
          </button>
        </div>
      </div>

      {/* arbtt Tag Filter Strip */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-inkFaint mr-1" />
          {availableTags.map(({ tag }) => {
            const active = tagFilter === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(active ? null : tag)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors ${
                  active
                    ? "bg-amberPulse/15 border-amberPulse/40 text-amberPulse font-semibold"
                    : "bg-surface border-borderSubtle text-inkMuted hover:text-ink"
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {tagFilter && (
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className="text-[11px] font-mono text-inkFaint hover:text-ink ml-1"
            >
              Reset ×
            </button>
          )}
        </div>
      )}

      {/* Session Log Table */}
      <div className="pt-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-inkFaint">No matching logs</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderSubtle text-[11px] font-mono uppercase tracking-wider text-inkFaint">
                  <th className="py-2.5 px-4 font-medium">Time</th>
                  <th className="py-2.5 px-3 font-medium">App</th>
                  <th className="py-2.5 px-3 font-medium">Title / Context</th>
                  <th className="py-2.5 px-3 font-medium">Tags</th>
                  <th className="py-2.5 px-3 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium text-right">Duration</th>
                  <th className="py-2.5 px-3 font-medium w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSubtle/70 text-xs">
                {filtered.slice(0, 120).map((s) => {
                  const cat = catMap.get(s.categoryId);
                  const color = cat?.color ?? "#8A8478";
                  return (
                    <tr key={s.id} className="hover:bg-elevated/50 transition-colors group">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-inkMuted whitespace-nowrap">
                        {formatTimeOfDay(s.startTs)}–{formatTimeOfDay(s.endTs)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <AppIcon name={s.appName} accentColor={color} size="sm" />
                          <span className="font-medium text-ink">{s.appName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[300px]">
                        <div className="flex items-center gap-2 min-w-0">
                          {s.domainContext && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-canvas border border-borderSubtle text-amberPulse shrink-0">
                              {s.domainContext}
                            </span>
                          )}
                          <span className="text-inkMuted truncate" title={s.windowTitle}>
                            {s.windowTitle}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {(s.tags ?? []).slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-elevated text-inkMuted"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-inkMuted">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          {cat?.name ?? "Neutral"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-ink text-right whitespace-nowrap">
                        {formatDuration(s.durationSecs)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {!s.isManual && (
                          <button
                            type="button"
                            title={`Ignore ${s.processName}`}
                            onClick={() => onQuickIgnoreApp(s.processName)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-inkFaint hover:text-rustPulse transition-opacity"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tockler LogTrack Manual Task Modal */}
      <Modal open={taskModal} title="Log Manual Task" onClose={() => setTaskModal(false)}>
        <form onSubmit={submitTask} className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Task</span>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Client call, Architecture review"
              className="pt-input w-full"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block space-y-1">
              <span className="text-[11px] font-mono uppercase text-inkMuted">Category</span>
              <select
                value={taskCat}
                onChange={(e) => setTaskCat(e.target.value)}
                className="pt-input w-full"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-mono uppercase text-inkMuted">Duration (m)</span>
              <input
                type="number"
                min={1}
                max={480}
                value={taskMins}
                onChange={(e) => setTaskMins(Number(e.target.value) || 15)}
                className="pt-input w-full font-mono"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Tag</span>
            <input
              type="text"
              value={taskTag}
              onChange={(e) => setTaskTag(e.target.value)}
              placeholder="e.g. meeting, qa, sprint"
              className="pt-input w-full font-mono"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTaskModal(false)} className="pt-btn-ghost px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button type="submit" className="pt-btn-primary px-4 py-1.5 text-xs">
              Log
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
