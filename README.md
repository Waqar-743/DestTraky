# DestTraky

Local-first Windows screen-time and productivity desktop app built with **Tauri v2**, **Rust**, **SQLite**, **React**, and **Recharts**.

## Architecture

- `crates/pulsetrack-core` — Local-first Rust engine:
  - Win32 foreground window + UWP (`ApplicationFrameHost.exe`) child-process resolution without admin rights (`platform/windows.rs`)
  - Browser window-title context extraction (`browser.rs`)
  - Cached `.exe` HICON → PNG icon extractor (`platform/windows.rs`)
  - 1-second in-memory activity buffer with idle tail trimming, fullscreen idle suppression, sleep-gap detection, midnight splitting, and periodic SQLite checkpoints (`tracker.rs`)
  - Priority categorization engine (`WindowTitle > AppName > Neutral`) & ignore list (`rules.rs`)
  - Weighted `0–100` Productivity Score, context switches/hour, and equal-length period comparisons (`analytics.rs`)
  - Daily limits monitor (`limits.rs`), Pomodoro/Focus engine with streak & distraction alerts (`focus.rs`), and UTF-8 BOM CSV / JSON export (`export.rs`)
  - Local SQLite WAL storage (`db.rs`)
- `src-tauri` — Tauri v2 desktop runtime, Windows system tray menu, native notifications, native Save Dialog export, login autostart, and minimize-to-tray lifecycle
- `src` — Minimal-text, chart-first React + TypeScript + Recharts UI (Dark & Light warm obsidian/amber/vermilion/stone themes)

## Prerequisites (Windows 10 / 11)

- [Rust (stable)](https://rustup.rs/) + MSVC Build Tools
- [Node.js 22+](https://nodejs.org/) + `pnpm`
- WebView2 Runtime (preinstalled on Windows 11 / modern Windows 10)

## Development

```bash
# Install frontend dependencies
pnpm install

# Run Rust core unit tests (midnight split, idle tail trim, rule priority, score, limits, focus)
cargo test -p pulsetrack-core

# Run full desktop app (Windows)
pnpm tauri dev

# Or preview the UI standalone in browser (uses stateful local simulator)
pnpm dev
```

## Build Native Windows Installer (NSIS & MSI)

```bash
pnpm tauri build --bundles nsis,msi
```

Installers are generated in:
- `target/release/bundle/nsis/DestTraky_1.0.0_x64-setup.exe`
- `target/release/bundle/msi/DestTraky_1.0.0_x64_en-US.msi`
