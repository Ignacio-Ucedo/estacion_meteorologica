use std::path::PathBuf;

#[tauri::command]
pub async fn sync_chirpstack(backend_url: String) -> Result<String, String> {
    let candidates = [
        PathBuf::from("../infra/chirpstack-provision.py"),
        PathBuf::from("../../infra/chirpstack-provision.py"),
    ];
    let script = candidates
        .iter()
        .find(|p| p.exists())
        .ok_or_else(|| {
            format!(
                "Script no encontrado. Corré manualmente:\n  python3 infra/chirpstack-provision.py --backend-url {}",
                backend_url
            )
        })?;

    // ChirpStack corre en Docker y necesita el hostname del servicio, no localhost
    let chirpstack_backend_url = backend_url.replace("http://localhost:", "http://backend:");

    let output = tokio::process::Command::new("python3")
        .arg(script)
        .arg("--backend-url")
        .arg(&chirpstack_backend_url)
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
