use anyhow::{Context, Result};
use esp_idf_svc::nvs::{EspDefaultNvsPartition, EspNvs};

/// Claves OTAA leídas desde NVS del ESP32.
/// Se escriben una sola vez vía nvs-provision antes del primer despliegue.
#[derive(Debug, Clone)]
pub struct OtaaKeys {
    /// Device EUI — 8 bytes, MSB primero (como lo muestra ChirpStack)
    pub dev_eui: [u8; 8],
    /// Application/Join EUI — 8 bytes, MSB primero
    pub app_eui: [u8; 8],
    /// Application Key — 16 bytes
    pub app_key: [u8; 16],
}

const NVS_NAMESPACE: &str = "lorawan";

pub fn load_otaa_keys() -> Result<OtaaKeys> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS por defecto")?;
    let nvs = EspNvs::new(partition, NVS_NAMESPACE, false)
        .context("no se pudo abrir el namespace NVS 'lorawan'")?;

    let mut dev_eui = [0u8; 8];
    let mut app_eui = [0u8; 8];
    let mut app_key = [0u8; 16];

    nvs.get_blob("dev_eui", &mut dev_eui)
        .context("dev_eui no encontrado en NVS — ejecutar nvs-provision primero")?
        .ok_or_else(|| anyhow::anyhow!("dev_eui vacío en NVS"))?;

    nvs.get_blob("app_eui", &mut app_eui)
        .context("app_eui no encontrado en NVS")?
        .ok_or_else(|| anyhow::anyhow!("app_eui vacío en NVS"))?;

    nvs.get_blob("app_key", &mut app_key)
        .context("app_key no encontrado en NVS")?
        .ok_or_else(|| anyhow::anyhow!("app_key vacío en NVS"))?;

    Ok(OtaaKeys { dev_eui, app_eui, app_key })
}

pub fn store_otaa_keys(dev_eui: &[u8; 8], app_eui: &[u8; 8], app_key: &[u8; 16]) -> Result<()> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, NVS_NAMESPACE, true)
        .context("no se pudo abrir namespace NVS para escritura")?;

    nvs.set_blob("dev_eui", dev_eui).context("error escribiendo dev_eui")?;
    nvs.set_blob("app_eui", app_eui).context("error escribiendo app_eui")?;
    nvs.set_blob("app_key", app_key).context("error escribiendo app_key")?;

    Ok(())
}

/// Carga las credenciales WiFi desde NVS (namespace "wifi", claves "ssid" y "pass").
/// Escrito por el operator-app durante el aprovisionamiento.
pub fn load_wifi_credentials() -> Result<(String, String)> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, "wifi", false)
        .context("no se pudo abrir namespace NVS 'wifi'")?;

    let mut buf = [0u8; 65];
    let ssid = nvs
        .get_str("ssid", &mut buf)
        .context("error leyendo wifi/ssid")?
        .ok_or_else(|| anyhow::anyhow!("wifi/ssid no encontrado en NVS — ejecutar nvs-provision primero"))?
        .to_owned();

    let mut buf2 = [0u8; 65];
    let pass = nvs
        .get_str("pass", &mut buf2)
        .context("error leyendo wifi/pass")?
        .ok_or_else(|| anyhow::anyhow!("wifi/pass no encontrado en NVS"))?
        .to_owned();

    Ok((ssid, pass))
}

/// Carga el host del ChirpStack Gateway Bridge desde NVS
/// (namespace "config", clave "gw_host", formato "host:puerto").
/// Escrito por el operator-app durante el aprovisionamiento del gateway.
pub fn load_gateway_host() -> Result<String> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, "config", false)
        .context("no se pudo abrir namespace NVS 'config'")?;

    let mut buf = [0u8; 128];
    nvs.get_str("gw_host", &mut buf)
        .context("error leyendo config/gw_host")?
        .ok_or_else(|| anyhow::anyhow!(
            "config/gw_host no encontrado en NVS — ejecutar nvs-provision del gateway primero"
        ))
        .map(|s| s.to_owned())
}

/// Deriva el DevEUI a partir de la MAC WiFi del ESP32 (EUI-48 → EUI-64).
/// Útil cuando no se ha provisionado NVS aún (identificación inicial).
pub fn dev_eui_from_mac(mac: &[u8; 6]) -> [u8; 8] {
    [mac[0], mac[1], mac[2], 0xFF, 0xFE, mac[3], mac[4], mac[5]]
}

