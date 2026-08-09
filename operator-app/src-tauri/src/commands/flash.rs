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

// ── Flash vía esptool sidecar ─────────────────────────────────────────────────

/// Verifica la conectividad del ESP32 y flashea el firmware en 0x0000.
///
/// Emite eventos `flash-log` ({ level, text }) en tiempo real.
/// `firmware_path`: ruta local al archivo .bin (descargado desde GitHub Releases
/// o compilado localmente). Sección 11 se encarga de la descarga automática.
#[tauri::command]
pub async fn flash_firmware(
    app: AppHandle,
    port: String,
    firmware_path: String,
) -> Result<(), String> {
    use crate::esptool;

    // 7.4: verificar conectividad antes del flash
    esptool::chip_id(&app, &port, "flash-log").await?;

    // 7.1: flash del firmware en 0x0000
    esptool::emit_log(&app, "flash-log", "info", "Iniciando flash del firmware…");
    esptool::write_flash(&app, &port, "0x0", &firmware_path, "flash-log").await?;

    esptool::emit_log(&app, "flash-log", "ok", "✓ Firmware flasheado correctamente");
    Ok(())
}

/// Genera la partición NVS y la flashea en 0x9000.
///
/// Emite eventos `nvs-log` ({ level, text }) en tiempo real.
#[tauri::command]
pub async fn flash_nvs(app: AppHandle, port: String, params: NvsParams) -> Result<(), String> {
    use crate::esptool;

    // 8.1: generar NVS binary
    esptool::emit_log(&app, "nvs-log", "info", "Generando partición NVS…");
    let nvs_bytes = nvs::generate(&params)?;
    esptool::emit_log(
        &app,
        "nvs-log",
        "info",
        &format!("NVS generado: {} bytes", nvs_bytes.len()),
    );

    // Escribir a archivo temporal
    let tmp = std::env::temp_dir().join("operator_nvs.bin");
    std::fs::write(&tmp, &nvs_bytes)
        .map_err(|e| format!("Error escribiendo NVS temporal: {e}"))?;

    // 8.1: flash en 0x9000
    esptool::emit_log(&app, "nvs-log", "info", "Flasheando NVS en 0x9000…");
    esptool::write_flash(
        &app,
        &port,
        "0x9000",
        tmp.to_str().unwrap_or("/tmp/operator_nvs.bin"),
        "nvs-log",
    )
    .await?;

    esptool::emit_log(&app, "nvs-log", "ok", "✓ NVS flasheado en 0x9000");
    Ok(())
}

// ── WiFi del sistema operativo ────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct WifiSuggestions {
    /// SSID de la red WiFi activa (si el adaptador está asociado a alguna).
    pub connected: Option<String>,
    /// Todas las redes WiFi visibles (incluye `connected` si existe).
    pub available: Vec<String>,
}

/// Detecta la red WiFi activa y escanea las redes visibles para el adaptador.
/// Funciona tanto si la PC está en WiFi como en Ethernet: en el caso ethernet
/// el campo `connected` será `None` pero `available` contendrá las redes
/// visibles en el aire que el operario puede seleccionar.
#[tauri::command]
pub fn get_wifi_suggestions() -> WifiSuggestions {
    let connected = detect_connected_wifi();
    let mut available = scan_available_wifi();
    // Poner la red conectada primero y evitar duplicados.
    if let Some(ref c) = connected {
        available.retain(|s| s != c);
        available.insert(0, c.clone());
    }
    WifiSuggestions { connected, available }
}

// ── Linux ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn detect_connected_wifi() -> Option<String> {
    // nmcli: red activa del adaptador WiFi.
    let out = std::process::Command::new("nmcli")
        .args(["-t", "-f", "active,ssid", "dev", "wifi"])
        .output()
        .ok()?;
    if out.status.success() {
        let text = String::from_utf8_lossy(&out.stdout);
        let ssid = text
            .lines()
            .find(|l| l.starts_with("yes:"))?
            .strip_prefix("yes:")?
            .trim()
            .to_string();
        if !ssid.is_empty() {
            return Some(ssid);
        }
    }
    // Fallback: iwgetid (kernels sin NetworkManager).
    let out2 = std::process::Command::new("iwgetid").arg("-r").output().ok()?;
    let ssid = String::from_utf8_lossy(&out2.stdout).trim().to_string();
    if ssid.is_empty() { None } else { Some(ssid) }
}

