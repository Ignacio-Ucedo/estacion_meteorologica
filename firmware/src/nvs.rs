use anyhow::{bail, Context, Result};
use esp_idf_svc::nvs::{EspDefaultNvsPartition, EspNvs, NvsDefault};

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

    nvs.get_raw("dev_eui", &mut dev_eui)
        .context("dev_eui no encontrado en NVS — ejecutar nvs-provision primero")?
        .ok_or_else(|| anyhow::anyhow!("dev_eui vacío en NVS"))?;

    nvs.get_raw("app_eui", &mut app_eui)
        .context("app_eui no encontrado en NVS")?
        .ok_or_else(|| anyhow::anyhow!("app_eui vacío en NVS"))?;

    nvs.get_raw("app_key", &mut app_key)
        .context("app_key no encontrado en NVS")?
        .ok_or_else(|| anyhow::anyhow!("app_key vacío en NVS"))?;

    Ok(OtaaKeys { dev_eui, app_eui, app_key })
}

pub fn store_otaa_keys(dev_eui: &[u8; 8], app_eui: &[u8; 8], app_key: &[u8; 16]) -> Result<()> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let mut nvs = EspNvs::new(partition, NVS_NAMESPACE, true)
        .context("no se pudo abrir namespace NVS para escritura")?;

    nvs.set_raw("dev_eui", dev_eui).context("error escribiendo dev_eui")?;
    nvs.set_raw("app_eui", app_eui).context("error escribiendo app_eui")?;
    nvs.set_raw("app_key", app_key).context("error escribiendo app_key")?;

    Ok(())
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
    let mut nvs = EspNvs::new(partition, NVS_NAMESPACE, true)
        .context("no se pudo abrir namespace NVS para escritura")?;

    nvs.set_raw("dev_addr", dev_addr).context("error escribiendo dev_addr")?;
    nvs.set_raw("nwk_skey", nwk_skey).context("error escribiendo nwk_skey")?;
    nvs.set_raw("app_skey", app_skey).context("error escribiendo app_skey")?;
    nvs.set_raw("fcnt_up", &fcnt_up.to_le_bytes())
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
        .get_raw("dev_addr", &mut dev_addr)
        .context("error leyendo dev_addr")?
        .is_none()
    {
        return Ok(None);
    }

    let mut nwk_skey = [0u8; 16];
    nvs.get_raw("nwk_skey", &mut nwk_skey)
        .context("error leyendo nwk_skey")?
        .ok_or_else(|| anyhow::anyhow!("nwk_skey ausente en NVS"))?;

    let mut app_skey = [0u8; 16];
    nvs.get_raw("app_skey", &mut app_skey)
        .context("error leyendo app_skey")?
        .ok_or_else(|| anyhow::anyhow!("app_skey ausente en NVS"))?;

    let mut fcnt_buf = [0u8; 4];
    nvs.get_raw("fcnt_up", &mut fcnt_buf)
        .context("error leyendo fcnt_up")?
        .ok_or_else(|| anyhow::anyhow!("fcnt_up ausente en NVS"))?;
    let fcnt_up = u32::from_le_bytes(fcnt_buf);

    Ok(Some((dev_addr, nwk_skey, app_skey, fcnt_up)))
}

/// Persiste el contador de secuencia del payload (no confundir con FCnt LoRaWAN).
pub fn store_seq(seq: u16) -> Result<()> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let mut nvs = EspNvs::new(partition, NVS_NAMESPACE, true)
        .context("no se pudo abrir namespace NVS para escritura")?;

    nvs.set_raw("seq", &seq.to_le_bytes()).context("error escribiendo seq")?;
    Ok(())
}

/// Carga el contador de secuencia desde NVS; devuelve 0 si no existe.
pub fn load_seq() -> Result<u16> {
    let partition = EspDefaultNvsPartition::take()
        .context("no se pudo tomar la partición NVS")?;
    let nvs = EspNvs::new(partition, NVS_NAMESPACE, false)
        .context("no se pudo abrir namespace NVS")?;

    let mut buf = [0u8; 2];
    match nvs.get_raw("seq", &mut buf).context("error leyendo seq")? {
        None => Ok(0),
        Some(_) => Ok(u16::from_le_bytes(buf)),
    }
}
