use crate::db::DbState;
use crate::providers::AiProvider;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub ollama: bool,
    pub db: bool,
}

#[tauri::command]
pub async fn list_models(state: State<'_, DbState>) -> Result<Vec<String>, String> {
    let ollama_url = get_ollama_url(&state)?;
    let provider = crate::providers::ollama::OllamaProvider::new(ollama_url);
    provider.list_models().await
}

#[tauri::command]
pub async fn health_check(state: State<'_, DbState>) -> Result<HealthStatus, String> {
    // db check: try to query
    let db_ok = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row("SELECT 1", [], |_| Ok(1)).is_ok()
    };
    // ollama check via real provider
    let ollama_url = get_ollama_url(&state)?;
    let provider = crate::providers::ollama::OllamaProvider::new(ollama_url);
    let ollama_ok = provider.health().await;
    eprintln!("[health] db={}, ollama={}", db_ok, ollama_ok);
    Ok(HealthStatus {
        ollama: ollama_ok,
        db: db_ok,
    })
}

fn get_ollama_url(state: &State<'_, DbState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    Ok(conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'ollama_url'",
            [],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "http://localhost:11434".to_string()))
}

#[tauri::command]
pub fn get_settings(state: State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;

    let mut map = serde_json::Map::new();
    // defaults
    map.insert("ollama_url".to_string(), serde_json::Value::String("http://localhost:11434".to_string()));
    map.insert("theme".to_string(), serde_json::Value::String("dark".to_string()));

    for row in rows {
        let (k, v) = row.map_err(|e| e.to_string())?;
        map.insert(k, serde_json::Value::String(v));
    }

    Ok(serde_json::Value::Object(map))
}

#[tauri::command]
pub fn set_settings(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
