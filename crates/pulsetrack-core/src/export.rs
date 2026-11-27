use std::collections::HashMap;

use serde::Serialize;

use crate::models::{ActivitySession, Category, DashboardSummary};

/// Build a spreadsheet-compatible UTF-8 CSV (with BOM for Excel) of filtered activity sessions.
pub fn export_sessions_csv(sessions: &[ActivitySession], categories: &[Category]) -> String {
    let cat_map: HashMap<&str, &str> = categories
        .iter()
        .map(|c| (c.id.as_str(), c.name.as_str()))
        .collect();

    let mut out = String::from("\u{FEFF}Date,StartTimestampMs,EndTimestampMs,DurationSecs,AppName,ProcessName,Context,Category,WindowTitle\n");
    for s in sessions {
        let cat_name = cat_map.get(s.category_id.as_str()).copied().unwrap_or("Neutral");
        let ctx = s.domain_context.as_deref().unwrap_or("");
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{},{}\n",
            csv_escape(&s.date),
            s.start_ts,
            s.end_ts,
            s.duration_secs,
            csv_escape(&s.app_name),
            csv_escape(&s.process_name),
            csv_escape(ctx),
            csv_escape(cat_name),
            csv_escape(&s.window_title),
        ));
    }
    out
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPayload<'a> {
    exported_at: String,
    summary: &'a DashboardSummary,
    sessions: &'a [ActivitySession],
}

/// Build a structured JSON export containing both range summary metrics and raw sessions.
pub fn export_structured_json(
    summary: &DashboardSummary,
    sessions: &[ActivitySession],
) -> Result<String, serde_json::Error> {
    let payload = ExportPayload {
        exported_at: chrono::Utc::now().to_rfc3339(),
        summary,
        sessions,
    };
    serde_json::to_string_pretty(&payload)
}

fn csv_escape(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') || field.contains('\r') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}
