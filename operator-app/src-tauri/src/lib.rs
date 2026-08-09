use std::sync::Arc;

mod commands;
pub mod chirpstack_api;
pub mod device_log;
pub mod esptool;
mod gateway;
pub mod github;
pub mod nvs;
mod pool;
mod state;

use commands::chirpstack::{
    discover_chirpstack_ids, load_chirpstack_config, register_device_chirpstack,
    save_chirpstack_config, sync_chirpstack,
};
use commands::device_log::{export_devices_csv, list_devices, log_provisioning};
use commands::firmware::{check_firmware_update, download_firmware};
use commands::flash::{
    flash_firmware, flash_nvs, generate_nvs_bin, get_wifi_suggestions, import_key_pool,
    key_pool_stats, list_ports, next_available_key, start_usb_watcher, verify_nvs,
};
use commands::gateway::{get_gateway_status, load_nvs_csv, start_gateway, stop_gateway};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
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
            register_device_chirpstack,
            discover_chirpstack_ids,
            save_chirpstack_config,
            load_chirpstack_config,
            list_ports,
            next_available_key,
            import_key_pool,
            key_pool_stats,
            generate_nvs_bin,
            flash_firmware,
            flash_nvs,
            verify_nvs,
            log_provisioning,
            list_devices,
            export_devices_csv,
            check_firmware_update,
            download_firmware,
            get_wifi_suggestions,
        ])
        .setup(|app| {
            start_usb_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
