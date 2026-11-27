use std::path::PathBuf;

use crate::tracker::WindowSample;

pub trait PlatformMonitor: Send {
    /// Sample the current foreground window, fullscreen status, and input idle duration.
    fn sample_foreground(&mut self) -> Option<WindowSample>;

    /// Return a cached `data:image/png;base64,...` icon if extracted for this key.
    fn take_new_icon(&mut self) -> Option<(String, String)>;
}

#[cfg(target_os = "windows")]
pub mod windows;

pub mod mock;

pub fn create_platform_monitor(icon_cache_dir: PathBuf) -> Box<dyn PlatformMonitor> {
    #[cfg(target_os = "windows")]
    {
        Box::new(windows::WindowsMonitor::new(icon_cache_dir))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = icon_cache_dir;
        Box::new(mock::MockMonitor::new())
    }
}

/// Normalize raw Windows executable filename into a clean display label.
pub fn friendly_app_name(process_name: &str) -> String {
    let lower = process_name.trim().to_ascii_lowercase();
    match lower.as_str() {
        "code.exe" | "code" => "VS Code".into(),
        "chrome.exe" | "chrome" => "Google Chrome".into(),
        "msedge.exe" | "msedge" => "Microsoft Edge".into(),
        "firefox.exe" | "firefox" => "Firefox".into(),
        "brave.exe" | "brave" => "Brave".into(),
        "windowsterminal.exe" | "wt.exe" => "Windows Terminal".into(),
        "explorer.exe" => "File Explorer".into(),
        "slack.exe" => "Slack".into(),
        "discord.exe" => "Discord".into(),
        "spotify.exe" => "Spotify".into(),
        "figma.exe" => "Figma".into(),
        "notion.exe" => "Notion".into(),
        "obsidian.exe" => "Obsidian".into(),
        "teams.exe" | "ms-teams.exe" => "Microsoft Teams".into(),
        "zoom.exe" => "Zoom".into(),
        "vlc.exe" => "VLC".into(),
        "idea64.exe" => "IntelliJ IDEA".into(),
        "rustrover64.exe" => "RustRover".into(),
        "postman.exe" => "Postman".into(),
        "winword.exe" => "Microsoft Word".into(),
        "excel.exe" => "Microsoft Excel".into(),
        "powerpnt.exe" => "PowerPoint".into(),
        "olk.exe" | "outlook.exe" => "Outlook".into(),
        "calculatorapp.exe" => "Calculator".into(),
        "notepad.exe" => "Notepad".into(),
        "steam.exe" | "steamwebhelper.exe" => "Steam".into(),
        "pulsetrack.exe" | "pulsetrack" | "desttraky.exe" | "desttraky" | "desttraky_portable_x64.exe" => "DestTraky".into(),
        _ => {
            let stem = process_name
                .strip_suffix(".exe")
                .or_else(|| process_name.strip_suffix(".EXE"))
                .unwrap_or(process_name)
                .trim();
            if stem.is_empty() {
                "Protected / System App".into()
            } else {
                let mut chars = stem.chars();
                match chars.next() {
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                    None => "Protected / System App".into(),
                }
            }
        }
    }
}