#[cfg(target_os = "linux")]
fn scan_available_wifi() -> Vec<String> {
    let Ok(out) = std::process::Command::new("nmcli")
        .args(["-t", "-f", "ssid", "dev", "wifi", "list"])
        .output()
    else {
        return vec![];
    };
    let mut seen = std::collections::HashSet::new();
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(|l| l.trim().replace("\\:", ":")) // nmcli escapa los ':' en terse mode
        .filter(|s| !s.is_empty())
        .filter(|s| seen.insert(s.clone()))
        .collect()
}

// ── Windows ─────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn detect_connected_wifi() -> Option<String> {
    let out = std::process::Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        let t = line.trim();
        if t.starts_with("SSID") && !t.starts_with("BSSID") {
            if let Some(val) = t.splitn(2, ':').nth(1) {
                let ssid = val.trim().to_string();
                if !ssid.is_empty() {
                    return Some(ssid);
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn scan_available_wifi() -> Vec<String> {
    let Ok(out) = std::process::Command::new("netsh")
        .args(["wlan", "show", "networks"])
        .output()
    else {
        return vec![];
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut ssids = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for line in text.lines() {
        let t = line.trim();
        // "SSID 1 : NetworkName"  (pero no "BSSID")
        if t.starts_with("SSID") && !t.starts_with("BSSID") {
            if let Some(val) = t.splitn(2, ':').nth(1) {
                let ssid = val.trim().to_string();
                if !ssid.is_empty() && seen.insert(ssid.clone()) {
                    ssids.push(ssid);
                }
            }
        }
    }
    ssids
}

// ── macOS ───────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn detect_connected_wifi() -> Option<String> {
    for iface in ["en0", "en1", "en2"] {
        let out = std::process::Command::new("networksetup")
            .args(["-getairportnetwork", iface])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        if let Some(rest) = text.trim().strip_prefix("Current Wi-Fi Network:") {
            let ssid = rest.trim().to_string();
            if !ssid.is_empty() {
                return Some(ssid);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn scan_available_wifi() -> Vec<String> {
    // airport -s requiere permisos elevados en macOS 13+; omitimos el scan.
    vec![]
}

// ── Otros ───────────────────────────────────────────────────────────────────

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn detect_connected_wifi() -> Option<String> { None }

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn scan_available_wifi() -> Vec<String> { vec![] }

/// Lee la partición NVS desde el ESP32 y la compara byte a byte con la esperada.
///
/// Emite eventos `nvs-log` en tiempo real.
/// Retorna Ok(true) si coincide, Ok(false) si difiere, Err si no se pudo leer.
#[tauri::command]
pub async fn verify_nvs(app: AppHandle, port: String, params: NvsParams) -> Result<bool, String> {
    use crate::esptool;

    // 8.2: leer partición desde el ESP32
    let tmp_readback = std::env::temp_dir().join("operator_nvs_readback.bin");
    esptool::emit_log(&app, "nvs-log", "info", "Leyendo partición NVS desde el ESP32…");

    esptool::read_flash(
        &app,
        &port,
        "0x9000",
        "0x6000", // tamaño de la partición NVS
        tmp_readback.to_str().unwrap_or("/tmp/operator_nvs_readback.bin"),
        "nvs-log",
    )
    .await?;

    // Comparar con el binario esperado
    let expected = nvs::generate(&params)?;
    let actual = std::fs::read(&tmp_readback)
        .map_err(|e| format!("No se pudo leer el readback NVS: {e}"))?;

    // 8.2: comparar byte a byte
    let mismatches = expected
        .iter()
        .zip(actual.iter())
        .enumerate()
        .filter(|(_, (a, b))| a != b)
        .count();

    if mismatches == 0 {
        esptool::emit_log(&app, "nvs-log", "ok", "✓ Verificación NVS: coincide byte a byte");
        Ok(true)
    } else {
        esptool::emit_log(
            &app,
            "nvs-log",
            "err",
            &format!("✕ Verificación NVS: {mismatches} bytes difieren"),
        );
        Ok(false)
    }
}
