<div align="center">
  <a href="https://github.com/Waqar-743/DestTraky">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="src/assets/logo-light.png" />
      <source media="(prefers-color-scheme: light)" srcset="src/assets/logo-dark.png" />
      <img src="src/assets/logo-dark.png" alt="DestTraky Logo" width="112" />
    </picture>
  </a>

  <h1>DestTraky</h1>

  <p>
    <strong>A 100% free, open-source, local-first Windows screen-time, timeline &amp; productivity tracker.</strong><br />
    Non-admin Win32 tracking · Dual-lane timeline &amp; 28-day heatmap · Priority regex rules &amp; auto-tags · Bundled SQLite WAL — in a <strong>3.5 MB</strong> native Rust &amp; Tauri v2 installer.
  </p>

  <p>
    <a href="https://waqar-743.github.io/DestTraky/">
      <img alt="DestTraky Live Website" src="https://img.shields.io/badge/Website-Live%20Preview-9E7B3B?style=for-the-badge&logo=googlechrome&logoColor=white" />
    </a>
    <a href="https://github.com/Waqar-743/DestTraky/releases/latest">
      <img alt="Download DestTraky v1.0.0" src="https://img.shields.io/badge/Download-v1.0.0%20for%20Windows-D97706?style=for-the-badge&logo=windows&logoColor=white" />
    </a>
    <a href="https://github.com/Waqar-743/DestTraky/actions/workflows/build-windows.yml">
      <img alt="Windows Build CI" src="https://img.shields.io/badge/CI-Windows%20x64%20Build-181714?style=for-the-badge&logo=githubactions&logoColor=white" />
    </a>
  </p>

  <p>
    <a href="https://github.com/Waqar-743/DestTraky/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/Waqar-743/DestTraky?style=flat-square&color=D97706" /></a>
    <a href="https://github.com/Waqar-743/DestTraky/releases"><img alt="GitHub Downloads" src="https://img.shields.io/github/downloads/Waqar-743/DestTraky/total?style=flat-square&color=9E7B3B" /></a>
    <a href="https://github.com/Waqar-743/DestTraky/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/Waqar-743/DestTraky?style=flat-square&color=B45309" /></a>
    <img alt="Platform Windows 10/11 x64" src="https://img.shields.io/badge/Platform-Windows%2010%2F11%20x64-5C584E?style=flat-square" />
    <img alt="Installer Size 3.5 MB" src="https://img.shields.io/badge/Installer-3.5%20MB%20Native-181714?style=flat-square" />
  </p>

  <p>
    <a href="https://waqar-743.github.io/DestTraky/"><strong>Live Website</strong></a> ·
    <a href="#download-free-for-windows">Download</a> ·
    <a href="#core-features">Features</a> ·
    <a href="#why-desttraky">Comparison</a> ·
    <a href="#keyboard-shortcuts">Shortcuts</a> ·
    <a href="#architecture--tech-stack">Architecture</a> ·
    <a href="#development">Build from Source</a>
  </p>

  <br />

  <a href="https://waqar-743.github.io/DestTraky/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://waqar-743.github.io/DestTraky/assets/screenshots/overview-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://waqar-743.github.io/DestTraky/assets/screenshots/overview-light.png" />
      <img src="https://waqar-743.github.io/DestTraky/assets/screenshots/overview-light.png" alt="DestTraky Overview Dashboard Preview" width="960" />
    </picture>
  </a>
</div>

---

## Overview

**DestTraky** combines low-overhead native Windows foreground tracking with a calm, chart-first productivity studio — without accounts, subscriptions, telemetry, or cloud sync.

- **100% Local-First & Private:** Every session, rule, tag, focus cycle, and limit is stored locally in a bundled SQLite database (`WAL` mode). Zero bytes leave your machine.
- **Accurate, Non-Admin Windows Tracking:** Samples the active foreground window (`GetForegroundWindow`), resolves UWP child apps (`ApplicationFrameHost.exe`), detects idle time (`GetLastInputInfo`), suppresses false idle during fullscreen video or meetings, splits sessions cleanly across midnight, and handles sleep/wake gaps automatically.
- **Visual Timeline + Rule-Driven Intelligence:** Combines a zoomable dual-lane online/idle timeline, 28-day activity heatmap, and manual task logging with a deterministic priority regex rule engine, custom `#tags`, schedule auto-tags, and a live Rule Sandbox.

