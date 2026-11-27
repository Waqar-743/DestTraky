import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { AlertNotification } from "../types/pulsetrack";

interface AlertToastProps {
  alert: AlertNotification | null;
  onDismiss: () => void;
}

export function AlertToast({ alert, onDismiss }: AlertToastProps) {
  if (!alert) return null;

  const isWarning =
    alert.kind === "focus_distraction" ||
    alert.kind === "limit_reached" ||
    alert.kind === "limit_warning";

  return (
    <div className="fixed bottom-5 right-5 z-50 pt-card border-borderStrong px-4 py-3 flex items-center gap-3 max-w-sm">
      {isWarning ? (
        <AlertTriangle className="w-4 h-4 text-rustPulse shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-amberPulse shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-xs font-semibold text-ink truncate">{alert.title}</div>
        <div className="text-[11px] text-inkMuted truncate">{alert.body}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-inkFaint hover:text-ink rounded"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
