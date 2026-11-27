/// Known browser process names (lowercase without .exe or with .exe)
const BROWSER_PROCESSES: &[&str] = &[
    "chrome",
    "chrome.exe",
    "msedge",
    "msedge.exe",
    "firefox",
    "firefox.exe",
    "brave",
    "brave.exe",
    "opera",
    "opera.exe",
    "vivaldi",
    "vivaldi.exe",
    "arc",
    "arc.exe",
    "waterfox",
    "waterfox.exe",
    "zen",
    "zen.exe",
];

const BROWSER_SUFFIXES: &[&str] = &[
    " - Google Chrome",
    " — Google Chrome",
    " - Microsoft​ Edge",
    " - Microsoft Edge",
    " — Microsoft Edge",
    " - Mozilla Firefox",
    " — Mozilla Firefox",
    " - Brave",
    " — Brave",
    " - Opera",
    " — Opera",
    " - Vivaldi",
    " — Vivaldi",
    " - Arc",
    " — Arc",
    " - Zen Browser",
    " — Zen Browser",
];

const KNOWN_SERVICES: &[(&str, &str)] = &[
    ("github", "GitHub"),
    ("gitlab", "GitLab"),
    ("stackoverflow", "Stack Overflow"),
    ("stack overflow", "Stack Overflow"),
    ("youtube", "YouTube"),
    ("twitch", "Twitch"),
    ("reddit", "Reddit"),
    ("x.com", "X"),
    (" / x", "X"),
    ("twitter", "X"),
    ("figma", "Figma"),
    ("linear", "Linear"),
    ("notion", "Notion"),
    ("jira", "Jira"),
    ("confluence", "Confluence"),
    ("slack", "Slack"),
    ("discord", "Discord"),
    ("gmail", "Gmail"),
    ("google docs", "Google Docs"),
    ("google sheets", "Google Sheets"),
    ("google drive", "Google Drive"),
    ("google calendar", "Google Calendar"),
    ("google meet", "Google Meet"),
    ("chatgpt", "ChatGPT"),
    ("claude", "Claude"),
    ("gemini", "Gemini"),
    ("localhost", "localhost"),
    ("127.0.0.1", "localhost"),
    ("vercel", "Vercel"),
    ("netlify", "Netlify"),
    ("aws", "AWS Console"),
    ("hacker news", "Hacker News"),
    ("netflix", "Netflix"),
    ("spotify", "Spotify"),
    ("linkedin", "LinkedIn"),
    ("instagram", "Instagram"),
    ("tiktok", "TikTok"),
    ("wikipedia", "Wikipedia"),
    ("mdn web docs", "MDN Docs"),
    ("rust-lang", "Rust Docs"),
    ("docs.rs", "docs.rs"),
    ("crates.io", "crates.io"),
    ("npmjs", "npm"),
];

pub fn is_browser(process_name: &str, app_name: &str) -> bool {
    let p = process_name.trim().to_ascii_lowercase();
    let a = app_name.trim().to_ascii_lowercase();
    BROWSER_PROCESSES.iter().any(|b| p == *b || a.contains(&b.replace(".exe", "")))
}

/// Extract clean website or workspace context from a browser window title,
/// while callers retain the full raw title for categorization rules and detailed logs.
pub fn parse_browser_context(process_name: &str, app_name: &str, window_title: &str) -> Option<String> {
    if !is_browser(process_name, app_name) {
        return None;
    }

    let trimmed = window_title.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Strip browser name & profile suffix (e.g. " - Google Chrome", " and 3 more pages - Work - Microsoft Edge")
    let mut cleaned = trimmed.to_string();
    for suffix in BROWSER_SUFFIXES {
        if let Some(idx) = cleaned.rfind(suffix) {
            cleaned.truncate(idx);
            break;
        }
    }

    // Strip Edge tab count noise like " and 4 more pages - Profile 1"
    if let Some(idx) = cleaned.find(" and ") {
        let tail = &cleaned[idx..];
        if tail.contains(" more page") {
            cleaned.truncate(idx);
        }
    }

    // Strip trailing Chrome/Edge profile indicators like " - Personal" or " - Work"
    for profile_tag in [" - Personal", " - Work", " - Profile 1", " - InPrivate", " (Incognito)"] {
        if cleaned.ends_with(profile_tag) {
            let new_len = cleaned.len() - profile_tag.len();
            cleaned.truncate(new_len);
        }
    }

    let cleaned = cleaned.trim();
    if cleaned.is_empty() || cleaned.eq_ignore_ascii_case("New Tab") {
        return Some("New Tab".to_string());
    }

    // Check for explicit domain-like token (e.g. github.com, docs.rs, localhost:3000)
    if let Some(domain) = extract_domain_token(cleaned) {
        return Some(domain);
    }

    // Match well-known web apps / sites
    let lower = cleaned.to_ascii_lowercase();
    for (needle, label) in KNOWN_SERVICES {
        if lower.contains(needle) {
            return Some((*label).to_string());
        }
    }

    // Otherwise pick the most meaningful trailing segment separated by " - ", " | ", or " · "
    for sep in [" - ", " — ", " | ", " · ", " :: "] {
        if cleaned.contains(sep) {
            let parts: Vec<&str> = cleaned
                .split(sep)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect();
            if let Some(last) = parts.last() {
                if last.len() <= 42 {
                    return Some((*last).to_string());
                }
            }
        }
    }

    // Fallback: truncate cleanly to 42 chars
    let short: String = cleaned.chars().take(42).collect();
    Some(short)
}

fn extract_domain_token(text: &str) -> Option<String> {
    for raw in text.split(|c: char| c.is_whitespace() || matches!(c, '(' | ')' | '[' | ']' | '<' | '>' | ',' | ';' | '"' | '\'')) {
        let token = raw
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_start_matches("www.")
            .split('/')
            .next()
            .unwrap_or("")
            .trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '.' && c != '-' && c != ':');

        if token.starts_with("localhost") || token.starts_with("127.0.0.1") {
            return Some(token.to_string());
        }

        if let Some((host, tld)) = token.rsplit_once('.') {
            let valid_tld = matches!(
                tld.to_ascii_lowercase().as_str(),
                "com" | "org" | "net" | "io" | "dev" | "app" | "ai" | "co" | "rs" | "gg" | "tv" | "edu" | "gov" | "me" | "so"
            );
            if valid_tld && !host.is_empty() && host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
                return Some(token.to_ascii_lowercase());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_chrome_github_title() {
        let ctx = parse_browser_context(
            "chrome.exe",
            "Google Chrome",
            "pulsetrack/src/lib.rs at main · user/pulsetrack · GitHub - Google Chrome",
        );
        assert_eq!(ctx.as_deref(), Some("GitHub"));
    }

    #[test]
    fn parses_edge_localhost_and_more_pages() {
        let ctx = parse_browser_context(
            "msedge.exe",
            "Microsoft Edge",
            "localhost:5173/dashboard and 3 more pages - Work - Microsoft Edge",
        );
        assert_eq!(ctx.as_deref(), Some("localhost:5173"));
    }

    #[test]
    fn parses_firefox_youtube() {
        let ctx = parse_browser_context(
            "firefox.exe",
            "Firefox",
            "Rust Async Deep Dive - YouTube — Mozilla Firefox",
        );
        assert_eq!(ctx.as_deref(), Some("YouTube"));
    }

    #[test]
    fn returns_none_for_non_browser() {
        let ctx = parse_browser_context("Code.exe", "Visual Studio Code", "lib.rs - pulsetrack");
        assert!(ctx.is_none());
    }
}
