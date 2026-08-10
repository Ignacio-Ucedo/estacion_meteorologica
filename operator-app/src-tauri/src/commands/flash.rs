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

// ── Lectura de MAC y derivación EUI-64 ───────────────────────────────────────

/// Convierte una MAC WiFi (EUI-48) al EUI-64 del gateway según el estándar IEEE:
/// inserta 0xFF:0xFE en la posición 3-4.
/// Ej: AA:BB:CC:DD:EE:FF → AA:BB:CC:FF:FE:DD:EE:FF
fn mac_to_eui64(mac: [u8; 6]) -> [u8; 8] {
    [mac[0], mac[1], mac[2], 0xFF, 0xFE, mac[3], mac[4], mac[5]]
}

/// Lee la MAC WiFi del ESP32 vía `esptool read_mac` y retorna el EUI-64 derivado
/// como hex string lowercase de 16 caracteres (sin separadores).
#[tauri::command]
pub async fn read_gateway_eui(app: AppHandle, port: String) -> Result<String, String> {
    use tauri_plugin_shell::ShellExt;
    use tauri_plugin_shell::process::CommandEvent;

    let (mut rx, _child) = app
        .shell()
        .sidecar("esptool")
        .map_err(|e| format!("Error preparando esptool sidecar: {e}"))?
        .args(["--port", &port, "read_mac"])
        .spawn()
        .map_err(|e| format!("No se pudo iniciar esptool: {e}"))?;

    let mut output = String::new();
    let mut exit_code = 0i32;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                output.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Stderr(bytes) => {
                output.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code.unwrap_or(-1);
                break;
            }
            _ => {}
        }
    }

    if exit_code != 0 {
        return Err(format!(
            "esptool read_mac falló (código {exit_code}).\n\
             Verificá que el ESP32 esté conectado y en modo normal (no flash)."
        ));
    }

    // Parsear línea "MAC: aa:bb:cc:dd:ee:ff"
    let mac_str = output
        .lines()
        .find(|l| l.trim().to_uppercase().starts_with("MAC:"))
        .ok_or_else(|| format!("No se encontró línea MAC en la salida:\n{output}"))?
        .trim()
        .splitn(2, ':')
        .nth(1)
        .map(str::trim)
        .ok_or("Formato de línea MAC inválido")?
        .to_string();

    let bytes: Vec<u8> = mac_str
        .split(':')
        .map(|s| u8::from_str_radix(s.trim(), 16))
        .collect::<Result<_, _>>()
        .map_err(|e| format!("Error al parsear MAC '{mac_str}': {e}"))?;

    if bytes.len() != 6 {
        return Err(format!("MAC con longitud inválida: {} bytes", bytes.len()));
    }

    let mac: [u8; 6] = bytes.try_into().unwrap();
    let eui = mac_to_eui64(mac);

    Ok(eui.iter().map(|b| format!("{b:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mac_to_eui64_known_vector() {
        let mac = [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF];
        let eui = mac_to_eui64(mac);
        assert_eq!(eui, [0xAA, 0xBB, 0xCC, 0xFF, 0xFE, 0xDD, 0xEE, 0xFF]);
    }
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
