/// Pool de pares DevEUI+AppKey almacenado en SQLite local.
///
/// Esquema CSV de importación:
///   dev_eui,app_key,assigned,assigned_at
///   70B3D5FFFE000001,00112233445566778899AABBCCDDEEFF,0,
use rusqlite::{Connection, params};
use std::path::Path;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct KeyEntry {
    pub dev_eui: String,
    pub app_key: String,
    pub assigned: bool,
    pub assigned_at: Option<String>,
}

fn open(db_path: &Path) -> Result<Connection, String> {
    Connection::open(db_path).map_err(|e| format!("No se pudo abrir key_pool.db: {e}"))
}

fn init(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS key_pool (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            dev_eui      TEXT    NOT NULL UNIQUE,
            app_key      TEXT    NOT NULL,
            assigned     INTEGER NOT NULL DEFAULT 0,
            assigned_at  TEXT
        );",
    )
    .map_err(|e| format!("Error al inicializar key_pool: {e}"))
}

/// Retorna el próximo par DevEUI+AppKey libre y lo marca como asignado.
pub fn next_available(db_path: &Path) -> Result<KeyEntry, String> {
    let conn = open(db_path)?;
    init(&conn)?;

    let now = chrono_now();

    // Seleccionar el primer par no asignado y marcarlo en una sola operación.
    let rows_changed = conn
        .execute(
            "UPDATE key_pool SET assigned = 1, assigned_at = ?1
             WHERE id = (SELECT id FROM key_pool WHERE assigned = 0 ORDER BY id LIMIT 1)",
            params![now],
        )
        .map_err(|e| format!("Error al asignar clave: {e}"))?;

    if rows_changed == 0 {
        return Err("Pool agotado: no hay pares DevEUI+AppKey disponibles. Importá un nuevo CSV.".into());
    }

    conn.query_row(
        "SELECT dev_eui, app_key, assigned, assigned_at
         FROM key_pool WHERE assigned = 1 AND assigned_at = ?1
         ORDER BY id DESC LIMIT 1",
        params![now],
        |row| {
            Ok(KeyEntry {
                dev_eui: row.get(0)?,
                app_key: row.get(1)?,
                assigned: row.get::<_, i32>(2)? != 0,
                assigned_at: row.get(3)?,
            })
        },
    )
    .map_err(|e| format!("Error al leer clave asignada: {e}"))
}

/// Importa pares DevEUI+AppKey desde un CSV y los agrega al pool.
/// Duplicados (mismo dev_eui) son ignorados silenciosamente.
pub fn import_from_csv(db_path: &Path, csv_content: &str) -> Result<u32, String> {
    let conn = open(db_path)?;
    init(&conn)?;

    let mut inserted = 0u32;

    for (i, line) in csv_content.lines().enumerate() {
        let line = line.trim();
        // Ignorar cabecera y líneas vacías/comentarios.
        if line.is_empty() || line.starts_with('#') || line.to_lowercase().starts_with("dev_eui") {
            continue;
        }

        let cols: Vec<&str> = line.split(',').collect();
        if cols.len() < 2 {
            return Err(format!("Línea {}: formato inválido (se esperan al menos dev_eui,app_key)", i + 1));
        }

        let dev_eui = cols[0].trim().to_uppercase().replace([':', '-', ' '], "");
        let app_key = cols[1].trim().to_uppercase().replace([':', '-', ' '], "");

        if dev_eui.len() != 16 || !dev_eui.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!("Línea {}: DevEUI inválido '{}'", i + 1, dev_eui));
        }
        if app_key.len() != 32 || !app_key.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!("Línea {}: AppKey inválida '{}'", i + 1, app_key));
        }

        let rows = conn
            .execute(
                "INSERT OR IGNORE INTO key_pool (dev_eui, app_key) VALUES (?1, ?2)",
                params![dev_eui, app_key],
            )
            .map_err(|e| format!("Error al insertar fila {}: {e}", i + 1))?;

        inserted += rows as u32;
    }

    Ok(inserted)
}

/// Estado del pool: cuántas claves libres / asignadas quedan.
#[derive(Debug, serde::Serialize)]
pub struct PoolStats {
    pub total: u32,
    pub available: u32,
    pub assigned: u32,
}

pub fn stats(db_path: &Path) -> Result<PoolStats, String> {
    let conn = open(db_path)?;
    init(&conn)?;

    let total: u32 = conn
        .query_row("SELECT COUNT(*) FROM key_pool", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let assigned: u32 = conn
        .query_row("SELECT COUNT(*) FROM key_pool WHERE assigned = 1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    Ok(PoolStats { total, available: total - assigned, assigned })
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // ISO-8601 mínimo para evitar dependencia de chrono.
    format!("{secs}")
}
