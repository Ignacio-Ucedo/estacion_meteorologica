use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio_util::sync::CancellationToken;

use crate::state::{AppState, GatewayConfig, GatewayStatus};
use crate::gateway::task::run_gateway;

#[tauri::command]
pub async fn start_gateway(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    config: GatewayConfig,
) -> Result<(), String> {
    let mut gw = state.gateway.lock().unwrap();
    if gw.status == GatewayStatus::Running || gw.status == GatewayStatus::Connecting {
        return Err("Gateway ya está corriendo".into());
    }

    let token = CancellationToken::new();
    gw.status = GatewayStatus::Connecting;
    gw.cancellation_token = Some(token.clone());
    drop(gw);

    let state_clone = state.inner().clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        run_gateway(app_clone.clone(), config, token).await;
        let mut gw = state_clone.gateway.lock().unwrap();
        gw.status = GatewayStatus::Stopped;
        gw.cancellation_token = None;
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_gateway(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut gw = state.gateway.lock().unwrap();
    if let Some(token) = gw.cancellation_token.take() {
        token.cancel();
    }
    gw.status = GatewayStatus::Stopped;
    Ok(())
}

#[tauri::command]
pub async fn get_gateway_status(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    let gw = state.gateway.lock().unwrap();
    let s = match &gw.status {
        GatewayStatus::Stopped => "stopped",
        GatewayStatus::Connecting => "connecting",
        GatewayStatus::Running => "running",
        GatewayStatus::Error(_) => "error",
    };
    Ok(s.to_string())
}

#[tauri::command]
pub fn load_nvs_csv(path: String) -> Result<GatewayConfig, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("No se pudo leer {path}: {e}"))?;

    let mut config = GatewayConfig::default();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = line.splitn(3, ',').collect();
        if parts.len() < 3 {
            continue;
        }
        let key = parts[0].trim();
        let value = parts[2].trim().trim_matches('"');

        match key {
            "lorawan_dev_eui" => config.dev_eui = value.to_string(),
            "lorawan_app_eui" => config.app_eui = value.to_string(),
            "lorawan_app_key" => config.app_key = value.to_string(),
            _ => {}
        }
    }

    if config.dev_eui.is_empty() || config.app_key.is_empty() {
        return Err("CSV no contiene lorawan_dev_eui o lorawan_app_key".into());
    }

    Ok(config)
}
