use crate::db::DbState;
use crate::models::Message;
use crate::providers::{AiProvider, ChatOptions, ollama::OllamaProvider};
use crate::services;
use chrono::Utc;
use rusqlite::params;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

#[derive(Default)]
pub struct AbortRegistry {
    map: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AbortRegistry {
    pub fn register(&self, chat_id: &str, flag: Arc<AtomicBool>) {
        self.map
            .lock()
            .unwrap()
            .insert(chat_id.to_string(), flag);
    }

    pub fn abort(&self, chat_id: &str) {
        if let Some(flag) = self.map.lock().unwrap().get(chat_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }

    pub fn take(&self, chat_id: &str) -> Option<Arc<AtomicBool>> {
        self.map.lock().unwrap().remove(chat_id)
    }
}

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

    // Read everything we need from DB up-front (before spawning), so we don't
    // hold the SQLite mutex across the whole streaming duration.
    let (space, memories, history, ollama_url): (
        crate::models::Space,
        Vec<crate::models::Memory>,
        Vec<Message>,
        String,
    ) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;

        // Verify chat belongs to space
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

        let space = conn
            .query_row(
                "SELECT id, name, icon, system_prompt, model, temperature, provider, created_at, updated_at FROM spaces WHERE id = ?1",
                params![space_id],
                crate::db::map_space,
            )
            .map_err(|e| e.to_string())?;

        let memories = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, space_id, content, category, created_at, updated_at FROM memories WHERE space_id = ?1 ORDER BY updated_at DESC LIMIT 10",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![space_id], crate::db::map_memory)
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        };

        let history = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id = ?1 ORDER BY created_at DESC LIMIT 20",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![chat_id], crate::db::map_message)
                .map_err(|e| e.to_string())?;
            let mut hist = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
            hist.reverse(); // oldest first
            hist
        };

        let ollama_url = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'ollama_url'",
                [],
                |r| r.get::<_, String>(0),
            )
            .unwrap_or_else(|_| "http://localhost:11434".to_string());

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

        (space, memories, history, ollama_url)
    };

    let questions = services::prompt::build_prompt(&space, &memories, &history, content.trim());

    let provider = OllamaProvider::new(ollama_url);
    let model = space.model.clone();
    let options = ChatOptions {
        temperature: Some(space.temperature),
        num_ctx: Some(4096),
    };

    let abort_flag = Arc::new(AtomicBool::new(false));
    app.state::<AbortRegistry>().register(&chat_id, abort_flag.clone());

    let app_chunk = app.clone();
    let app_clone = app.clone();
    let chat_id_chunk = chat_id.clone();

    tokio::spawn(async move {
        let full = Arc::new(Mutex::new(String::new()));
        let full_for_chunk = full.clone();
        let on_chunk = move |delta: String| {
            if let Ok(mut guard) = full_for_chunk.lock() {
                guard.push_str(&delta);
            }
            let _ = app_chunk.emit(
                "chat:chunk",
                serde_json::json!({
                    "chatId": chat_id_chunk,
                    "delta": delta,
                    "done": false
                }),
            );
        };

        let result = provider.chat_stream(&model, questions, options, Box::new(on_chunk)).await;
        let full_text = full.lock().map(|g| g.clone()).unwrap_or_default();
        app.state::<AbortRegistry>().take(&chat_id);

        match result {
            Ok(_) => {
                if let Some(db_state) = app_clone.try_state::<DbState>() {
                    if let Ok(conn) = db_state.conn.lock() {
                        let assistant_msg = Message {
                            id: Uuid::new_v4().to_string(),
                            chat_id: chat_id.clone(),
                            role: "assistant".to_string(),
                            content: full_text.clone(),
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
                            params![assistant_msg.created_at.to_rfc3339(), chat_id],
                        );
                    }
                }
                let _ = app_clone.emit(
                    "chat:chunk",
                    serde_json::json!({ "chatId": chat_id, "delta": "", "done": true }),
                );
            }
            Err(e) => {
                let _ = app_clone.emit(
                    "chat:error",
                    serde_json::json!({ "chatId": chat_id, "error": e }),
                );
                let _ = app_clone.emit(
                    "chat:chunk",
                    serde_json::json!({ "chatId": chat_id, "delta": "", "done": true }),
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn abort_generation(state: State<'_, AbortRegistry>, chat_id: String) -> Result<(), String> {
    state.abort(&chat_id);
    println!("abort_generation: {}", chat_id);
    Ok(())
}