---

## Download (Free for Windows)

Get the latest release from [GitHub Releases](https://github.com/Waqar-743/DestTraky/releases/latest):

| Distribution | File Name | Size | Best For |
| :--- | :--- | :---: | :--- |
| **EXE Setup (Recommended)** | [`DestTraky_1.0.0_x64-setup.exe`](https://github.com/Waqar-743/DestTraky/releases/latest/download/DestTraky_1.0.0_x64-setup.exe) | `3.7 MB` | Standard Windows 10/11 installation with Start Menu & uninstaller |
| **MSI Installer** | [`DestTraky_1.0.0_x64_en-US.msi`](https://github.com/Waqar-743/DestTraky/releases/latest/download/DestTraky_1.0.0_x64_en-US.msi) | `5.2 MB` | Standard Windows Installer package for silent / managed installs |
| **Portable Executable** | [`DestTraky_portable_x64.exe`](https://github.com/Waqar-743/DestTraky/releases/latest/download/DestTraky_portable_x64.exe) | `14.4 MB` | Zero-install single binary — run directly from any folder |

> **100% Offline & Private:** Runs silently in your Windows system tray with no admin rights required. Zero telemetry, zero accounts, full CSV & JSON export anytime.

---

## Core Features

### 1. Native Windows Tracking & Smart Idle Engine
- **Foreground & UWP App Resolution:** Tracks active Win32 applications and resolves packaged UWP apps hosted inside `ApplicationFrameHost.exe`, caching native `HICON` app icons locally as PNGs.
- **Smart Idle & Fullscreen Awareness:** Uses `GetLastInputInfo` with configurable idle thresholds, trims trailing idle seconds accurately, suppresses false idle during fullscreen videos/presentations, and detects system sleep/hibernate gaps.
- **Browser Domain Parsing & Privacy Controls:** Extracts active domains from browser window titles, supports an **Ignore List** for excluded processes, splits multi-day sessions at midnight, and provides one-click **Pause / Incognito** from the top bar or system tray.

### 2. Visual Analytics & Dual-Lane Timeline
- **Overview Dashboard:** At-a-glance KPI cards (Total Active Time, Productive Time, Productivity Score `0–100`, Focus Streak, Context Switches/hr) with equal-length period comparisons (`Today`, `Yesterday`, `7D`, `30D`, `Custom`).
- **Interactive Score Columns & Ember Waves:** Switch seamlessly between hatched pill score columns (with dashed average line) and a mirrored glowing Ember Waves visualization, paired with an **Activity Mix** breakdown, **Top Apps** micro-bar meters, and a 6-petal **Session Flower** chart.
- **Dual-Lane Timeline & Heatmap:** Inspect a 28-day activity calendar strip and a zoomable (`24h / 12h / 6h`) dual-lane timeline showing `Online / Idle / Offline` status above app sessions, plus `+ Log Task` for logging offline meetings or deep work manually.

### 3. Priority Categorization Rules, Tags & Live Sandbox
- **Deterministic Rule Priority:** Evaluates rules in strict `WindowTitle > AppName > Neutral` priority order with substring and regular-expression matching.
- **Custom `#tags` & Automatic Schedule Tags:** Attach custom tags to rules and automatically classify sessions into `#Work Hours`, `#After Hours`, `#Late Night`, and `#Weekend`.
- **Live Rule Sandbox:** Test any sample app name and window title in real time to preview which rule matches, what category it assigns, and which tags are applied before saving.

### 4. Focus Timer, App Limits, Command Palette & Adaptive Themes
- **Focus Mode & Streaks:** Built-in Pomodoro timer with configurable work/short-break/long-break cycles, daily completion tracking, and streak history.
- **App & Category Limits:** Set daily time budgets per app or category with live progress bars and instant warning/exceeded toast notifications.
- **Persistent Navigation & `⌘K` Command Palette:** Slim left icon rail, persistent horizontal workspace tabs across every page, persistent date-range selector on analytical views, instant search across apps/titles/actions, and one-click CSV/JSON export.
- **Warm Alabaster & Warm Obsidian Themes:** Instant Light/Dark switching with theme-aware **DestTraky** D-arrow logos (dark mark on light surfaces, white mark on dark surfaces).

---

## Why DestTraky?

| Capability | DestTraky v1.0.0 | Cloud Trackers (RescueTime, Toggl) | Heavy Electron Trackers |
| :--- | :---: | :---: | :---: |
| **Price** | **Free & Open Source** | Monthly subscription | Free / Paid tiers |
| **Installer Size** | **3.5 MB** | 80–180 MB | 100–250 MB+ |
| **100% Local SQLite Storage** | **Yes (WAL mode)** | Cloud-first | Varies |
| **Regex Rules + Live Sandbox** | **Built-in** | Limited / Paid | Rarely built-in |
| **Dual-Lane Timeline & Manual Tasks** | **Built-in** | Paid add-ons | Partial |
| **No Account / Zero Telemetry** | **Yes** | Account required | Varies |

---

## Keyboard Shortcuts

| Action | Shortcut | Behavior |
| :--- | :---: | :--- |
| **Open Command Palette** | `Ctrl + K` / `⌘ + K` | Search apps, window titles, views, and quick actions |
| **Dismiss Modal / Palette** | `Esc` | Closes active modal dialogs or the command palette |

---

## System Requirements

| Requirement | Minimum | Recommended |
| :--- | :--- | :--- |
| **OS** | Windows 10 (64-bit) | Windows 10 / Windows 11 (64-bit) |
| **RAM** | 2 GB | 4 GB+ |
| **Disk Space** | 50 MB | 150 MB+ (for multi-year SQLite history) |
| **Runtime** | Microsoft Edge WebView2 (preinstalled on Win 11) | Microsoft Edge WebView2 Evergreen |

---

## Architecture & Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Runtime** | [Tauri v2](https://v2.tauri.app/) & [Rust](https://www.rust-lang.org/) (System Tray, Native Commands, Autostart, Single-Instance) |
| **Core Engine (`pulsetrack-core`)** | Pure Rust workspace crate with bundled SQLite (`rusqlite` WAL mode), rule matcher, analytics, limits, focus, and export engines (22 unit tests) |
| **Windows Native Layer** | Win32 APIs (`GetForegroundWindow`, `GetLastInputInfo`, UWP child window resolution, fullscreen detection, `HICON` → PNG icon cache) |
| **Frontend & Visualizations** | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Custom SVG Charts |
| **Packaging & CI** | NSIS (`installer.nsi`), `cargo-xwin` cross-compilation, GitHub Actions (`build-windows.yml`) |

---

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+) & [pnpm](https://pnpm.io/)
- [Rust & Cargo](https://rustup.rs/) (latest stable)
- Windows 10/11 with Microsoft C++ Build Tools & WebView2 Runtime

### Run Locally
```bash
git clone https://github.com/Waqar-743/DestTraky.git
cd DestTraky
pnpm install
pnpm tauri dev
```

### Run Rust Core Unit Tests
```bash
cargo test -p pulsetrack-core
```

### Build Production Installers (`.exe` & `.msi`)
```bash
pnpm build
pnpm tauri build --bundles nsis,msi
```

---

## Contributing & Community

Contributions, bug reports, and feature ideas are welcome!

- **Report a Bug / Request a Feature:** [GitHub Issues](https://github.com/Waqar-743/DestTraky/issues)
- **Releases & Changelogs:** [GitHub Releases](https://github.com/Waqar-743/DestTraky/releases)

---

## Related Projects by [Waqar Ahmed](https://waqarahmed.live/)

- [**RecordFlow**](https://github.com/Waqar-743/RecordFlow) — Privacy-first Windows screen recorder & post-recording auto-zoom studio built with Rust & Tauri v2
- [**SnapNote**](https://waqar-743.github.io/SnapNote/) — Modern desktop note-taking app with clipboard capture, OCR, and stay-on-top pinning
- [**Syslume**](https://github.com/Waqar-743/Syslume) — Windows system intelligence app for CPU, RAM, GPU, storage & process monitoring (Tauri + Rust)
- [**DocuSage**](https://github.com/Waqar-743/DocuSage) — Offline RAG + AI chat desktop companion for private local document Q&A
- [**Waqar Ahmed Portfolio**](https://waqarahmed.live/) — More open-source apps, desktop tools, and web engineering projects

---

<p align="center">
  Built with care by <a href="https://waqarahmed.live/"><strong>Waqar Ahmed (@Waqar-743)</strong></a> · 100% free and open source
</p>
