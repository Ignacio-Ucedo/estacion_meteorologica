use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceEntry {
    pub id: i64,
    pub dev_eui: String,
    pub port: String,
    pub wifi_ssid: String,
    pub chirpstack_host: String,
    pub status: String,        // "ok" | "partial" | "error"
    pub firmware_file: String,
    pub params_json: String,
    pub provisioned_at: String, // Unix epoch seconds as string
}

fn open(db_path: &Path) -> Result<Connection, String> {
    Connection::open(db_path).map_err(|e| format!("No se pudo abrir device_log.db: {e}"))
}

fn init(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS device_log (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            dev_eui         TEXT NOT NULL,
            port            TEXT NOT NULL DEFAULT '',
            wifi_ssid       TEXT NOT NULL DEFAULT '',
            chirpstack_host TEXT NOT NULL DEFAULT '',
            status          TEXT NOT NULL,
            firmware_file   TEXT NOT NULL DEFAULT '',
            params_json     TEXT NOT NULL DEFAULT '{}',
            provisioned_at  TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("Error al inicializar device_log: {e}"))
}

pub fn log_entry(db_path: &Path, entry: &DeviceEntry) -> Result<i64, String> {
    let conn = open(db_path)?;
    init(&conn)?;
    conn.execute(
        "INSERT INTO device_log
            (dev_eui, port, wifi_ssid, chirpstack_host, status, firmware_file, params_json, provisioned_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            entry.dev_eui,
            entry.port,
            entry.wifi_ssid,
            entry.chirpstack_host,
            entry.status,
            entry.firmware_file,
            entry.params_json,
            entry.provisioned_at,
        ],
    )
    .map_err(|e| format!("Error al guardar entrada: {e}"))?;
    Ok(conn.last_insert_rowid())
}

pub fn list_entries(db_path: &Path) -> Result<Vec<DeviceEntry>, String> {
    let conn = open(db_path)?;
    init(&conn)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, dev_eui, port, wifi_ssid, chirpstack_host, status,
                    firmware_file, params_json, provisioned_at
             FROM device_log ORDER BY provisioned_at DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map([], |row| {
            Ok(DeviceEntry {
                id: row.get(0)?,
                dev_eui: row.get(1)?,
                port: row.get(2)?,
                wifi_ssid: row.get(3)?,
                chirpstack_host: row.get(4)?,
                status: row.get(5)?,
                firmware_file: row.get(6)?,
                params_json: row.get(7)?,
                provisioned_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

pub fn to_csv(entries: &[DeviceEntry]) -> String {
    let mut out = String::from(
        "id,dev_eui,port,wifi_ssid,chirpstack_host,status,firmware_file,provisioned_at\n",
    );
    for e in entries {
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            e.id,
            e.dev_eui,
            csv_escape(&e.port),
            csv_escape(&e.wifi_ssid),
            csv_escape(&e.chirpstack_host),
            e.status,
            csv_escape(&e.firmware_file),
            e.provisioned_at,
        ));
    }
    out
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

pub fn unix_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}
