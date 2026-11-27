use chrono::{DateTime, Datelike, Local, Timelike, Weekday};
use regex::RegexBuilder;

use crate::models::{CategoryRule, IgnoreRule, RuleMatchType, RuleTestResult, CATEGORY_NEUTRAL_ID};

fn pattern_matches(haystack: &str, pattern: &str, is_regex: bool) -> bool {
    let pat = pattern.trim();
    if pat.is_empty() {
        return false;
    }
    if is_regex {
        RegexBuilder::new(pat)
            .case_insensitive(true)
            .size_limit(1 << 18)
            .build()
            .map(|re| re.is_match(haystack))
            .unwrap_or(false)
    } else {
        haystack.to_ascii_lowercase().contains(&pat.to_ascii_lowercase())
    }
}

fn app_pattern_matches(app_name: &str, process_name: &str, pattern: &str, is_regex: bool) -> bool {
    let pat = pattern.trim();
    if pat.is_empty() {
        return false;
    }
    if is_regex {
        return pattern_matches(app_name, pat, true) || pattern_matches(process_name, pat, true);
    }
    let app_lower = app_name.to_ascii_lowercase();
    let proc_lower = process_name.to_ascii_lowercase();
    let proc_stem = proc_lower.strip_suffix(".exe").unwrap_or(&proc_lower);
    let pat_lower = pat.to_ascii_lowercase();
    let pat_stem = pat_lower.strip_suffix(".exe").unwrap_or(&pat_lower);
    app_lower == pat_lower
        || app_lower.contains(&pat_lower)
        || proc_lower == pat_lower
        || proc_stem == pat_stem
}

/// Evaluate classification rules in strict priority order (supports both substring and arbtt-style regex):
/// 1. Window-title keyword/regex rules (priority DESC, pattern length DESC)
/// 2. Application-level rules (priority DESC, pattern length DESC)
/// 3. Fallback to Neutral
pub fn classify_activity(
    app_name: &str,
    process_name: &str,
    window_title: &str,
    rules: &[CategoryRule],
) -> String {
    match_rule_detailed(app_name, process_name, window_title, rules).0
}

pub fn match_rule_detailed(
    app_name: &str,
    process_name: &str,
    window_title: &str,
    rules: &[CategoryRule],
) -> (String, Option<CategoryRule>, Vec<String>) {
    let mut tags = Vec::new();
    let mut matched: Option<CategoryRule> = None;

    // Tier 1: Window-title rules
    let mut title_rules: Vec<&CategoryRule> = rules
        .iter()
        .filter(|r| r.match_type == RuleMatchType::WindowTitle && !r.pattern.trim().is_empty())
        .collect();
    title_rules.sort_by(|a, b| {
        b.priority
            .cmp(&a.priority)
            .then_with(|| b.pattern.len().cmp(&a.pattern.len()))
    });

    for rule in title_rules {
        if pattern_matches(window_title, &rule.pattern, rule.is_regex) {
            if let Some(tag) = &rule.tag {
                let t = tag.trim();
                if !t.is_empty() && !tags.iter().any(|x| x == t) {
                    tags.push(t.to_string());
                }
            }
            if matched.is_none() {
                matched = Some(rule.clone());
            }
        }
    }

    // Tier 2: Application-level rules
    let mut app_rules: Vec<&CategoryRule> = rules
        .iter()
        .filter(|r| r.match_type == RuleMatchType::AppName && !r.pattern.trim().is_empty())
        .collect();
    app_rules.sort_by(|a, b| {
        b.priority
            .cmp(&a.priority)
            .then_with(|| b.pattern.len().cmp(&a.pattern.len()))
    });

    for rule in app_rules {
        if app_pattern_matches(app_name, process_name, &rule.pattern, rule.is_regex) {
            if let Some(tag) = &rule.tag {
                let t = tag.trim();
                if !t.is_empty() && !tags.iter().any(|x| x == t) {
                    tags.push(t.to_string());
                }
            }
            if matched.is_none() {
                matched = Some(rule.clone());
            }
        }
    }

    let category_id = matched
        .as_ref()
        .map(|r| r.category_id.clone())
        .unwrap_or_else(|| CATEGORY_NEUTRAL_ID.to_string());

    (category_id, matched, tags)
}

/// Derive arbtt-inspired time-of-day & schedule tags from a local timestamp.
pub fn derive_schedule_tag(ts_ms: i64) -> String {
    let Some(dt) = DateTime::from_timestamp_millis(ts_ms).map(|u| u.with_timezone(&Local)) else {
        return "Work Hours".to_string();
    };
    if matches!(dt.weekday(), Weekday::Sat | Weekday::Sun) {
        return "Weekend".to_string();
    }
    let h = dt.hour();
    if (9..18).contains(&h) {
        "Work Hours".to_string()
    } else if h >= 22 || h < 6 {
        "Late Night".to_string()
    } else {
        "After Hours".to_string()
    }
}

/// Interactive rule sandbox evaluator (arbtt-style) for the Rules UI.
pub fn test_rule_evaluation(
    app_name: &str,
    process_name: &str,
    window_title: &str,
    rules: &[CategoryRule],
    ignore_rules: &[IgnoreRule],
    now_ms: i64,
) -> RuleTestResult {
    let ignored = is_ignored(app_name, process_name, window_title, ignore_rules);
    let (category_id, matched, mut tags) =
        match_rule_detailed(app_name, process_name, window_title, rules);
    tags.push(derive_schedule_tag(now_ms));
    RuleTestResult {
        category_id,
        matched_rule_id: matched.as_ref().map(|r| r.id.clone()),
        matched_pattern: matched.as_ref().map(|r| r.pattern.clone()),
        ignored,
        tags,
    }
}

