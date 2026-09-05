use crate::db::{map_chat, map_message, DbState};
use crate::models::{Chat, Message};
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn list_chats(state: State<DbState>, space_id: String) -> Result<Vec<Chat>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, space_id, title, created_at, updated_at FROM chats WHERE space_id = ?1 ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![space_id], map_chat)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_chat(state: State<DbState>, space_id: String, title: Option<String>) -> Result<Chat, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // verify space exists
    let exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM spaces WHERE id = ?1", params![space_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("Space not found".to_string());
    }

    let now = Utc::now();
    let chat = Chat {
        id: Uuid::new_v4().to_string(),
        space_id,
        title: title.unwrap_or_else(|| "New chat".to_string()),
        created_at: now,
        updated_at: now,
    };

    conn.execute(
        "INSERT INTO chats (id, space_id, title, created_at, updated_at) VALUES (?1,?2,?3,?4,?5)",
        params![
            chat.id,
            chat.space_id,
            chat.title,
            chat.created_at.to_rfc3339(),
            chat.updated_at.to_rfc3339()
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(chat)
}

#[tauri::command]
pub fn delete_chat(state: State<DbState>, chat_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM chats WHERE id = ?1", params![chat_id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Chat not found".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn rename_chat(state: State<DbState>, chat_id: String, title: String) -> Result<Chat, String> {
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let affected = conn
        .execute(
            "UPDATE chats SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title.trim(), now, chat_id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Chat not found".to_string());
    }

    let chat = conn
        .query_row(
            "SELECT id, space_id, title, created_at, updated_at FROM chats WHERE id = ?1",
            params![chat_id],
            map_chat,
        )
        .map_err(|e| e.to_string())?;
    Ok(chat)
}

#[tauri::command]
pub fn list_messages(state: State<DbState>, chat_id: String) -> Result<Vec<Message>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id = ?1 ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![chat_id], map_message)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

// internal helper used by chat_stream to insert messages
pub fn insert_message(conn: &rusqlite::Connection, msg: &Message) -> Result<(), String> {
    conn.execute(
        "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?1,?2,?3,?4,?5)",
        params![msg.id, msg.chat_id, msg.role, msg.content, msg.created_at.to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;
    // bump chat updated_at
    conn.execute(
        "UPDATE chats SET updated_at = ?1 WHERE id = ?2",
        params![msg.created_at.to_rfc3339(), msg.chat_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_chat_title(state: State<'_, DbState>, chat_id: String, title: String) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE chats SET title = ?1 WHERE id = ?2",
            params![title.trim(), chat_id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Chat not found".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn export_chat(state: State<'_, DbState>, chat_id: String) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let chat = conn
        .query_row(
            "SELECT id, space_id, title, created_at, updated_at FROM chats WHERE id = ?1",
            params![chat_id],
            map_chat,
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT role, content FROM messages WHERE chat_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![chat_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let messages: Vec<(String, String)> = rows
        .collect::<Result<Vec<(String, String)>, _>>()
        .map_err(|e| e.to_string())?;

    let title = if chat.title.trim().is_empty() { "Chat" } else { &chat.title };
    let mut md = format!("# {}\n\n", title);
    for (role, content) in &messages {
        let role_emoji = if role == "user" { "👤" } else { "🤖" };
        md.push_str(&format!("**{}:** {}\n\n", role_emoji, content));
    }
    Ok(md)
}
