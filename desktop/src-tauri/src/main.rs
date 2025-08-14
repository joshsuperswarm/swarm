#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{generate_context, generate_handler, Manager};

mod cmds;
mod config;
mod repo;
mod tokens;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(generate_handler![
            cmds::repo_open,
            cmds::repo_recent,
            cmds::repo_list_files,
            cmds::repo_read_file,
            cmds::repo_count_tokens,
            cmds::chat_stream_start,
            cmds::chat_stream_cancel,
            cmds::save_selected_files,
            cmds::load_selected_files,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("RepoChat")?;
            Ok(())
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}