/// Persiste la sesión LoRaWAN activa en NVS para sobrevivir reinicios.
/// Argumentos en bytes raw para evitar dependencia circular con lorawan::session.
pub fn store_lorawan_session(
    dev_addr: &[u8; 4],
    nwk_skey: &[u8; 16],
    app_skey: &[u8; 16],
    fcnt_up: u32,
) -> Result<()> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, NVS_NAMESPACE, true)
        .context("no se pudo abrir namespace NVS para escritura")?;

    nvs.set_blob("dev_addr", dev_addr).context("error escribiendo dev_addr")?;
    nvs.set_blob("nwk_skey", nwk_skey).context("error escribiendo nwk_skey")?;
    nvs.set_blob("app_skey", app_skey).context("error escribiendo app_skey")?;
    nvs.set_blob("fcnt_up", &fcnt_up.to_le_bytes())
        .context("error escribiendo fcnt_up")?;
    Ok(())
}

/// Carga la sesión LoRaWAN desde NVS.
/// Retorna `None` si no hay sesión persistida (primer arranque o post-reset de sesión).
pub fn load_lorawan_session() -> Result<Option<([u8; 4], [u8; 16], [u8; 16], u32)>> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, NVS_NAMESPACE, false)
        .context("no se pudo abrir namespace NVS")?;

    let mut dev_addr = [0u8; 4];
    if nvs
        .get_blob("dev_addr", &mut dev_addr)
        .context("error leyendo dev_addr")?
        .is_none()
    {
        return Ok(None);
    }

    let mut nwk_skey = [0u8; 16];
    nvs.get_blob("nwk_skey", &mut nwk_skey)
        .context("error leyendo nwk_skey")?
        .ok_or_else(|| anyhow::anyhow!("nwk_skey ausente en NVS"))?;

    let mut app_skey = [0u8; 16];
    nvs.get_blob("app_skey", &mut app_skey)
        .context("error leyendo app_skey")?
        .ok_or_else(|| anyhow::anyhow!("app_skey ausente en NVS"))?;

    let mut fcnt_buf = [0u8; 4];
    nvs.get_blob("fcnt_up", &mut fcnt_buf)
        .context("error leyendo fcnt_up")?
        .ok_or_else(|| anyhow::anyhow!("fcnt_up ausente en NVS"))?;
    let fcnt_up = u32::from_le_bytes(fcnt_buf);

    Ok(Some((dev_addr, nwk_skey, app_skey, fcnt_up)))
}

/// Escribe un flag de diagnóstico en el namespace "diag" (best-effort, no falla el firmware).
/// Solo llamar en puntos de ÉXITO — nunca al inicio del boot ni en errores.
/// Así, el boot lejos del WiFi (que falla antes de llegar a estos puntos) no los pisa.
///
/// Claves usadas por gateway-node-mock:
///   wifi_ok  = 1  → WiFi conectó exitosamente
///   otaa_ok  = 1  → sesión OTAA establecida (join o restore)
///   tx_ok    = 1  → al menos un uplink enviado
pub fn write_diag(key: &str, val: u8) {
    let Ok(partition) = EspDefaultNvsPartition::take() else { return };
    let Ok(nvs) = EspNvs::new(partition, "diag", true) else { return };
    let _ = nvs.set_u8(key, val);
}

/// Lee un flag de diagnóstico del namespace "diag". Devuelve 0 si no existe.
pub fn read_diag(key: &str) -> u8 {
    EspDefaultNvsPartition::take()
        .ok()
        .and_then(|p| EspNvs::new(p, "diag", false).ok())
        .and_then(|nvs| nvs.get_u8(key).ok().flatten())
        .unwrap_or(0)
}

/// Persiste el contador de secuencia del payload (no confundir con FCnt LoRaWAN).
pub fn store_seq(seq: u16) -> Result<()> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, NVS_NAMESPACE, true)
        .context("no se pudo abrir namespace NVS para escritura")?;

    nvs.set_blob("seq", &seq.to_le_bytes()).context("error escribiendo seq")?;
    Ok(())
}

/// Carga el contador de secuencia desde NVS; devuelve 0 si no existe.
pub fn load_seq() -> Result<u16> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, NVS_NAMESPACE, false)
        .context("no se pudo abrir namespace NVS")?;

    let mut buf = [0u8; 2];
    match nvs.get_blob("seq", &mut buf).context("error leyendo seq")? {
        None => Ok(0),
        Some(_) => Ok(u16::from_le_bytes(buf)),
    }
}
