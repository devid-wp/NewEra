use crate::db::{map_memory, DbState};
use crate::models::Memory;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn list_memories(state: State<DbState>, space_id: String) -> Result<Vec<Memory>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, space_id, content, category, created_at, updated_at FROM memories WHERE space_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![space_id], map_memory)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn add_memory(state: State<DbState>, space_id: String, content: String, category: Option<String>) -> Result<Memory, String> {
    if content.trim().is_empty() {
        return Err("Memory content cannot be empty".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    // verify space
    let exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM spaces WHERE id = ?1", params![space_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("Space not found".to_string());
    }

    let now = Utc::now();
    let mem = Memory {
        id: Uuid::new_v4().to_string(),
        space_id,
        content: content.trim().to_string(),
        category,
        created_at: now,
        updated_at: now,
    };

    conn.execute(
        "INSERT INTO memories (id, space_id, content, category, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            mem.id,
            mem.space_id,
            mem.content,
            mem.category,
            mem.created_at.to_rfc3339(),
            mem.updated_at.to_rfc3339()
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(mem)
}

#[tauri::command]
pub fn update_memory(state: State<DbState>, id: String, content: String) -> Result<Memory, String> {
    if content.trim().is_empty() {
        return Err("Content cannot be empty".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let affected = conn
        .execute(
            "UPDATE memories SET content = ?1, updated_at = ?2 WHERE id = ?3",
            params![content.trim(), now, id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Memory not found".to_string());
    }
    let mem = conn
        .query_row(
            "SELECT id, space_id, content, category, created_at, updated_at FROM memories WHERE id = ?1",
            params![id],
            map_memory,
        )
        .map_err(|e| e.to_string())?;
    Ok(mem)
}

#[tauri::command]
pub fn delete_memory(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM memories WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Memory not found".to_string());
    }
    Ok(())
}
