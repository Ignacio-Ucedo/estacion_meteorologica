use tauri::{AppHandle, Manager};

use crate::device_log::{self, DeviceEntry};

fn log_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("device_log.db"))
        .map_err(|e| format!("No se pudo obtener directorio de datos: {e}"))
}

// 10.2: Guarda una entrada de aprovisionamiento (exitoso o parcial).
#[tauri::command]
pub fn log_provisioning(
    app: AppHandle,
    dev_eui: String,
    port: String,
    wifi_ssid: String,
    chirpstack_host: String,
    status: String,
    firmware_file: String,
    params_json: String,
) -> Result<i64, String> {
    let path = log_db_path(&app)?;
    let entry = DeviceEntry {
        id: 0,
        dev_eui,
        port,
        wifi_ssid,
        chirpstack_host,
        status,
        firmware_file,
        params_json,
        provisioned_at: device_log::unix_now(),
    };
    device_log::log_entry(&path, &entry)
}

// 10.3: Lista todos los dispositivos provisionados.
#[tauri::command]
pub fn list_devices(app: AppHandle) -> Result<Vec<DeviceEntry>, String> {
    let path = log_db_path(&app)?;
    device_log::list_entries(&path)
}

// 10.4: Exporta el historial completo como CSV.
#[tauri::command]
pub fn export_devices_csv(app: AppHandle) -> Result<String, String> {
    let path = log_db_path(&app)?;
    let entries = device_log::list_entries(&path)?;
    Ok(device_log::to_csv(&entries))
}
