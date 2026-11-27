use crate::platform::PlatformMonitor;
use crate::tracker::WindowSample;

/// Non-Windows deterministic simulation adapter used for Linux/macOS UI development and testing.
pub struct MockMonitor {
    tick_count: u64,
}

impl Default for MockMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl MockMonitor {
    pub fn new() -> Self {
        Self { tick_count: 0 }
    }
}

impl PlatformMonitor for MockMonitor {
    fn sample_foreground(&mut self) -> Option<WindowSample> {
        self.tick_count += 1;
        let phase = (self.tick_count / 45) % 4;
        let sample = match phase {
            0 => WindowSample {
                app_name: "VS Code".into(),
                process_name: "Code.exe".into(),
                window_title: "tracker.rs — pulsetrack — Visual Studio Code".into(),
                is_fullscreen: false,
                idle_secs: 0,
                icon_key: Some("code_exe".into()),
            },
            1 => WindowSample {
                app_name: "Google Chrome".into(),
                process_name: "chrome.exe".into(),
                window_title: "PR #128 · pulsetrack · GitHub - Google Chrome".into(),
                is_fullscreen: false,
                idle_secs: 0,
                icon_key: Some("chrome_exe".into()),
            },
            2 => WindowSample {
                app_name: "Windows Terminal".into(),
                process_name: "WindowsTerminal.exe".into(),
                window_title: "cargo test --workspace".into(),
                is_fullscreen: false,
                idle_secs: 0,
                icon_key: Some("windowsterminal_exe".into()),
            },
            _ => WindowSample {
                app_name: "Google Chrome".into(),
                process_name: "chrome.exe".into(),
                window_title: "Systems Engineering Talk - YouTube - Google Chrome".into(),
                is_fullscreen: false,
                idle_secs: 0,
                icon_key: Some("chrome_exe".into()),
            },
        };
        Some(sample)
    }

    fn take_new_icon(&mut self) -> Option<(String, String)> {
        None
    }
}
