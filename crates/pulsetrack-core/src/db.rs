use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};
use thiserror::Error;

use crate::models::{
    ActivitySession, AppSettings, Category, CategoryRule, DailyLimit, FocusConfig,
    FocusSessionRecord, IgnoreRule, LimitTargetType, ProductivityKind, RuleMatchType,
    CATEGORY_DISTRACTING_ID, CATEGORY_NEUTRAL_ID, CATEGORY_PRODUCTIVE_ID,
};
use crate::rules::classify_activity;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, DbError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.init_pragmas()?;
        db.migrate()?;
        db.seed_defaults()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self, DbError> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.init_pragmas()?;
        db.migrate()?;
        db.seed_defaults()?;
        Ok(db)
    }

    fn init_pragmas(&self) -> Result<(), DbError> {
        self.conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA temp_store = MEMORY;
            ",
        )?;
        Ok(())
    }

    fn migrate(&self) -> Result<(), DbError> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                kind TEXT NOT NULL,
                weight REAL NOT NULL,
                is_system INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS category_rules (
                id TEXT PRIMARY KEY,
                match_type TEXT NOT NULL,
                pattern TEXT NOT NULL,
                category_id TEXT NOT NULL,
                priority INTEGER NOT NULL DEFAULT 10,
                is_regex INTEGER NOT NULL DEFAULT 0,
                tag TEXT,
                FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ignore_rules (
                id TEXT PRIMARY KEY,
                match_type TEXT NOT NULL,
                pattern TEXT NOT NULL,
                is_regex INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS activity_sessions (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                app_name TEXT NOT NULL,
                process_name TEXT NOT NULL,
                window_title TEXT NOT NULL,
                domain_context TEXT,
                category_id TEXT NOT NULL,
                start_ts INTEGER NOT NULL,
                end_ts INTEGER NOT NULL,
                duration_secs INTEGER NOT NULL,
                icon_key TEXT,
                tags TEXT NOT NULL DEFAULT '[]',
                is_manual INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_date ON activity_sessions(date);
            CREATE INDEX IF NOT EXISTS idx_sessions_start_ts ON activity_sessions(start_ts);
            CREATE INDEX IF NOT EXISTS idx_sessions_app ON activity_sessions(app_name);

            CREATE TABLE IF NOT EXISTS daily_limits (
                id TEXT PRIMARY KEY,
                target_type TEXT NOT NULL,
                target_value TEXT NOT NULL,
                daily_limit_mins INTEGER NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                notify_at_80 INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS focus_sessions (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                start_ts INTEGER NOT NULL,
                end_ts INTEGER NOT NULL,
                planned_secs INTEGER NOT NULL,
                completed_secs INTEGER NOT NULL,
                completed INTEGER NOT NULL DEFAULT 1,
                distractions_count INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_focus_date ON focus_sessions(date);

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_icons (
                icon_key TEXT PRIMARY KEY,
                data_url TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            ",
        )?;

        // Idempotent upgrades for existing databases
        let _ = self.conn.execute("ALTER TABLE category_rules ADD COLUMN is_regex INTEGER NOT NULL DEFAULT 0", []);
        let _ = self.conn.execute("ALTER TABLE category_rules ADD COLUMN tag TEXT", []);
        let _ = self.conn.execute("ALTER TABLE ignore_rules ADD COLUMN is_regex INTEGER NOT NULL DEFAULT 0", []);
        let _ = self.conn.execute("ALTER TABLE activity_sessions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'", []);
        let _ = self.conn.execute("ALTER TABLE activity_sessions ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0", []);

        Ok(())
    }

    fn seed_defaults(&self) -> Result<(), DbError> {
        // Warm Obsidian/Amber/Stone/Vermilion system categories (no blue, pink, or light green)
        let cat_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;
        if cat_count == 0 {
            let defaults = [
                (CATEGORY_PRODUCTIVE_ID, "Productive", "#D98A1C", "productive", 1.0, 1),
                (CATEGORY_NEUTRAL_ID, "Neutral", "#8A8478", "neutral", 0.5, 1),
                (CATEGORY_DISTRACTING_ID, "Distracting", "#C84630", "distracting", 0.0, 1),
            ];
            for (id, name, color, kind, weight, is_sys) in defaults {
                self.conn.execute(
                    "INSERT OR IGNORE INTO categories (id, name, color, kind, weight, is_system) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![id, name, color, kind, weight, is_sys],
                )?;
            }
        }

        let rule_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM category_rules", [], |r| r.get(0))?;
        if rule_count == 0 {
            let starter_rules = [
                ("rule-title-youtube", "window_title", "youtube", CATEGORY_DISTRACTING_ID, 20),
                ("rule-title-reddit", "window_title", "reddit", CATEGORY_DISTRACTING_ID, 20),
                ("rule-title-twitch", "window_title", "twitch", CATEGORY_DISTRACTING_ID, 20),
                ("rule-title-netflix", "window_title", "netflix", CATEGORY_DISTRACTING_ID, 20),
                ("rule-title-x", "window_title", " / x", CATEGORY_DISTRACTING_ID, 20),
                ("rule-title-github", "window_title", "github", CATEGORY_PRODUCTIVE_ID, 30),
                ("rule-title-linear", "window_title", "linear", CATEGORY_PRODUCTIVE_ID, 30),
                ("rule-title-figma", "window_title", "figma", CATEGORY_PRODUCTIVE_ID, 30),
                ("rule-title-docs", "window_title", "docs.rs", CATEGORY_PRODUCTIVE_ID, 30),
                ("rule-title-localhost", "window_title", "localhost", CATEGORY_PRODUCTIVE_ID, 25),
                ("rule-app-code", "app_name", "Code.exe", CATEGORY_PRODUCTIVE_ID, 10),
                ("rule-app-wt", "app_name", "WindowsTerminal.exe", CATEGORY_PRODUCTIVE_ID, 10),
                ("rule-app-idea", "app_name", "idea64.exe", CATEGORY_PRODUCTIVE_ID, 10),
                ("rule-app-figma", "app_name", "Figma.exe", CATEGORY_PRODUCTIVE_ID, 10),
                ("rule-app-notion", "app_name", "Notion.exe", CATEGORY_PRODUCTIVE_ID, 10),
                ("rule-app-obsidian", "app_name", "Obsidian.exe", CATEGORY_PRODUCTIVE_ID, 10),
                ("rule-app-discord", "app_name", "Discord.exe", CATEGORY_DISTRACTING_ID, 10),
                ("rule-app-steam", "app_name", "steam.exe", CATEGORY_DISTRACTING_ID, 10),
            ];
            for (id, mtype, pat, cat, prio) in starter_rules {
                self.conn.execute(
                    "INSERT OR IGNORE INTO category_rules (id, match_type, pattern, category_id, priority) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![id, mtype, pat, cat, prio],
                )?;
            }
        }

        // Default settings if absent
        let has_settings: Option<String> = self
            .conn
            .query_row("SELECT value FROM settings WHERE key = 'app_settings'", [], |r| r.get(0))
            .optional()?;
        if has_settings.is_none() {
            self.save_settings(&AppSettings::default())?;
        }

        let has_focus_cfg: Option<String> = self
            .conn
            .query_row("SELECT value FROM settings WHERE key = 'focus_config'", [], |r| r.get(0))
            .optional()?;
        if has_focus_cfg.is_none() {
            self.save_focus_config(&FocusConfig::default())?;
        }

        Ok(())
    }

    pub fn upsert_sessions(&self, sessions: &[ActivitySession]) -> Result<(), DbError> {
        if sessions.is_empty() {
            return Ok(());
        }
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO activity_sessions
                (id, date, app_name, process_name, window_title, domain_context, category_id, start_ts, end_ts, duration_secs, icon_key, tags, is_manual)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                ON CONFLICT(id) DO UPDATE SET
                    date = excluded.date,
                    category_id = excluded.category_id,
                    end_ts = excluded.end_ts,
                    duration_secs = excluded.duration_secs,
                    icon_key = COALESCE(excluded.icon_key, activity_sessions.icon_key),
                    tags = excluded.tags,
                    is_manual = excluded.is_manual",
            )?;
            for s in sessions {
                let tags_json = serde_json::to_string(&s.tags).unwrap_or_else(|_| "[]".to_string());
                stmt.execute(params![
                    s.id,
                    s.date,
                    s.app_name,
                    s.process_name,
                    s.window_title,
                    s.domain_context,
                    s.category_id,
                    s.start_ts,
                    s.end_ts,
                    s.duration_secs,
                    s.icon_key,
                    tags_json,
                    if s.is_manual { 1 } else { 0 },
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn query_sessions(&self, start_date: &str, end_date: &str) -> Result<Vec<ActivitySession>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, date, app_name, process_name, window_title, domain_context, category_id, start_ts, end_ts, duration_secs, icon_key, tags, is_manual
             FROM activity_sessions
             WHERE date >= ?1 AND date <= ?2
             ORDER BY start_ts ASC",
        )?;
        let rows = stmt.query_map(params![start_date, end_date], |row| {
            let tags_raw: String = row.get(11).unwrap_or_else(|_| "[]".to_string());
            let tags: Vec<String> = serde_json::from_str(&tags_raw).unwrap_or_default();
            let manual: i64 = row.get(12).unwrap_or(0);
            Ok(ActivitySession {
                id: row.get(0)?,
                date: row.get(1)?,
                app_name: row.get(2)?,
                process_name: row.get(3)?,
                window_title: row.get(4)?,
                domain_context: row.get(5)?,
                category_id: row.get(6)?,
                start_ts: row.get(7)?,
                end_ts: row.get(8)?,
                duration_secs: row.get(9)?,
                icon_key: row.get(10)?,
                tags,
                is_manual: manual != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn list_categories(&self) -> Result<Vec<Category>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, color, kind, weight, is_system FROM categories ORDER BY is_system DESC, name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let kind_str: String = row.get(3)?;
            let is_sys: i64 = row.get(5)?;
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                kind: ProductivityKind::from_str(&kind_str),
                weight: row.get(4)?,
                is_system: is_sys != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn save_category(&self, cat: &Category) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT INTO categories (id, name, color, kind, weight, is_system)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                color = excluded.color,
                kind = excluded.kind,
                weight = excluded.weight",
            params![
                cat.id,
                cat.name,
                cat.color,
                cat.kind.as_str(),
                cat.weight,
                if cat.is_system { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn delete_category(&self, id: &str) -> Result<(), DbError> {
        // Reassign existing sessions in deleted category back to neutral
        self.conn.execute(
            "UPDATE activity_sessions SET category_id = ?1 WHERE category_id = ?2",
            params![CATEGORY_NEUTRAL_ID, id],
        )?;
        self.conn.execute(
            "DELETE FROM categories WHERE id = ?1 AND is_system = 0",
            params![id],
        )?;
        Ok(())
    }

    pub fn list_rules(&self) -> Result<Vec<CategoryRule>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, match_type, pattern, category_id, priority, is_regex, tag FROM category_rules ORDER BY match_type DESC, priority DESC, pattern ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let mt: String = row.get(1)?;
            let is_rx: i64 = row.get(5).unwrap_or(0);
            Ok(CategoryRule {
                id: row.get(0)?,
                match_type: RuleMatchType::from_str(&mt),
                pattern: row.get(2)?,
                category_id: row.get(3)?,
                priority: row.get(4)?,
                is_regex: is_rx != 0,
                tag: row.get(6).unwrap_or(None),
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn save_rule(&self, rule: &CategoryRule) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT INTO category_rules (id, match_type, pattern, category_id, priority, is_regex, tag)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                match_type = excluded.match_type,
                pattern = excluded.pattern,
                category_id = excluded.category_id,
                priority = excluded.priority,
                is_regex = excluded.is_regex,
                tag = excluded.tag",
            params![
                rule.id,
                rule.match_type.as_str(),
                rule.pattern,
                rule.category_id,
                rule.priority,
                if rule.is_regex { 1 } else { 0 },
                rule.tag
            ],
        )?;
        Ok(())
    }

    pub fn delete_rule(&self, id: &str) -> Result<(), DbError> {
        self.conn.execute("DELETE FROM category_rules WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Re-apply all rules across stored sessions so dashboards reflect rule changes immediately.
    pub fn recategorize_all_sessions(&self) -> Result<usize, DbError> {
        let rules = self.list_rules()?;
        let mut stmt = self.conn.prepare(
            "SELECT id, app_name, process_name, window_title, category_id FROM activity_sessions WHERE is_manual = 0",
        )?;
        let updates: Vec<(String, String)> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let app: String = row.get(1)?;
                let proc_name: String = row.get(2)?;
                let title: String = row.get(3)?;
                let existing: String = row.get(4)?;
                Ok((id, app, proc_name, title, existing))
            })?
            .filter_map(Result::ok)
            .filter_map(|(id, app, proc_name, title, existing)| {
                let next = classify_activity(&app, &proc_name, &title, &rules);
                if next != existing {
                    Some((id, next))
                } else {
                    None
                }
            })
            .collect();

        let count = updates.len();
        if count > 0 {
            let tx = self.conn.unchecked_transaction()?;
            {
                let mut up = tx.prepare("UPDATE activity_sessions SET category_id = ?1 WHERE id = ?2")?;
                for (id, cat) in updates {
                    up.execute(params![cat, id])?;
                }
            }
            tx.commit()?;
        }
        Ok(count)
    }

    pub fn list_ignore_rules(&self) -> Result<Vec<IgnoreRule>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, match_type, pattern, is_regex FROM ignore_rules ORDER BY pattern ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let mt: String = row.get(1)?;
            let is_rx: i64 = row.get(3).unwrap_or(0);
            Ok(IgnoreRule {
                id: row.get(0)?,
                match_type: RuleMatchType::from_str(&mt),
                pattern: row.get(2)?,
                is_regex: is_rx != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn save_ignore_rule(&self, rule: &IgnoreRule) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT INTO ignore_rules (id, match_type, pattern, is_regex)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET match_type = excluded.match_type, pattern = excluded.pattern, is_regex = excluded.is_regex",
            params![rule.id, rule.match_type.as_str(), rule.pattern, if rule.is_regex { 1 } else { 0 }],
        )?;
        Ok(())
    }

    pub fn delete_ignore_rule(&self, id: &str) -> Result<(), DbError> {
        self.conn.execute("DELETE FROM ignore_rules WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_limits(&self) -> Result<Vec<DailyLimit>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, target_type, target_value, daily_limit_mins, enabled, notify_at_80 FROM daily_limits ORDER BY target_value ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let tt: String = row.get(1)?;
            let enabled: i64 = row.get(4)?;
            let notify80: i64 = row.get(5)?;
            Ok(DailyLimit {
                id: row.get(0)?,
                target_type: LimitTargetType::from_str(&tt),
                target_value: row.get(2)?,
                daily_limit_mins: row.get(3)?,
                enabled: enabled != 0,
                notify_at_80: notify80 != 0,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn save_limit(&self, limit: &DailyLimit) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT INTO daily_limits (id, target_type, target_value, daily_limit_mins, enabled, notify_at_80)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                target_type = excluded.target_type,
                target_value = excluded.target_value,
                daily_limit_mins = excluded.daily_limit_mins,
                enabled = excluded.enabled,
                notify_at_80 = excluded.notify_at_80",
            params![
                limit.id,
                limit.target_type.as_str(),
                limit.target_value,
                limit.daily_limit_mins,
                if limit.enabled { 1 } else { 0 },
                if limit.notify_at_80 { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn delete_limit(&self, id: &str) -> Result<(), DbError> {
        self.conn.execute("DELETE FROM daily_limits WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn save_focus_session(&self, rec: &FocusSessionRecord) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO focus_sessions (id, date, start_ts, end_ts, planned_secs, completed_secs, completed, distractions_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                rec.id,
                rec.date,
                rec.start_ts,
                rec.end_ts,
                rec.planned_secs,
                rec.completed_secs,
                if rec.completed { 1 } else { 0 },
                rec.distractions_count
            ],
        )?;
        Ok(())
    }

    pub fn list_focus_sessions(&self, start_date: &str, end_date: &str) -> Result<Vec<FocusSessionRecord>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, date, start_ts, end_ts, planned_secs, completed_secs, completed, distractions_count
             FROM focus_sessions
             WHERE date >= ?1 AND date <= ?2
             ORDER BY start_ts DESC",
        )?;
        let rows = stmt.query_map(params![start_date, end_date], |row| {
            let completed: i64 = row.get(6)?;
            Ok(FocusSessionRecord {
                id: row.get(0)?,
                date: row.get(1)?,
                start_ts: row.get(2)?,
                end_ts: row.get(3)?,
                planned_secs: row.get(4)?,
                completed_secs: row.get(5)?,
                completed: completed != 0,
                distractions_count: row.get(7)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn list_completed_focus_dates(&self) -> Result<Vec<String>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT date FROM focus_sessions WHERE completed = 1 ORDER BY date DESC",
        )?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn load_settings(&self) -> Result<AppSettings, DbError> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT value FROM settings WHERE key = 'app_settings'", [], |r| r.get(0))
            .optional()?;
        match raw {
            Some(json) => Ok(serde_json::from_str(&json)?),
            None => Ok(AppSettings::default()),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), DbError> {
        let json = serde_json::to_string(settings)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?1)",
            params![json],
        )?;
        Ok(())
    }

    pub fn load_focus_config(&self) -> Result<FocusConfig, DbError> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT value FROM settings WHERE key = 'focus_config'", [], |r| r.get(0))
            .optional()?;
        match raw {
            Some(json) => Ok(serde_json::from_str(&json)?),
            None => Ok(FocusConfig::default()),
        }
    }

    pub fn save_focus_config(&self, config: &FocusConfig) -> Result<(), DbError> {
        let json = serde_json::to_string(config)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('focus_config', ?1)",
            params![json],
        )?;
        Ok(())
    }

    pub fn save_icon(&self, icon_key: &str, data_url: &str, updated_at: i64) -> Result<(), DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO app_icons (icon_key, data_url, updated_at) VALUES (?1, ?2, ?3)",
            params![icon_key, data_url, updated_at],
        )?;
        Ok(())
    }

    pub fn load_all_icons(&self) -> Result<HashMap<String, String>, DbError> {
        let mut stmt = self.conn.prepare("SELECT icon_key, data_url FROM app_icons")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
        let mut map = HashMap::new();
        for r in rows {
            let (k, v) = r?;
            map.insert(k, v);
        }
        Ok(map)
    }

    /// Wipe stored activity logs and focus history (preserving rules/categories/settings).
    pub fn clear_all_activity_data(&self) -> Result<(), DbError> {
        self.conn.execute_batch(
            "
            DELETE FROM activity_sessions;
            DELETE FROM focus_sessions;
            VACUUM;
            ",
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seeds_defaults_and_upserts_checkpointed_session_without_duplication() {
        let db = Database::open_in_memory().unwrap();
        let cats = db.list_categories().unwrap();
        assert_eq!(cats.len(), 3);

        let mut sess = ActivitySession {
            id: "s-1".into(),
            date: "2026-11-26".into(),
            app_name: "VS Code".into(),
            process_name: "Code.exe".into(),
            window_title: "lib.rs".into(),
            domain_context: None,
            category_id: CATEGORY_PRODUCTIVE_ID.into(),
            start_ts: 1000,
            end_ts: 61_000,
            duration_secs: 60,
            icon_key: None,
            tags: vec!["coding".into()],
            is_manual: false,
        };
        db.upsert_sessions(&[sess.clone()]).unwrap();

        // Simulate final flush of same checkpointed session
        sess.end_ts = 121_000;
        sess.duration_secs = 120;
        db.upsert_sessions(&[sess]).unwrap();

        let rows = db.query_sessions("2026-11-26", "2026-11-26").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].duration_secs, 120);
        assert_eq!(rows[0].tags, vec!["coding".to_string()]);
    }
}
