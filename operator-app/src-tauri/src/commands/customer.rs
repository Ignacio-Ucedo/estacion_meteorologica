use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Customer {
    pub id: String,
    pub username: String,
}

#[tauri::command]
pub async fn fetch_customers(backend_url: String) -> Result<Vec<Customer>, String> {
    let url = format!("{}/users", backend_url.trim_end_matches('/'));
    let resp = Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Backend respondió {}", resp.status()));
    }

    resp.json::<Vec<Customer>>()
        .await
        .map_err(|e| format!("Error al parsear respuesta: {e}"))
}

#[tauri::command]
pub async fn associate_station_to_customer(
    backend_url: String,
    station_id: String,
    owner_id: String,
) -> Result<(), String> {
    let url = format!(
        "{}/api/stations/{}/owner",
        backend_url.trim_end_matches('/'),
        station_id
    );
    let resp = Client::new()
        .put(&url)
        .json(&serde_json::json!({ "owner_id": owner_id }))
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("Backend respondió {} (la station puede no existir aún)", resp.status()))
    }
}
