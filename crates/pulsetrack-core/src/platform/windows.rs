use std::collections::{HashSet, VecDeque};
use std::ffi::OsString;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::path::{Path, PathBuf};

use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{BOOL, CloseHandle, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetMonitorInfoW, MonitorFromWindow,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::System::SystemInformation::GetTickCount;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
use windows::Win32::UI::Shell::ExtractIconExW;
use windows::Win32::UI::WindowsAndMessaging::{
    DestroyIcon, EnumChildWindows, GetClassNameW, GetForegroundWindow, GetIconInfo,
    GetWindowRect, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, HICON,
    ICONINFO,
};

use crate::platform::{friendly_app_name, PlatformMonitor};
use crate::tracker::WindowSample;

const PROTECTED_FALLBACK: &str = "Protected / System App";

pub struct WindowsMonitor {
    icon_cache_dir: PathBuf,
    seen_icons: HashSet<String>,
    pending_icons: VecDeque<(String, String)>,
}

impl WindowsMonitor {
    pub fn new(icon_cache_dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&icon_cache_dir);
        Self {
            icon_cache_dir,
            seen_icons: HashSet::new(),
            pending_icons: VecDeque::new(),
        }
    }

    fn ensure_icon_cached(&mut self, exe_path: &Path, icon_key: &str) {
        if self.seen_icons.contains(icon_key) {
            return;
        }
        self.seen_icons.insert(icon_key.to_string());

        let png_path = self.icon_cache_dir.join(format!("{icon_key}.png"));
        let png_bytes = if png_path.exists() {
            std::fs::read(&png_path).ok()
        } else {
            let extracted = extract_exe_icon_png(exe_path);
            if let Some(ref bytes) = extracted {
                let _ = std::fs::write(&png_path, bytes);
            }
            extracted
        };

        if let Some(bytes) = png_bytes {
            let b64 = base64_encode(&bytes);
            self.pending_icons
                .push_back((icon_key.to_string(), format!("data:image/png;base64,{b64}")));
        }
    }
}

impl PlatformMonitor for WindowsMonitor {
    fn sample_foreground(&mut self) -> Option<WindowSample> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return None;
            }

            let window_title = get_window_title(hwnd);
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));

            // Resolve process executable path without admin privileges.
            let mut exe_path = query_process_image_path(pid);
            let mut proc_name = exe_path
                .as_ref()
                .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
                .unwrap_or_else(|| "protected".to_string());

            // Modern Windows Store / UWP app resolution:
            // ApplicationFrameHost.exe hosts the real UWP app inside a child window with a distinct PID.
            if proc_name.eq_ignore_ascii_case("ApplicationFrameHost.exe") {
                if let Some(uwp_pid) = find_uwp_child_pid(hwnd, pid) {
                    if let Some(child_path) = query_process_image_path(uwp_pid) {
                        if let Some(fname) = child_path.file_name() {
                            proc_name = fname.to_string_lossy().to_string();
                        }
                        exe_path = Some(child_path);
                    }
                }
            }

            let app_name = if exe_path.is_none() {
                PROTECTED_FALLBACK.to_string()
            } else {
                friendly_app_name(&proc_name)
            };

            let icon_key = if let Some(ref path) = exe_path {
                let key = sanitize_icon_key(&proc_name);
                self.ensure_icon_cached(path, &key);
                Some(key)
            } else {
                None
            };

            let idle_secs = get_idle_seconds();
            let is_fullscreen = is_window_fullscreen(hwnd);

            Some(WindowSample {
                app_name,
                process_name: proc_name,
                window_title: if window_title.is_empty() {
                    PROTECTED_FALLBACK.to_string()
                } else {
                    window_title
                },
                is_fullscreen,
                idle_secs,
                icon_key,
            })
        }
    }

    fn take_new_icon(&mut self) -> Option<(String, String)> {
        self.pending_icons.pop_front()
    }
}

unsafe fn get_window_title(hwnd: HWND) -> String {
    let len = GetWindowTextLengthW(hwnd);
    if len <= 0 {
        return String::new();
    }
    let mut buf = vec![0u16; (len + 1) as usize];
    let copied = GetWindowTextW(hwnd, &mut buf);
    if copied <= 0 {
        return String::new();
    }
    OsString::from_wide(&buf[..copied as usize])
        .to_string_lossy()
        .trim()
        .to_string()
}

unsafe fn get_window_class(hwnd: HWND) -> String {
    let mut buf = [0u16; 128];
    let copied = GetClassNameW(hwnd, &mut buf);
    if copied <= 0 {
        return String::new();
    }
    OsString::from_wide(&buf[..copied as usize])
        .to_string_lossy()
        .to_string()
}

