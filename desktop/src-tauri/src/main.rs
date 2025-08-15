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
    // Initialize logger with RUST_LOG env var (e.g., RUST_LOG=debug)
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("Starting Swarm application");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(generate_handler![
            cmds::repo_open,
            cmds::repo_recent,
            cmds::repo_list_files,
            cmds::repo_read_file,
            cmds::repo_read_files_bulk,
            cmds::repo_count_tokens,
            cmds::chat_stream_start,
            cmds::chat_stream_cancel,
            cmds::save_selected_files,
            cmds::load_selected_files,
            cmds::save_selected_folders,
            cmds::load_selected_folders,
            cmds::set_openai_api_key,
            cmds::get_openai_api_key,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Swarm")?;

            // Devtools disabled
            // #[cfg(debug_assertions)]
            // {
            //     window.open_devtools();
            // }

            Ok(())
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
