import { EyeOff, Play } from "lucide-react";

interface PausedBannerProps {
  onResume: () => void;
}

export function PausedBanner({ onResume }: PausedBannerProps) {
  return (
    <div className="paused-stripe border-b border-amberPulse/40 px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-ink">
        <EyeOff className="w-3.5 h-3.5 text-amberPulse" />
        <span>Paused — Incognito</span>
      </div>
      <button
        type="button"
        onClick={onResume}
        className="pt-btn-primary px-2.5 py-1 text-xs flex items-center gap-1"
      >
        <Play className="w-3 h-3" />
        <span>Resume</span>
      </button>
    </div>
  );
}
