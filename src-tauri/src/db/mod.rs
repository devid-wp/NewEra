use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir error: {}", e))?;
    // Ensure identifier com.newera.app resolves to .../newera or com.newera.app
    // Tauri already handles it, we just append newera.db
    Ok(base.join("newera.db"))
}

pub fn init_db(app: &AppHandle) -> Result<DbState, String> {
    let path = db_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create dir failed: {}", e))?;
    }

    let conn = Connection::open(&path).map_err(|e| format!("open db failed: {}", e))?;

    // Enable WAL + foreign keys
    conn.execute_batch(
        "
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        ",
    )
    .map_err(|e| e.to_string())?;

    run_migrations(&conn)?;
    seed_if_empty(&conn)?;
    // User requested: keep only Default — clean up legacy seeded spaces
    cleanup_legacy_spaces(&conn)?;

    // Ensure workspace folders exist for all spaces
    ensure_workspace_folders(app, &conn)?;

    println!("[db] initialized at {}", path.display());
    Ok(DbState::new(conn))
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS spaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            icon TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'qwen2.5:3b',
            temperature REAL NOT NULL DEFAULT 0.7,
            provider TEXT NOT NULL DEFAULT 'ollama',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chats_space ON chats(space_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            category TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_memories_space ON memories(space_id);

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn seed_if_empty(conn: &Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM spaces", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let model = read_selected_model();

    if count > 0 {
        // Update existing Default space's model if .model file has a different one
        let _ = conn.execute(
            "UPDATE spaces SET model = ?1 WHERE name = 'Default' AND model != ?1",
            params![model],
        );
        return Ok(());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO spaces (id, name, icon, system_prompt, model, temperature, provider, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            id,
            "Default",
            "🧠",
            "You are a helpful assistant.",
            model,
            0.7,
            "ollama",
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
        params!["ollama_url", "http://localhost:11434"],
    )
    .map_err(|e| e.to_string())?;

    println!("[db] seeded Default space with model: {}", model);
    Ok(())
}

fn read_selected_model() -> String {
    // 1. Check .model file in project root (set by start.sh)
    if let Ok(model) = std::fs::read_to_string(".model") {
        let model = model.trim().to_string();
        if !model.is_empty() {
            return model;
        }
    }
    // 2. Check environment variable
    if let Ok(model) = std::env::var("NEWERA_MODEL") {
        let model = model.trim().to_string();
        if !model.is_empty() {
            return model;
        }
    }
    // 3. Default
    "qwen2.5:3b".to_string()
}

fn cleanup_legacy_spaces(conn: &Connection) -> Result<(), String> {
    // Keep only "Default" — remove legacy Programming/English/Linux if they exist
    let legacy = vec!["Programming", "English", "Linux"];
    for name in legacy {
        conn.execute("DELETE FROM spaces WHERE name = ?1", params![name])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn ensure_workspace_folders(app: &AppHandle, conn: &Connection) -> Result<(), String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT name FROM spaces")
        .map_err(|e| e.to_string())?;
    let names: Vec<String> = stmt
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for name in names {
        let memory_dir = base.join("workspaces").join(&name).join("memory");
        if !memory_dir.exists() {
            let _ = std::fs::create_dir_all(&memory_dir);
            eprintln!("[db] created workspace folder: {}", memory_dir.display());
        }
    }
    Ok(())
}

// helpers for row mapping
pub fn map_space(row: &rusqlite::Row) -> rusqlite::Result<crate::models::Space> {
    Ok(crate::models::Space {
        id: row.get(0)?,
        name: row.get(1)?,
        icon: row.get(2)?,
        system_prompt: row.get(3)?,
        model: row.get(4)?,
        temperature: row.get(5)?,
        provider: row.get(6)?,
        created_at: parse_dt(row.get::<_, String>(7)?),
        updated_at: parse_dt(row.get::<_, String>(8)?),
    })
}

pub fn map_chat(row: &rusqlite::Row) -> rusqlite::Result<crate::models::Chat> {
    Ok(crate::models::Chat {
        id: row.get(0)?,
        space_id: row.get(1)?,
        title: row.get(2)?,
        created_at: parse_dt(row.get::<_, String>(3)?),
        updated_at: parse_dt(row.get::<_, String>(4)?),
    })
}

pub fn map_message(row: &rusqlite::Row) -> rusqlite::Result<crate::models::Message> {
    Ok(crate::models::Message {
        id: row.get(0)?,
        chat_id: row.get(1)?,
        role: row.get(2)?,
        content: row.get(3)?,
        created_at: parse_dt(row.get::<_, String>(4)?),
    })
}

pub fn map_memory(row: &rusqlite::Row) -> rusqlite::Result<crate::models::Memory> {
    Ok(crate::models::Memory {
        id: row.get(0)?,
        space_id: row.get(1)?,
        content: row.get(2)?,
        category: row.get(3)?,
        created_at: parse_dt(row.get::<_, String>(4)?),
        updated_at: parse_dt(row.get::<_, String>(5)?),
    })
}

fn parse_dt(s: String) -> chrono::DateTime<chrono::Utc> {
    s.parse::<chrono::DateTime<chrono::Utc>>()
        .unwrap_or_else(|_| chrono::Utc::now())
}
