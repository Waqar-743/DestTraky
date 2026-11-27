import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import type { AppSettings } from "../types/pulsetrack";
import { Modal } from "../components/Modal";

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (next: AppSettings) => void;
  onExport: (format: "csv" | "json") => void;
  onClearAll: () => void;
}

export function SettingsView({ settings, onSave, onExport, onClearAll }: SettingsViewProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const patch = (partial: Partial<AppSettings>) => {
    onSave({ ...settings, ...partial });
  };

  return (
    <div className="max-w-2xl space-y-4">
      {/* Tracking */}
      <section className="pt-card p-5 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-inkMuted">Tracking</div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-ink">Idle threshold</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={60}
              max={1800}
              step={60}
              value={settings.idleThresholdSecs}
              onChange={(e) => patch({ idleThresholdSecs: Number(e.target.value) })}
              className="w-36"
            />
            <span className="text-xs font-mono tabular-nums text-amberPulse w-10 text-right">
              {Math.round(settings.idleThresholdSecs / 60)}m
            </span>
          </div>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-ink">Suppress idle in fullscreen</span>
          <input
            type="checkbox"
            checked={settings.suppressIdleFullscreen}
            onChange={(e) => patch({ suppressIdleFullscreen: e.target.checked })}
            className="w-4 h-4 accent-[#D98A1C]"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-ink">Sleep gap threshold</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={300}
              value={settings.sleepGapThresholdSecs}
              onChange={(e) =>
                patch({ sleepGapThresholdSecs: Math.max(10, Number(e.target.value) || 15) })
              }
              className="pt-input w-20 text-right font-mono text-xs"
            />
            <span className="text-xs font-mono text-inkFaint">sec</span>
          </div>
        </div>
      </section>

      {/* System */}
      <section className="pt-card p-5 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-inkMuted">System</div>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-ink">Start on Windows login</span>
          <input
            type="checkbox"
            checked={settings.autoStartLogin}
            onChange={(e) => patch({ autoStartLogin: e.target.checked })}
            className="w-4 h-4 accent-[#D98A1C]"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-ink">Minimize to tray on close</span>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => patch({ minimizeToTray: e.target.checked })}
            className="w-4 h-4 accent-[#D98A1C]"
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="text-xs text-ink">Theme</span>
          <div className="flex items-center gap-1 bg-canvas p-1 rounded-lg border border-borderSubtle">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => patch({ theme: t })}
                className={`px-3 py-1 rounded-md text-xs font-mono capitalize ${
                  settings.theme === t
                    ? "bg-elevated text-ink border border-borderStrong"
                    : "text-inkMuted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Local Data */}
      <section className="pt-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-inkMuted">Local Data</span>
          <span className="text-[11px] font-mono text-inkFaint">SQLite · Offline only</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onExport("csv")}
              className="pt-btn-ghost px-3 py-1.5 text-xs font-mono flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => onExport("json")}
              className="pt-btn-ghost px-3 py-1.5 text-xs font-mono flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          <button
            id="btn-clear-data"
            type="button"
            onClick={() => setConfirmClear(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-rustPulse/50 text-rustPulse hover:bg-rustPulse/15 flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Data</span>
          </button>
        </div>
      </section>

      <Modal open={confirmClear} title="Clear Stored Data?" onClose={() => setConfirmClear(false)}>
        <div className="space-y-4">
          <p className="text-xs text-inkMuted">
            Deletes all activity logs and focus history. Rules and settings stay intact.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="pt-btn-ghost px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-clear"
              type="button"
              onClick={() => {
                setConfirmClear(false);
                onClearAll();
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rustPulse text-[#FCFBF7]"
            >
              Clear
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
