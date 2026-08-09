/// Wrapper del sidecar esptool para flash y lectura de particiones ESP32.
///
/// Todos los comandos emiten eventos Tauri en tiempo real con el nombre `event_name`
/// para que el frontend pueda mostrar el progreso del flash.
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

/// Línea individual emitida como evento al frontend.
#[derive(Clone, serde::Serialize)]
pub struct FlashLog {
    /// "info" | "ok" | "err"
    pub level: String,
    pub text: String,
}

/// Lanza esptool con los args dados, streama stdout/stderr como eventos Tauri
/// y retorna el código de salida del proceso.
pub async fn run(app: &AppHandle, args: &[&str], event_name: &str) -> Result<i32, String> {
    emit(app, event_name, "info", &format!("$ esptool {}", args.join(" ")));

    let (mut rx, _child) = app
        .shell()
        .sidecar("binaries/esptool")
        .map_err(|e| format!("Error preparando esptool sidecar: {e}"))?
        .args(args)
        .spawn()
        .map_err(|e| {
            // Detectar error de permisos USB en Linux
            let msg = e.to_string();
            if msg.contains("Permission denied") || msg.contains("EACCES") || msg.contains("13)") {
                format!(
                    "Permiso denegado en el puerto serie.\n\
                     En Linux, agregá tu usuario al grupo dialout:\n\
                     sudo usermod -aG dialout $USER\n\
                     Luego cerrá sesión y volvé a iniciarla."
                )
            } else {
                format!("No se pudo iniciar esptool: {e}")
            }
        })?;

    let mut exit_code = 0i32;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    let line = line.trim_end();
                    if !line.is_empty() {
                        emit(app, event_name, "info", line);
                    }
                }
            }
            CommandEvent::Stderr(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    let line = line.trim_end();
                    if line.is_empty() {
                        continue;
                    }
                    // esptool escribe el progreso en stderr; detectar errores reales
                    let level = if is_permission_error(line) || is_error_line(line) {
                        "err"
                    } else {
                        "info"
                    };
                    emit(app, event_name, level, line);

                    // Re-lanzar como error con instrucciones si es un problema de permisos
                    if is_permission_error(line) {
                        return Err(format!(
                            "Permiso denegado en el puerto serie.\n\
                             En Linux, agregá tu usuario al grupo dialout:\n\
                             sudo usermod -aG dialout $USER\n\
                             Luego cerrá sesión y volvé a iniciarla."
                        ));
                    }
                }
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code.unwrap_or(-1);
                break;
            }
            CommandEvent::Error(msg) => {
                emit(app, event_name, "err", &msg);
            }
            _ => {}
        }
    }

    Ok(exit_code)
}

/// Verifica la conectividad con el ESP32 ejecutando `esptool chip_id`.
/// Retorna Ok(chip_description) o Err con el mensaje de error.
pub async fn chip_id(app: &AppHandle, port: &str, event_name: &str) -> Result<String, String> {
    emit(app, event_name, "info", &format!("Verificando ESP32 en {port}…"));

    let code = run(app, &["--port", port, "chip_id"], event_name).await?;

    if code != 0 {
        return Err(format!(
            "No se pudo conectar con el ESP32 en {port} (código {code}).\n\
             Verificá que el cable USB esté conectado y el dispositivo esté en modo flash."
        ));
    }

    Ok("ESP32 detectado".to_string())
}

/// Flashea un binario en la dirección indicada.
pub async fn write_flash(
    app: &AppHandle,
    port: &str,
    address: &str,
    bin_path: &str,
    event_name: &str,
) -> Result<(), String> {
    let code = run(
        app,
        &[
            "--port", port,
            "--chip", "auto",
            "write_flash",
            "--flash_size", "detect",
            address, bin_path,
        ],
        event_name,
    )
    .await?;

    if code != 0 {
        return Err(format!("esptool write_flash falló (código {code})"));
    }

    Ok(())
}

/// Lee `size` bytes desde `address` y los guarda en `out_path`.
pub async fn read_flash(
    app: &AppHandle,
    port: &str,
    address: &str,
    size: &str,
    out_path: &str,
    event_name: &str,
) -> Result<(), String> {
    let code = run(
        app,
        &["--port", port, "read_flash", address, size, out_path],
        event_name,
    )
    .await?;

    if code != 0 {
        return Err(format!("esptool read_flash falló (código {code})"));
    }

    Ok(())
}

// ── helpers ───────────────────────────────────────────────────────────────────

/// Emite una línea de log desde código externo (comandos de flash.rs).
pub fn emit_log(app: &AppHandle, event_name: &str, level: &str, text: &str) {
    emit(app, event_name, level, text);
}

fn emit(app: &AppHandle, event_name: &str, level: &str, text: &str) {
    let _ = app.emit(
        event_name,
        FlashLog {
            level: level.to_string(),
            text: text.to_string(),
        },
    );
}

fn is_permission_error(line: &str) -> bool {
    line.contains("Permission denied")
        || line.contains("[Errno 13]")
        || line.contains("EACCES")
        || line.contains("Access is denied")
}

fn is_error_line(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.contains("error") || lower.contains("failed") || lower.contains("exception")
}
