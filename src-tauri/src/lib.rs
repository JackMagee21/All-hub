mod commands;
mod types;

use commands::chat::chat;
use commands::files::{read_file, write_file};
use commands::keys::{delete_key, get_key, save_key};
use commands::models::fetch_models;


//#[cfg_attr(mobile, tauri::mobile_entry_point)] // Required for IOS and Android
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            chat,
            fetch_models,
            save_key,
            get_key,
            delete_key,
            write_file,
            read_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}