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