unsafe fn query_process_image_path(pid: u32) -> Option<PathBuf> {
    if pid == 0 {
        return None;
    }
    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut buf = vec![0u16; 1024];
    let mut size = buf.len() as u32;
    let ok = QueryFullProcessImageNameW(
        handle,
        PROCESS_NAME_WIN32,
        PWSTR(buf.as_mut_ptr()),
        &mut size,
    )
    .is_ok();
    let _ = CloseHandle(handle);

    if !ok || size == 0 {
        return None;
    }
    let os_str = OsString::from_wide(&buf[..size as usize]);
    Some(PathBuf::from(os_str))
}

struct UwpSearchCtx {
    host_pid: u32,
    found_pid: Option<u32>,
}

unsafe extern "system" fn enum_uwp_child_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let ctx = &mut *(lparam.0 as *mut UwpSearchCtx);
    let mut child_pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut child_pid));
    if child_pid != 0 && child_pid != ctx.host_pid {
        let cls = get_window_class(hwnd);
        if cls == "Windows.UI.Core.CoreWindow" || ctx.found_pid.is_none() {
            ctx.found_pid = Some(child_pid);
            if cls == "Windows.UI.Core.CoreWindow" {
                return BOOL(0); // Stop enumeration once CoreWindow is found
            }
        }
    }
    BOOL(1)
}

unsafe fn find_uwp_child_pid(host_hwnd: HWND, host_pid: u32) -> Option<u32> {
    let mut ctx = UwpSearchCtx {
        host_pid,
        found_pid: None,
    };
    let _ = EnumChildWindows(
        host_hwnd,
        Some(enum_uwp_child_proc),
        LPARAM(&mut ctx as *mut UwpSearchCtx as isize),
    );
    ctx.found_pid
}

unsafe fn get_idle_seconds() -> u64 {
    let mut lii = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    if GetLastInputInfo(&mut lii).as_bool() {
        let now_ticks = GetTickCount();
        let elapsed_ms = now_ticks.wrapping_sub(lii.dwTime);
        (elapsed_ms / 1000) as u64
    } else {
        0
    }
}

unsafe fn is_window_fullscreen(hwnd: HWND) -> bool {
    let cls = get_window_class(hwnd);
    if matches!(cls.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
        return false;
    }

    let mut win_rect = RECT::default();
    if GetWindowRect(hwnd, &mut win_rect).is_err() {
        return false;
    }

    let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    if monitor.0.is_null() {
        return false;
    }

    let mut mon_info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    if !GetMonitorInfoW(monitor, &mut mon_info).as_bool() {
        return false;
    }

    let mr = mon_info.rcMonitor;
    win_rect.left <= mr.left
        && win_rect.top <= mr.top
        && win_rect.right >= mr.right
        && win_rect.bottom >= mr.bottom
}

fn sanitize_icon_key(proc_name: &str) -> String {
    proc_name
        .to_ascii_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect()
}

/// Extract primary 32x32 application icon from a Windows executable and encode as PNG bytes.
fn extract_exe_icon_png(exe_path: &Path) -> Option<Vec<u8>> {
    unsafe {
        let wide: Vec<u16> = exe_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut large_icon = HICON::default();
        let extracted = ExtractIconExW(PCWSTR(wide.as_ptr()), 0, Some(&mut large_icon), None, 1);
        if extracted == 0 || large_icon.0.is_null() {
            return None;
        }

        let result = hicon_to_png(large_icon);
        let _ = DestroyIcon(large_icon);
        result
    }
}

unsafe fn hicon_to_png(hicon: HICON) -> Option<Vec<u8>> {
    let mut icon_info = ICONINFO::default();
    if GetIconInfo(hicon, &mut icon_info).is_err() {
        return None;
    }

    let width = 32i32;
    let height = 32i32;
    let hdc = CreateCompatibleDC(None);
    if hdc.0.is_null() {
        let _ = DeleteObject(icon_info.hbmColor);
        let _ = DeleteObject(icon_info.hbmMask);
        return None;
    }

    let mut bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height, // top-down DIB
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };

    let mut bgra = vec![0u8; (width * height * 4) as usize];
    let lines = GetDIBits(
        hdc,
        icon_info.hbmColor,
        0,
        height as u32,
        Some(bgra.as_mut_ptr() as *mut _),
        &mut bmi,
        DIB_RGB_COLORS,
    );

    let _ = DeleteDC(hdc);
    let _ = DeleteObject(icon_info.hbmColor);
    let _ = DeleteObject(icon_info.hbmMask);

    if lines == 0 {
        return None;
    }

    // Convert BGRA -> RGBA
    for px in bgra.chunks_exact_mut(4) {
        px.swap(0, 2);
    }

    let img = image::RgbaImage::from_raw(width as u32, height as u32, bgra)?;
    let mut png_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png).ok()?;
    Some(png_bytes)
}

fn base64_encode(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((input.len() + 2) / 3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 { TABLE[((triple >> 6) & 0x3F) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[(triple & 0x3F) as usize] as char } else { '=' });
    }
    out
}
