//! Estado de sesión LoRaWAN OTAA (derivado del JoinAccept).

use super::crypto::{NwkSKey, AppSKey, DevAddr};

#[derive(Debug, Clone)]
pub struct LorawanSession {
    pub dev_addr: DevAddr,
    pub nwk_skey: NwkSKey,
    pub app_skey: AppSKey,
    /// Frame counter de uplink (incrementa en cada TX)
    pub fcnt_up: u32,
}

impl LorawanSession {
    pub fn new(dev_addr: DevAddr, nwk_skey: NwkSKey, app_skey: AppSKey) -> Self {
        Self { dev_addr, nwk_skey, app_skey, fcnt_up: 0 }
    }

    /// Devuelve el fcnt actual y lo incrementa.
    pub fn next_fcnt(&mut self) -> u32 {
        let fcnt = self.fcnt_up;
        self.fcnt_up = self.fcnt_up.wrapping_add(1);
        fcnt
    }
}
