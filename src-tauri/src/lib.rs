pub mod commands;
pub mod db;
pub mod models;
pub mod providers;
pub mod services;

use commands::{chat_stream, chats, memory, settings, spaces};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db = db::init_db(app.handle()).map_err(|e| {
                eprintln!("[db] init failed: {}", e);
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e))
            })?;
            app.manage(db);
            app.manage(chat_stream::AbortRegistry::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // spaces
            spaces::list_spaces,
            spaces::create_space,
            spaces::update_space,
            spaces::delete_space,
            // chats
            chats::list_chats,
            chats::create_chat,
            chats::delete_chat,
            chats::rename_chat,
            chats::list_messages,
            chats::set_chat_title,
            chats::export_chat,
            // chat streaming
            chat_stream::send_message,
            chat_stream::abort_generation,
            // memory
            memory::list_memories,
            memory::add_memory,
            memory::update_memory,
            memory::delete_memory,
            // settings / system
            settings::list_models,
            settings::health_check,
            settings::get_settings,
            settings::set_settings,
            settings::check_ollama_status,
            settings::start_ollama,
            settings::install_model,
            settings::check_model_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
