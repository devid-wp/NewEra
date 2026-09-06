use crate::db::{map_space, DbState};
use crate::models::{CreateSpacePayload, Space, UpdateSpacePayload};
use chrono::Utc;
use rusqlite::params;
use tauri::{Manager, State};
use uuid::Uuid;

#[tauri::command]
pub fn list_spaces(state: State<DbState>) -> Result<Vec<Space>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, icon, system_prompt, model, temperature, provider, created_at, updated_at FROM spaces ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_space)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_space(
    app: tauri::AppHandle,
    state: State<DbState>,
    payload: CreateSpacePayload,
) -> Result<Space, String> {
    if payload.name.trim().is_empty() {
        return Err("Space name cannot be empty".to_string());
    }
    let now = Utc::now();
    let space = Space {
        id: Uuid::new_v4().to_string(),
        name: payload.name.trim().to_string(),
        icon: payload.icon.unwrap_or_else(|| "🧠".to_string()),
        system_prompt: payload
            .system_prompt
            .unwrap_or_else(|| "You are a helpful assistant.".to_string()),
        model: payload.model.unwrap_or_else(|| "qwen2.5:3b".to_string()),
        temperature: payload.temperature.unwrap_or(0.7),
        provider: "ollama".to_string(),
        created_at: now,
        updated_at: now,
    };

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO spaces (id, name, icon, system_prompt, model, temperature, provider, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            space.id,
            space.name,
            space.icon,
            space.system_prompt,
            space.model,
            space.temperature,
            space.provider,
            space.created_at.to_rfc3339(),
            space.updated_at.to_rfc3339()
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Space with this name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    // Create workspace folder: app_data_dir/workspaces/<name>/memory/
    if let Ok(base) = app.path().app_data_dir() {
        let workspace_dir = base.join("workspaces").join(&space.name);
        let memory_dir = workspace_dir.join("memory");
        let _ = std::fs::create_dir_all(&memory_dir);
        eprintln!("[spaces] created workspace folder: {}", memory_dir.display());
    }

    Ok(space)
}

#[tauri::command]
pub fn update_space(state: State<DbState>, id: String, payload: UpdateSpacePayload) -> Result<Space, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // fetch existing
    let mut existing: Space = conn
        .query_row(
            "SELECT id, name, icon, system_prompt, model, temperature, provider, created_at, updated_at FROM spaces WHERE id = ?1",
            params![id],
            map_space,
        )
        .map_err(|_| "Space not found".to_string())?;

    if let Some(name) = payload.name {
        if !name.trim().is_empty() {
            existing.name = name.trim().to_string();
        }
    }
    if let Some(icon) = payload.icon {
        existing.icon = icon;
    }
    if let Some(prompt) = payload.system_prompt {
        existing.system_prompt = prompt;
    }
    if let Some(model) = payload.model {
        existing.model = model;
    }
    if let Some(temp) = payload.temperature {
        existing.temperature = temp;
    }
    existing.updated_at = Utc::now();

    conn.execute(
        "UPDATE spaces SET name=?1, icon=?2, system_prompt=?3, model=?4, temperature=?5, updated_at=?6 WHERE id=?7",
        params![
            existing.name,
            existing.icon,
            existing.system_prompt,
            existing.model,
            existing.temperature,
            existing.updated_at.to_rfc3339(),
            existing.id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(existing)
}

#[tauri::command]
pub fn delete_space(app: tauri::AppHandle, state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Get space name before deleting (for folder cleanup)
    let space_name: String = conn
        .query_row(
            "SELECT name FROM spaces WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| "Space not found".to_string())?;

    let affected = conn
        .execute("DELETE FROM spaces WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Space not found".to_string());
    }

    // Remove workspace folder
    if let Ok(base) = app.path().app_data_dir() {
        let workspace_dir = base.join("workspaces").join(&space_name);
        if workspace_dir.exists() {
            let _ = std::fs::remove_dir_all(&workspace_dir);
            eprintln!("[spaces] removed workspace folder: {}", workspace_dir.display());
        }
    }

    Ok(())
}
