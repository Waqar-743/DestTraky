/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        borderSubtle: "var(--border-subtle)",
        borderStrong: "var(--border-strong)",
        ink: "var(--text-primary)",
        inkMuted: "var(--text-secondary)",
        inkFaint: "var(--text-muted)",
        amberPulse: "var(--accent-productive)",
        stonePulse: "var(--accent-neutral)",
        rustPulse: "var(--accent-distracting)",
        goldPulse: "var(--accent-focus)",
      },
    },
  },
  plugins: [],
};
