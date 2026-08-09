use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChirpstackCreds {
    pub host: String,
    pub api_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceProfile {
    pub id: String,
    pub name: String,
}

impl ChirpstackCreds {
    fn client(&self) -> Client {
        Client::new()
    }

    fn url(&self, path: &str) -> String {
        format!("{}/api/{}", self.host.trim_end_matches('/'), path)
    }

    fn auth(&self) -> String {
        format!("Bearer {}", self.api_token)
    }
}

pub async fn device_exists(creds: &ChirpstackCreds, dev_eui: &str) -> Result<bool, String> {
    let resp = creds
        .client()
        .get(creds.url(&format!("devices/{dev_eui}")))
        .header("Authorization", creds.auth())
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    match resp.status().as_u16() {
        200 => Ok(true),
        404 => Ok(false),
        401 | 403 => Err("Token de API inválido o sin permisos".into()),
        code => {
            let body = resp.text().await.unwrap_or_default();
            Err(format!("HTTP {code}: {body}"))
        }
    }
}

pub async fn create_or_update_device(
    creds: &ChirpstackCreds,
    dev_eui: &str,
    app_id: &str,
    profile_id: &str,
) -> Result<bool, String> {
    let exists = device_exists(creds, dev_eui).await?;
    let body = serde_json::json!({
        "device": {
            "devEui": dev_eui,
            "name": format!("nodo-{}", &dev_eui[..8]),
            "description": "Nodo meteorológico",
            "applicationId": app_id,
            "deviceProfileId": profile_id,
            "isDisabled": false,
            "skipFCntCheck": false
        }
    });

    let req = if exists {
        creds
            .client()
            .put(creds.url(&format!("devices/{dev_eui}")))
    } else {
        creds.client().post(creds.url("devices"))
    };

    let resp = req
        .header("Authorization", creds.auth())
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    if resp.status().is_success() {
        Ok(exists) // true = updated, false = created
    } else {
        let code = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        Err(format!(
            "HTTP {code} al {} device: {body}",
            if exists { "actualizar" } else { "crear" }
        ))
    }
}

pub async fn set_device_keys(
    creds: &ChirpstackCreds,
    dev_eui: &str,
    app_key: &str,
) -> Result<(), String> {
    // LoRaWAN 1.0.x: single root key stored in nwkKey field
    let body = serde_json::json!({
        "deviceKeys": {
            "devEui": dev_eui,
            "nwkKey": app_key
        }
    });
    let url = creds.url(&format!("devices/{dev_eui}/keys"));

    let keys_exist = creds
        .client()
        .get(&url)
        .header("Authorization", creds.auth())
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);

    let req = if keys_exist {
        creds.client().put(&url)
    } else {
        creds.client().post(&url)
    };

    let resp = req
        .header("Authorization", creds.auth())
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        let code = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("HTTP {code} al configurar claves OTAA: {body}"))
    }
}

pub async fn list_applications(creds: &ChirpstackCreds) -> Result<Vec<Application>, String> {
    let resp = creds
        .client()
        .get(creds.url("applications?limit=100"))
        .header("Authorization", creds.auth())
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "HTTP {} al listar aplicaciones",
            resp.status().as_u16()
        ));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["result"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| {
            Some(Application {
                id: v["id"].as_str()?.to_string(),
                name: v["name"].as_str().unwrap_or("").to_string(),
            })
        })
        .collect())
}

pub async fn list_device_profiles(creds: &ChirpstackCreds) -> Result<Vec<DeviceProfile>, String> {
    let resp = creds
        .client()
        .get(creds.url("device-profiles?limit=100"))
        .header("Authorization", creds.auth())
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "HTTP {} al listar perfiles de dispositivo",
            resp.status().as_u16()
        ));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["result"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| {
            Some(DeviceProfile {
                id: v["id"].as_str()?.to_string(),
                name: v["name"].as_str().unwrap_or("").to_string(),
            })
        })
        .collect())
}
