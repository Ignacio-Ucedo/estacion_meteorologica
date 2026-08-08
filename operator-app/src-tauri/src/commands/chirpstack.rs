use std::path::PathBuf;

const GATEWAY_EUI: &str = "aabbccfffeddeeff";

#[tauri::command]
pub async fn sync_chirpstack(
    dev_eui: String,
    app_key: String,
    chirpstack_url: String,
    backend_url: String,
) -> Result<String, String> {
    // Silence unused warnings — dev_eui/app_key are passed from the UI for
    // display context; the script reads them from nvs_mock.csv directly.
    let _ = (&dev_eui, &app_key, &chirpstack_url);

    let candidates = [
        PathBuf::from("../infra/chirpstack-provision.py"),
        PathBuf::from("../../infra/chirpstack-provision.py"),
    ];
    let script = candidates
        .iter()
        .find(|p| p.exists())
        .ok_or_else(|| {
            format!(
                "Script no encontrado. Corré manualmente:\n  python3 infra/chirpstack-provision.py \\\n    --gateway-eui {GATEWAY_EUI} \\\n    --backend-url {backend_url}"
            )
        })?;

    // ChirpStack corre en Docker: el webhook debe usar el hostname del servicio,
    // no localhost (que resuelve al propio contenedor chirpstack).
    let backend_url_docker = backend_url
        .replace("http://localhost:", "http://backend:")
        .replace("https://localhost:", "https://backend:");

    let output = tokio::process::Command::new("python3")
        .arg(script)
        .arg("--gateway-eui")
        .arg(GATEWAY_EUI)
        .arg("--backend-url")
        .arg(&backend_url_docker)
        .output()
        .await
        .map_err(|e| format!("No se pudo ejecutar python3: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr)
        .lines()
        .filter(|l| !l.contains("WARN") && !l.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("{stdout}\n{stderr}").trim().to_string())
    }
}
