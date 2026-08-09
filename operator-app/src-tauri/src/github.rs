use reqwest::Client;
use serde::{Deserialize, Serialize};

const GITHUB_API: &str = "https://api.github.com";
const USER_AGENT: &str = "operator-app/0.1.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub name: String,
    pub html_url: String,
    pub assets: Vec<ReleaseAsset>,
}

fn client() -> Client {
    Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .expect("reqwest client")
}

/// Consulta el último release de un repo GitHub y retorna su información.
pub async fn get_latest_release(repo: &str) -> Result<ReleaseInfo, String> {
    let url = format!("{GITHUB_API}/repos/{repo}/releases/latest");
    let resp = client()
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Error de red al consultar GitHub: {e}"))?;

    match resp.status().as_u16() {
        200 => {}
        404 => return Err(format!("Repositorio o release no encontrado: {repo}")),
        403 => return Err("Rate limit de GitHub excedido. Intentá en unos minutos.".into()),
        code => {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("GitHub API HTTP {code}: {body}"));
        }
    }

    resp.json::<ReleaseInfo>()
        .await
        .map_err(|e| format!("Error al parsear respuesta de GitHub: {e}"))
}

/// Descarga el contenido completo de una URL y lo retorna como bytes.
/// Emite progress_fn(downloaded, total) en cada chunk recibido.
pub async fn download_bytes<F>(url: &str, mut progress_fn: F) -> Result<Vec<u8>, String>
where
    F: FnMut(u64, Option<u64>),
{
    let resp = client()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Error de red al descargar: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {} al descargar asset", resp.status().as_u16()));
    }

    let total = resp.content_length();
    let mut downloaded = 0u64;
    let mut buf = Vec::new();

    let mut resp = resp;
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Error al leer chunk: {e}"))?
    {
        downloaded += chunk.len() as u64;
        buf.extend_from_slice(&chunk);
        progress_fn(downloaded, total);
    }

    Ok(buf)
}
