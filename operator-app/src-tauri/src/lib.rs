use std::sync::Arc;

mod commands;
pub mod esptool;
mod gateway;
pub mod nvs;
mod pool;
mod state;

use commands::chirpstack::sync_chirpstack;
use commands::flash::{
    flash_firmware, flash_nvs, generate_nvs_bin, import_key_pool, key_pool_stats, list_ports,
    next_available_key, start_usb_watcher, verify_nvs,
};
use commands::gateway::{get_gateway_status, load_nvs_csv, start_gateway, stop_gateway};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            start_gateway,
            stop_gateway,
            get_gateway_status,
            load_nvs_csv,
            sync_chirpstack,
            list_ports,
            next_available_key,
            import_key_pool,
            key_pool_stats,
            generate_nvs_bin,
            flash_firmware,
            flash_nvs,
            verify_nvs,
        ])
        .setup(|app| {
            start_usb_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
