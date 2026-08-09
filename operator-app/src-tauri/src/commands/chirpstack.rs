use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::chirpstack_api::{self, ChirpstackCreds};

const GATEWAY_EUI: &str = "aabbccfffeddeeff";
const STORE_FILE: &str = "operator-config.json";
const KEY_TOKEN: &str = "chirpstack_api_token";
const KEY_APP_ID: &str = "chirpstack_app_id";
const KEY_PROFILE_ID: &str = "chirpstack_profile_id";

#[tauri::command]
pub async fn sync_chirpstack(
    dev_eui: String,
    app_key: String,
    chirpstack_url: String,
    backend_url: String,
) -> Result<String, String> {
    let _ = (&dev_eui, &app_key, &chirpstack_url);

    let candidates = [
        PathBuf::from("../infra/chirpstack-provision.py"),
        PathBuf::from("../../infra/chirpstack-provision.py"),
    ];
    let script = candidates.iter().find(|p| p.exists()).ok_or_else(|| {
        format!(
            "Script no encontrado. Corré manualmente:\n  python3 infra/chirpstack-provision.py \\\n    --gateway-eui {GATEWAY_EUI} \\\n    --backend-url {backend_url}"
        )
    })?;

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

// 9.2 + 9.3: Registra (o actualiza si ya existe) el device en ChirpStack v4.
#[tauri::command]
pub async fn register_device_chirpstack(
    host: String,
    api_token: String,
    app_id: String,
    profile_id: String,
    dev_eui: String,
    app_key: String,
) -> Result<String, String> {
    let creds = ChirpstackCreds { host, api_token };

    let updated = chirpstack_api::create_or_update_device(&creds, &dev_eui, &app_id, &profile_id)
        .await?;

    chirpstack_api::set_device_keys(&creds, &dev_eui, &app_key).await?;

    Ok(if updated {
        format!("Device {dev_eui} actualizado en ChirpStack")
    } else {
        format!("Device {dev_eui} creado en ChirpStack")
    })
}

// 9.1: Descubre las aplicaciones y perfiles disponibles en ChirpStack.
#[tauri::command]
pub async fn discover_chirpstack_ids(
    host: String,
    api_token: String,
) -> Result<serde_json::Value, String> {
    let creds = ChirpstackCreds { host, api_token };

    let (apps, profiles) = tokio::try_join!(
        chirpstack_api::list_applications(&creds),
        chirpstack_api::list_device_profiles(&creds),
    )?;

    Ok(serde_json::json!({
        "applications": apps,
        "deviceProfiles": profiles,
    }))
}

// 9.4: Persiste las credenciales de ChirpStack en el store local de la app.
#[tauri::command]
pub fn save_chirpstack_config(
    app: AppHandle,
    api_token: String,
    app_id: String,
    profile_id: String,
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY_TOKEN, serde_json::json!(api_token));
    store.set(KEY_APP_ID, serde_json::json!(app_id));
    store.set(KEY_PROFILE_ID, serde_json::json!(profile_id));
    store.save().map_err(|e| e.to_string())
}

// 9.4: Carga las credenciales de ChirpStack persistidas.
#[tauri::command]
pub fn load_chirpstack_config(app: AppHandle) -> Result<serde_json::Value, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "apiToken":  store.get(KEY_TOKEN).and_then(|v| v.as_str().map(str::to_owned)).unwrap_or_default(),
        "appId":     store.get(KEY_APP_ID).and_then(|v| v.as_str().map(str::to_owned)).unwrap_or_default(),
        "profileId": store.get(KEY_PROFILE_ID).and_then(|v| v.as_str().map(str::to_owned)).unwrap_or_default(),
    }))
}