/// Returns true if the active app or window title matches any ignore-list entry (substring or regex).
pub fn is_ignored(
    app_name: &str,
    process_name: &str,
    window_title: &str,
    ignore_rules: &[IgnoreRule],
) -> bool {
    for rule in ignore_rules {
        if rule.pattern.trim().is_empty() {
            continue;
        }
        match rule.match_type {
            RuleMatchType::WindowTitle => {
                if pattern_matches(window_title, &rule.pattern, rule.is_regex) {
                    return true;
                }
            }
            RuleMatchType::AppName => {
                if app_pattern_matches(app_name, process_name, &rule.pattern, rule.is_regex) {
                    return true;
                }
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CATEGORY_DISTRACTING_ID, CATEGORY_PRODUCTIVE_ID};

    fn rule(
        id: &str,
        match_type: RuleMatchType,
        pattern: &str,
        category_id: &str,
        priority: i32,
        is_regex: bool,
        tag: Option<&str>,
    ) -> CategoryRule {
        CategoryRule {
            id: id.into(),
            match_type,
            pattern: pattern.into(),
            category_id: category_id.into(),
            priority,
            is_regex,
            tag: tag.map(String::from),
        }
    }

    #[test]
    fn window_title_rule_overrides_app_rule() {
        let rules = vec![
            rule("1", RuleMatchType::AppName, "chrome.exe", CATEGORY_NEUTRAL_ID, 100, false, None),
            rule("2", RuleMatchType::WindowTitle, "youtube", CATEGORY_DISTRACTING_ID, 10, false, Some("video")),
            rule("3", RuleMatchType::WindowTitle, "github", CATEGORY_PRODUCTIVE_ID, 10, false, Some("code")),
        ];

        assert_eq!(
            classify_activity("Google Chrome", "chrome.exe", "Funny Cats - YouTube - Google Chrome", &rules),
            CATEGORY_DISTRACTING_ID
        );
        assert_eq!(
            classify_activity("Google Chrome", "chrome.exe", "PR #42 · GitHub - Google Chrome", &rules),
            CATEGORY_PRODUCTIVE_ID
        );
        assert_eq!(
            classify_activity("Google Chrome", "chrome.exe", "Weather Forecast - Google Chrome", &rules),
            CATEGORY_NEUTRAL_ID
        );
    }

    #[test]
    fn supports_arbtt_style_regex_rules_and_tags() {
        let rules = vec![
            rule("rx1", RuleMatchType::WindowTitle, r"PR #\d+|pull/\d+", CATEGORY_PRODUCTIVE_ID, 40, true, Some("code-review")),
            rule("rx2", RuleMatchType::AppName, r"^code(\.exe)?$", CATEGORY_PRODUCTIVE_ID, 10, true, Some("editor")),
        ];
        let (cat, matched, tags) = match_rule_detailed("VS Code", "Code.exe", "Fix #9 · PR #128 - GitHub", &rules);
        assert_eq!(cat, CATEGORY_PRODUCTIVE_ID);
        assert_eq!(matched.unwrap().id, "rx1");
        assert!(tags.contains(&"code-review".to_string()));
        assert!(tags.contains(&"editor".to_string()));
    }

    #[test]
    fn falls_back_to_neutral_when_no_rule_matches() {
        let rules = vec![rule("1", RuleMatchType::AppName, "code.exe", CATEGORY_PRODUCTIVE_ID, 10, false, None)];
        assert_eq!(
            classify_activity("Notepad", "notepad.exe", "notes.txt", &rules),
            CATEGORY_NEUTRAL_ID
        );
    }

    #[test]
    fn higher_priority_title_rule_wins() {
        let rules = vec![
            rule("1", RuleMatchType::WindowTitle, "youtube", CATEGORY_DISTRACTING_ID, 10, false, None),
            rule("2", RuleMatchType::WindowTitle, "rust tutorial", CATEGORY_PRODUCTIVE_ID, 50, false, None),
        ];
        assert_eq!(
            classify_activity("Chrome", "chrome.exe", "Rust Tutorial - YouTube", &rules),
            CATEGORY_PRODUCTIVE_ID
        );
    }

    #[test]
    fn ignore_list_blocks_matching_apps_and_titles() {
        let ignores = vec![
            IgnoreRule {
                id: "i1".into(),
                match_type: RuleMatchType::AppName,
                pattern: "1password.exe".into(),
                is_regex: false,
            },
            IgnoreRule {
                id: "i2".into(),
                match_type: RuleMatchType::WindowTitle,
                pattern: r"(incognito|inprivate)".into(),
                is_regex: true,
            },
        ];

        assert!(is_ignored("1Password", "1password.exe", "Vault", &ignores));
        assert!(is_ignored("Chrome", "chrome.exe", "Private Search (Incognito)", &ignores));
        assert!(is_ignored("Edge", "msedge.exe", "Banking - InPrivate", &ignores));
        assert!(!is_ignored("VS Code", "Code.exe", "main.rs", &ignores));
    }
}
