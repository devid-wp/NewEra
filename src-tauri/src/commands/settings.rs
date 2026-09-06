use crate::db::DbState;
use crate::providers::AiProvider;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::time::Duration;
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

#[tauri::command]
pub async fn check_ollama_status(state: State<'_, DbState>) -> Result<String, String> {
    let ollama_url = get_ollama_url(&state)?;
    eprintln!("[setup] check_ollama_status: url={}", ollama_url);
    let provider = crate::providers::ollama::OllamaProvider::new(ollama_url);
    let ollama_ok = provider.health().await;
    eprintln!("[setup] check_ollama_status: health={}", ollama_ok);
    if ollama_ok {
        Ok("ollama_running".to_string())
    } else {
        Ok("ollama_not_running".to_string())
    }
}

#[tauri::command]
pub async fn start_ollama(state: State<'_, DbState>) -> Result<String, String> {
    let ollama_url = get_ollama_url(&state)?;
    eprintln!("[setup] start_ollama: url={}", ollama_url);

    // Check if Ollama is already running
    let provider = crate::providers::ollama::OllamaProvider::new(ollama_url.clone());
    if provider.health().await {
        eprintln!("[setup] start_ollama: already running");
        return Ok("Ollama is already running".to_string());
    }

    // Try to start Ollama server
    // Use Stdio::null() to avoid pipe buffer deadlock (pipe fills up → process blocks)
    eprintln!("[setup] start_ollama: spawning ollama serve");
    let child = Command::new("ollama")
        .args(&["serve"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            let msg = format!("Failed to spawn `ollama serve`: {}. Is Ollama installed and in PATH?", e);
            eprintln!("[setup] start_ollama: {}", msg);
            msg
        })?;

    eprintln!("[setup] start_ollama: spawned pid={:?}", child.id());

    // Wait for Ollama to become available (poll health endpoint)
    for attempt in 1..=30 {
        std::thread::sleep(Duration::from_secs(1));
        let provider = crate::providers::ollama::OllamaProvider::new(ollama_url.clone());
        if provider.health().await {
            eprintln!("[setup] start_ollama: healthy after {}s", attempt);
            return Ok("Ollama started successfully".to_string());
        }
        if attempt % 5 == 0 {
            eprintln!("[setup] start_ollama: still waiting... ({}/30)", attempt);
        }
    }

    let msg = "Ollama failed to start within 30 seconds. Check if `ollama serve` works manually.";
    eprintln!("[setup] start_ollama: {}", msg);
    Err(msg.to_string())
}

#[tauri::command]
pub async fn install_model(state: State<'_, DbState>, model_name: String) -> Result<String, String> {
    let ollama_url = get_ollama_url(&state)?;
    eprintln!("[setup] install_model: model={}, url={}", model_name, ollama_url);

    // Check if model already exists
    let provider = crate::providers::ollama::OllamaProvider::new(ollama_url.clone());
    let models = provider.list_models().await?;
    eprintln!("[setup] install_model: existing models={:?}", models);
    if models.iter().any(|m| m.contains(&model_name) || model_name.contains(m)) {
        eprintln!("[setup] install_model: already installed");
        return Ok("Model already installed".to_string());
    }

    // Try to pull the model
    // Use Stdio::null() to avoid pipe buffer deadlock
    eprintln!("[setup] install_model: spawning ollama pull {}", model_name);
    let _child = Command::new("ollama")
        .args(&["pull", &model_name])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            let msg = format!("Failed to spawn `ollama pull {}`: {}. Is Ollama installed?", model_name, e);
            eprintln!("[setup] install_model: {}", msg);
            msg
        })?;

    // Wait for model to be available (check every 5s, timeout after 5min)
    for attempt in 1..=60 {
        std::thread::sleep(Duration::from_secs(5));
        match provider.list_models().await {
            Ok(models) => {
                if models.iter().any(|m| m.contains(&model_name) || model_name.contains(m)) {
                    eprintln!("[setup] install_model: model ready after {}s", attempt * 5);
                    return Ok("Model installed successfully".to_string());
                }
                if attempt % 6 == 0 {
                    eprintln!("[setup] install_model: still downloading... ({}/{}s)", attempt * 5, 300);
                }
            }
            Err(e) => {
                eprintln!("[setup] install_model: list_models error on attempt {}: {}", attempt, e);
            }
        }
    }

    let msg = format!("Model download timed out after 300 seconds. Check your network and try `ollama pull {}` manually.", model_name);
    eprintln!("[setup] install_model: {}", msg);
    Err(msg)
}

#[tauri::command]
pub async fn check_model_exists(state: State<'_, DbState>, model_name: String) -> Result<bool, String> {
    let ollama_url = get_ollama_url(&state)?;
    eprintln!("[setup] check_model_exists: model={}, url={}", model_name, ollama_url);
    let provider = crate::providers::ollama::OllamaProvider::new(ollama_url);
    let models = provider.list_models().await?;
    eprintln!("[setup] check_model_exists: models={:?}", models);
    let found = models.iter().any(|m| m.contains(&model_name) || model_name.contains(m));
    eprintln!("[setup] check_model_exists: found={}", found);
    Ok(found)
}