use crate::db::DbState;
use crate::models::Message;
use chrono::Utc;
use rusqlite::params;
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

#[tauri::command]
pub async fn send_message(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
    space_id: String,
    chat_id: String,
    content: String,
) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("Message cannot be empty".to_string());
    }

    // Verify chat belongs to space (optional but good)
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM chats WHERE id = ?1 AND space_id = ?2",
                params![chat_id, space_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if count == 0 {
            return Err("Chat not found in this space".to_string());
        }

        // Insert user message immediately
        let user_msg = Message {
            id: Uuid::new_v4().to_string(),
            chat_id: chat_id.clone(),
            role: "user".to_string(),
            content: content.trim().to_string(),
            created_at: Utc::now(),
        };
        conn.execute(
            "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?1,?2,?3,?4,?5)",
            params![
                user_msg.id,
                user_msg.chat_id,
                user_msg.role,
                user_msg.content,
                user_msg.created_at.to_rfc3339()
            ],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE chats SET updated_at = ?1 WHERE id = ?2",
            params![user_msg.created_at.to_rfc3339(), chat_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Mock streaming — Stage 3 will replace with real Ollama streaming
    // We also persist assistant message at the end
    let app_clone = app.clone();
    let space_id_clone = space_id.clone();
    let chat_id_clone = chat_id.clone();
    let user_content = content.trim().to_string();

    // Need to clone state for async move? We have to use inner conn via app state
    // Instead of using State, we will access via app.state<DbState>() inside spawn
    tokio::spawn(async move {
        let chunks = vec![
            format!("Stage 2 DB ✓ | Space {} | ", space_id_clone),
            format!("Ты написал: \"{}\" — ", user_content),
            "это мок стриминга, но сообщение уже в SQLite. Реальный Ollama — в Этапе 3 🔥".to_string(),
        ];

        let mut full = String::new();
        for chunk in chunks {
            full.push_str(&chunk);
            let _ = app_clone.emit(
                "chat:chunk",
                serde_json::json!({
                    "chatId": chat_id_clone,
                    "delta": chunk,
                    "done": false
                }),
            );
            tokio::time::sleep(std::time::Duration::from_millis(280)).await;
        }

        // Persist assistant message
        if let Some(db_state) = app_clone.try_state::<DbState>() {
            if let Ok(conn) = db_state.conn.lock() {
                let assistant_msg = Message {
                    id: Uuid::new_v4().to_string(),
                    chat_id: chat_id_clone.clone(),
                    role: "assistant".to_string(),
                    content: full,
                    created_at: Utc::now(),
                };
                let _ = conn.execute(
                    "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?1,?2,?3,?4,?5)",
                    params![
                        assistant_msg.id,
                        assistant_msg.chat_id,
                        assistant_msg.role,
                        assistant_msg.content,
                        assistant_msg.created_at.to_rfc3339()
                    ],
                );
                let _ = conn.execute(
                    "UPDATE chats SET updated_at = ?1 WHERE id = ?2",
                    params![assistant_msg.created_at.to_rfc3339(), chat_id_clone],
                );
            }
        }

        let _ = app_clone.emit(
            "chat:chunk",
            serde_json::json!({
                "chatId": chat_id_clone,
                "delta": "",
                "done": true
            }),
        );
    });

    Ok(())
}

#[tauri::command]
pub fn abort_generation(chat_id: String) -> Result<(), String> {
    println!("abort_generation: {}", chat_id);
    Ok(())
}
