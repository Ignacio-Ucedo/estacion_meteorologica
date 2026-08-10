use std::io::Write;

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use crate::github::{self, ReleaseAsset};

const DEFAULT_REPO: &str = "Ignacio-Ucedo/estacion_meteorologica";

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct AssetStatus {
    pub name: String,
    pub download_url: String,
    pub sha256_url: Option<String>,
    pub size: u64,
    pub cached_path: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct FirmwareStatus {
    pub latest_tag: String,
    pub html_url: String,
    pub cached_tag: Option<String>,
    pub needs_update: bool,
    pub bin_assets: Vec<AssetStatus>,
    /// true cuando GitHub no fue alcanzable y se usa el caché local como fallback.
    pub offline: bool,
}

#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    downloaded: u64,
    total: Option<u64>,
}

fn firmware_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("firmware"))
        .map_err(|e| format!("No se pudo obtener directorio de datos: {e}"))
}

fn read_cached_tag(app: &AppHandle) -> Option<String> {
    let path = firmware_dir(app).ok()?.join("cached_tag.txt");
    std::fs::read_to_string(path).ok()?.trim().parse().ok()
}

fn write_cached_tag(app: &AppHandle, tag: &str) -> Result<(), String> {
    let dir = firmware_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("cached_tag.txt"), tag).map_err(|e| e.to_string())
}

fn cached_bin_path(app: &AppHandle, tag: &str, name: &str) -> Option<std::path::PathBuf> {
    let path = firmware_dir(app).ok()?.join(tag).join(name);
    if path.exists() { Some(path) } else { None }
}

fn sha256_asset_url(assets: &[ReleaseAsset], bin_name: &str) -> Option<String> {
    let sha_name = format!("{bin_name}.sha256");
    assets
        .iter()
        .find(|a| a.name == sha_name)
        .map(|a| a.browser_download_url.clone())
}

// 11.1: Consulta GitHub y retorna el estado del firmware (última versión vs caché).
// Si GitHub no es alcanzable y existe un caché local, retorna offline: true en vez de error.
#[tauri::command]
pub async fn check_firmware_update(app: AppHandle) -> Result<FirmwareStatus, String> {
    match github::get_latest_release(DEFAULT_REPO).await {
        Ok(release) => {
            let cached_tag = read_cached_tag(&app);
            let needs_update = cached_tag.as_deref() != Some(&release.tag_name);

            let bin_assets: Vec<AssetStatus> = release
                .assets
                .iter()
                .filter(|a| a.name.ends_with(".bin"))
                .map(|a| AssetStatus {
                    name: a.name.clone(),
                    download_url: a.browser_download_url.clone(),
                    sha256_url: sha256_asset_url(&release.assets, &a.name),
                    size: a.size,
                    cached_path: cached_bin_path(&app, &release.tag_name, &a.name)
                        .map(|p| p.to_string_lossy().to_string()),
                })
                .collect();

            Ok(FirmwareStatus {
                latest_tag: release.tag_name,
                html_url: release.html_url,
                cached_tag,
                needs_update,
                bin_assets,
                offline: false,
            })
        }
        Err(net_err) => {
            // Fallback offline: usar caché local si existe.
            let cached_tag = read_cached_tag(&app).ok_or_else(|| {
                format!("Sin conexión a internet y sin firmware cacheado. Conectate a internet para descargar el firmware por primera vez.\n\nDetalle: {net_err}")
            })?;

            let tag_dir = firmware_dir(&app)?.join(&cached_tag);
            let mut bin_assets: Vec<AssetStatus> = std::fs::read_dir(&tag_dir)
                .map_err(|_| {
                    format!("Sin conexión a internet y sin firmware cacheado en disco. Conectate a internet para descargar el firmware por primera vez.\n\nDetalle: {net_err}")
                })?
                .filter_map(|e| e.ok())
                .filter(|e| e.file_name().to_string_lossy().ends_with(".bin"))
                .map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    let path = e.path().to_string_lossy().to_string();
                    let size = e.metadata().map(|m| m.len()).unwrap_or(0);
                    AssetStatus {
                        name,
                        download_url: String::new(),
                        sha256_url: None,
                        size,
                        cached_path: Some(path),
                    }
                })
                .collect();

            if bin_assets.is_empty() {
                return Err(format!(
                    "Sin conexión a internet y sin firmware cacheado. Conectate a internet para descargar el firmware por primera vez.\n\nDetalle: {net_err}"
                ));
            }

            bin_assets.sort_by(|a, b| a.name.cmp(&b.name));

            Ok(FirmwareStatus {
                latest_tag: cached_tag.clone(),
                html_url: String::new(),
                cached_tag: Some(cached_tag),
                needs_update: false,
                bin_assets,
                offline: true,
            })
        }
    }
}

// 11.2 + 11.4: Descarga el .bin, verifica SHA256 y lo cachea localmente.
// Emite eventos "download-progress" { downloaded, total }.
// Retorna la ruta local del binario verificado.
#[tauri::command]
pub async fn download_firmware(
    app: AppHandle,
    tag: String,
    asset_name: String,
    download_url: String,
    sha256_url: Option<String>,
) -> Result<String, String> {
    let app_clone = app.clone();

    // Descargar el .bin con eventos de progreso
    let bin_bytes = github::download_bytes(&download_url, move |dl, total| {
        let _ = app_clone.emit("download-progress", DownloadProgress { downloaded: dl, total });
    })
    .await?;

    // 11.4: Verificar SHA256 si hay un archivo .sha256 disponible
    if let Some(sha_url) = sha256_url {
        let sha_bytes = github::download_bytes(&sha_url, |_, _| {}).await?;
        let sha_str = String::from_utf8_lossy(&sha_bytes);
        // sha256sum produce: "<hash>  <filename>" — tomamos el primer campo
        let expected_hex = sha_str
            .split_whitespace()
            .next()
            .ok_or_else(|| "Archivo .sha256 vacío o inválido".to_string())?
            .to_lowercase();

        if expected_hex.len() != 64 || !expected_hex.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!("Hash SHA256 inválido en el archivo .sha256: {expected_hex}"));
        }

        let mut hasher = Sha256::new();
        hasher.update(&bin_bytes);
        let actual_hex = format!("{:x}", hasher.finalize());

        if actual_hex != expected_hex {
            return Err(format!(
                "Verificación SHA256 fallida.\n  Esperado: {expected_hex}\n  Obtenido: {actual_hex}"
            ));
        }
    }

    // Guardar en caché: {app_data}/firmware/{tag}/{asset_name}
    let out_dir = firmware_dir(&app)?.join(&tag);
    std::fs::create_dir_all(&out_dir).map_err(|e| format!("No se pudo crear directorio de caché: {e}"))?;
    let out_path = out_dir.join(&asset_name);
    {
        let mut f = std::fs::File::create(&out_path)
            .map_err(|e| format!("No se pudo crear el archivo de caché: {e}"))?;
        f.write_all(&bin_bytes)
            .map_err(|e| format!("Error al escribir el binario: {e}"))?;
    }

    write_cached_tag(&app, &tag)?;

    Ok(out_path.to_string_lossy().to_string())
}
