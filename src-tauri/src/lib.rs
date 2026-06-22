mod commands;
mod types;

use commands::chat::chat;
use commands::keys::{delete_key, get_key, save_key};
use commands::models::fetch_models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            chat,
            fetch_models,
            save_key,
            get_key,
            delete_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}