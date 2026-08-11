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

/// Parsea un tag semver del estilo "v1.2.3" o "v1.2.3-suffix" en (major, minor, patch).
/// Retorna None si el tag no sigue el patrón, lo que lo excluye de la selección.
fn parse_semver(tag: &str) -> Option<(u32, u32, u32)> {
    let tag = tag.strip_prefix('v')?;
    // Ignorar sufijos como "-ci-test", "-alpha", etc.
    let version_part = tag.split('-').next()?;
    let parts: Vec<&str> = version_part.split('.').collect();
    if parts.len() < 3 {
        return None;
    }
    let major = parts[0].parse().ok()?;
    let minor = parts[1].parse().ok()?;
    let patch = parts[2].parse().ok()?;
    Some((major, minor, patch))
}

/// Consulta todos los releases del repo y retorna el de mayor versión semántica.
/// Usa /releases en vez de /releases/latest para evitar que releases más recientes
/// pero de menor versión (re-builds de tags viejos) sean seleccionados.
pub async fn get_latest_release(repo: &str) -> Result<ReleaseInfo, String> {
    let url = format!("{GITHUB_API}/repos/{repo}/releases?per_page=50");
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

    #[derive(serde::Deserialize)]
    struct ReleaseListItem {
        tag_name: String,
        name: String,
        html_url: String,
        assets: Vec<ReleaseAsset>,
        draft: bool,
        prerelease: bool,
    }

    let releases: Vec<ReleaseListItem> = resp
        .json()
        .await
        .map_err(|e| format!("Error al parsear respuesta de GitHub: {e}"))?;

    releases
        .into_iter()
        .filter(|r| !r.draft)
        .filter(|r| parse_semver(&r.tag_name).is_some())
        .max_by_key(|r| parse_semver(&r.tag_name).unwrap())
        .map(|r| ReleaseInfo {
            tag_name: r.tag_name,
            name: r.name,
            html_url: r.html_url,
            assets: r.assets,
        })
        .ok_or_else(|| format!("No se encontraron releases con versión semántica válida en {repo}"))
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
