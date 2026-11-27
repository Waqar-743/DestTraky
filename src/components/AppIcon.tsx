import {
  Code2,
  Compass,
  FileText,
  Folder,
  Globe,
  MessageSquare,
  Terminal,
  Tv,
  AppWindow,
} from "lucide-react";

interface AppIconProps {
  name: string;
  iconDataUrl?: string | null;
  accentColor?: string;
  size?: "sm" | "md";
}

function resolveAppGlyph(name: string) {
  const n = name.toLowerCase();
  if (n.includes("code") || n.includes("idea") || n.includes("rustrover")) return Code2;
  if (n.includes("terminal") || n.includes("powershell") || n.includes("cmd")) return Terminal;
  if (n.includes("chrome") || n.includes("edge") || n.includes("firefox") || n.includes("brave")) return Globe;
  if (n.includes("slack") || n.includes("discord") || n.includes("teams")) return MessageSquare;
  if (n.includes("obsidian") || n.includes("notion") || n.includes("word")) return FileText;
  if (n.includes("explorer") || n.includes("finder")) return Folder;
  if (n.includes("figma")) return Compass;
  if (n.includes("vlc") || n.includes("youtube")) return Tv;
  return AppWindow;
}

export function AppIcon({ name, iconDataUrl, accentColor = "#D97706", size = "md" }: AppIconProps) {
  const dim = size === "sm" ? "w-5 h-5" : "w-6 h-6";

  if (iconDataUrl) {
    return (
      <img
        src={iconDataUrl}
        alt={name}
        className={`${dim} rounded object-contain shrink-0`}
      />
    );
  }

  const Glyph = resolveAppGlyph(name);
  return (
    <Glyph
      className={`${dim} shrink-0`}
      style={{ color: accentColor }}
      strokeWidth={1.8}
      aria-hidden="true"
    />
  );
}
