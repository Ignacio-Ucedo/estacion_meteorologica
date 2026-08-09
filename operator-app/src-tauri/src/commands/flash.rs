use serialport::{SerialPortType, available_ports};
use tauri::{AppHandle, Emitter, Manager};

use crate::nvs::{self, NvsParams};

use crate::pool::{self, KeyEntry, PoolStats};

/// VID/PID de chips USB-serial comunes en módulos ESP32.
const KNOWN_CHIPS: &[(u16, &str)] = &[
    (0x10C4, "CP210x"), // Silicon Labs CP2102/CP2104
    (0x1A86, "CH340"),  // WCH CH340/CH341
    (0x0403, "FTDI"),   // FTDI FT232
    (0x303A, "ESP32-S3 Native"), // Espressif nativo (USB-OTG)
];

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct PortInfo {
    pub name: String,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub manufacturer: Option<String>,
    pub chip: String,
}

fn chip_name(vid: u16) -> &'static str {
    KNOWN_CHIPS
        .iter()
        .find(|(v, _)| *v == vid)
        .map(|(_, name)| *name)
        .unwrap_or("Unknown")
}

fn is_esp32_port(vid: u16) -> bool {
    KNOWN_CHIPS.iter().any(|(v, _)| *v == vid)
}

fn enumerate_esp32_ports() -> Vec<PortInfo> {
    available_ports()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|p| {
            if let SerialPortType::UsbPort(info) = p.port_type {
                if is_esp32_port(info.vid) {
                    return Some(PortInfo {
                        name: p.port_name,
                        vid: Some(info.vid),
                        pid: Some(info.pid),
                        manufacturer: info.manufacturer,
                        chip: chip_name(info.vid).to_string(),
                    });
                }
            }
            None
        })
        .collect()
}

/// Retorna la lista de puertos serie que corresponden a chips ESP32 conocidos.
#[tauri::command]
pub fn list_ports() -> Vec<PortInfo> {
    enumerate_esp32_ports()
}

/// Inicia un poller de 500ms que emite eventos `port-connected` / `port-disconnected`
/// cuando cambia el conjunto de puertos USB-ESP32 detectados.
///
/// Debe llamarse una sola vez desde el startup de la app. Si ya hay una tarea
/// corriendo, simplemente retorna sin iniciar otra.
pub fn start_usb_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut prev: Vec<PortInfo> = enumerate_esp32_ports();

        // Emitir estado inicial para que el frontend no quede vacío.
        let _ = app.emit("ports-updated", prev.clone());

        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            let current = enumerate_esp32_ports();

            if current != prev {
                // Puertos nuevos (conectados).
                for port in current.iter().filter(|p| !prev.contains(p)) {
                    let _ = app.emit("port-connected", port.clone());
                }
                // Puertos que desaparecieron (desconectados).
                for port in prev.iter().filter(|p| !current.contains(p)) {
                    let _ = app.emit("port-disconnected", port.clone());
                }
                let _ = app.emit("ports-updated", current.clone());
                prev = current;
            }
        }
    });
}

// ── Pool de OTAA keys ─────────────────────────────────────────────────────────

fn pool_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("key_pool.db"))
        .map_err(|e| format!("No se pudo obtener directorio de datos: {e}"))
}

/// Retorna el próximo par DevEUI+AppKey libre del pool y lo marca como asignado.
#[tauri::command]
pub fn next_available_key(app: AppHandle) -> Result<KeyEntry, String> {
    let path = pool_db_path(&app)?;
    pool::next_available(&path)
}

/// Importa un CSV con columnas dev_eui,app_key al pool local. Retorna el número
/// de nuevos pares insertados (duplicados son ignorados).
#[tauri::command]
pub fn import_key_pool(app: AppHandle, csv_content: String) -> Result<u32, String> {
    let path = pool_db_path(&app)?;
    pool::import_from_csv(&path, &csv_content)
}

/// Estadísticas del pool: total de pares, disponibles y asignados.
#[tauri::command]
pub fn key_pool_stats(app: AppHandle) -> Result<PoolStats, String> {
    let path = pool_db_path(&app)?;
    pool::stats(&path)
}

// ── Generación de partición NVS ───────────────────────────────────────────────

/// Genera el binario de partición NVS para un nodo sensor.
/// Retorna los bytes codificados en base64 para transferir al frontend.
/// El binario puede flashearse directamente en la dirección 0x9000 con esptool.
#[tauri::command]
pub fn generate_nvs_bin(params: NvsParams) -> Result<String, String> {
    let bytes = nvs::generate(&params)?;
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes))
}
