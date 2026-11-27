import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type {
  Category,
  DailyLimit,
  DailyLimitStatus,
  LimitTargetType,
} from "../types/pulsetrack";
import { formatDuration } from "../lib/format";
import { Modal } from "../components/Modal";

interface LimitsViewProps {
  limits: DailyLimitStatus[];
  categories: Category[];
  knownApps: string[];
  onSaveLimit: (limit: DailyLimit) => void;
  onDeleteLimit: (id: string) => void;
}

export function LimitsView({
  limits,
  categories,
  knownApps,
  onSaveLimit,
  onDeleteLimit,
}: LimitsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [targetType, setTargetType] = useState<LimitTargetType>("category");
  const [targetValue, setTargetValue] = useState("distracting");
  const [dailyLimitMins, setDailyLimitMins] = useState(45);
  const [notifyAt80, setNotifyAt80] = useState(true);

  const openCreate = () => {
    setTargetType("category");
    setTargetValue(categories.find((c) => c.id === "distracting")?.id ?? categories[0]?.id ?? "distracting");
    setDailyLimitMins(45);
    setNotifyAt80(true);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValue.trim()) return;
    onSaveLimit({
      id: `lim-${Date.now()}`,
      targetType,
      targetValue: targetValue.trim(),
      dailyLimitMins: Math.max(5, dailyLimitMins),
      enabled: true,
      notifyAt80,
    });
    setModalOpen(false);
  };

  const chartData = limits.map((st) => ({
    label: st.label,
    usedMins: Math.round(st.usedSecs / 60),
    limitMins: st.limit.dailyLimitMins,
    exceeded: st.exceeded,
    warning80: st.warning80,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">
          Daily Budgets ({limits.length})
        </span>
        <button
          id="btn-add-limit"
          type="button"
          onClick={openCreate}
          className="pt-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Limit</span>
        </button>
      </div>

      {/* Budget Visual Comparison Chart */}
      {limits.length > 0 && (
        <div className="pt-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">
              Used vs Budget
            </span>
            <span className="text-[11px] font-mono text-inkFaint">Minutes</span>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="2 4" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tick={{ fill: "var(--text-primary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--bg-elevated)", opacity: 0.6 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as {
                      label: string;
                      usedMins: number;
                      limitMins: number;
                    };
                    return (
                      <div className="pt-card border-borderStrong px-3 py-1.5 text-xs font-mono">
                        <div className="text-ink font-semibold">{row.label}</div>
                        <div className="text-inkMuted">
                          {row.usedMins}m / {row.limitMins}m
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="limitMins" name="Limit" fill="#3B3931" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="usedMins" name="Used" radius={[0, 4, 4, 0]} barSize={14}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.exceeded ? "#C84630" : entry.warning80 ? "#E3A43B" : "#D98A1C"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Limit Cards */}
      {limits.length === 0 ? (
        <div className="pt-card py-16 text-center text-xs font-mono text-inkFaint">
          No daily limits
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {limits.map((st) => {
            const pct = Math.min(100, Math.max(0, st.percent));
            const barColor = st.exceeded ? "#C84630" : st.warning80 ? "#E3A43B" : "#D98A1C";
            return (
              <div key={st.limit.id} className="pt-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-canvas border border-borderSubtle text-inkMuted">
                      {st.limit.targetType}
                    </span>
                    <span className="text-sm font-semibold text-ink truncate">{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        st.exceeded
                          ? "bg-rustPulse/20 text-rustPulse"
                          : st.warning80
                          ? "bg-amberPulse/20 text-amberPulse"
                          : "bg-elevated text-inkMuted"
                      }`}
                    >
                      {st.exceeded ? "Limit" : st.warning80 ? "80%" : "OK"}
                    </span>
                    <input
                      type="checkbox"
                      checked={st.limit.enabled}
                      onChange={(e) => onSaveLimit({ ...st.limit, enabled: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[#D98A1C]"
                      aria-label="Enable limit"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteLimit(st.limit.id)}
                      className="p-1 text-inkFaint hover:text-rustPulse"
                      aria-label="Delete limit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-canvas overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-ink">
                    {formatDuration(st.usedSecs)} / {st.limit.dailyLimitMins}m
                  </span>
                  <span className="text-inkMuted">
                    {st.exceeded ? "0m left" : `${formatDuration(st.remainingSecs)} left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} title="Add Daily Limit" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {(["category", "app"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTargetType(t);
                  setTargetValue(
                    t === "category"
                      ? categories[0]?.id ?? "distracting"
                      : knownApps[0] ?? "Google Chrome"
                  );
                }}
                className={`py-1.5 rounded-lg text-xs font-mono uppercase border ${
                  targetType === t
                    ? "bg-elevated border-amberPulse text-ink"
                    : "border-borderSubtle text-inkMuted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Target</span>
            {targetType === "category" ? (
              <select
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="pt-input w-full"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                list="known-apps-list"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="App name (e.g. Discord)"
                className="pt-input w-full"
              />
            )}
            <datalist id="known-apps-list">
              {knownApps.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Limit (minutes)</span>
            <input
              type="number"
              min={5}
              max={720}
              value={dailyLimitMins}
              onChange={(e) => setDailyLimitMins(Number(e.target.value) || 30)}
              className="pt-input w-full font-mono"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-inkMuted cursor-pointer">
            <span>Notify at 80%</span>
            <input
              type="checkbox"
              checked={notifyAt80}
              onChange={(e) => setNotifyAt80(e.target.checked)}
              className="w-4 h-4 accent-[#D98A1C]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="pt-btn-ghost px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
            <button type="submit" className="pt-btn-primary px-4 py-1.5 text-xs">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
