//! Stack LoRaWAN minimal para Class A, EU433, OTAA.
//!
//! Los módulos crypto/frame/session viven en weather-core (Rust puro, compilable en host).
//! Este módulo agrega las operaciones radio-específicas (Sx1278 + ESP-IDF).

// Re-exportar desde weather-core para que los bins puedan usar
// `weather_firmware::lorawan::{crypto, frame, session}` sin cambios.
pub use weather_core::lorawan::crypto;
pub use weather_core::lorawan::frame;
pub use weather_core::lorawan::session;

use anyhow::{bail, Result};
use log::{error, info, warn};

use crate::radio::Sx1278;
use session::LorawanSession;
use crypto::{
    join_request_mic, decrypt_join_accept, verify_join_accept_mic,
    derive_session_keys, uplink_mic, encrypt_frm_payload,
    DevEui, AppEui, AppKey,
};
use frame::{build_join_request, parse_join_accept, build_mac_payload, build_uplink, MHDR_JOIN_ACCEPT};

const FPORT_WEATHER: u8 = 2;
const JOIN_ACCEPT_TIMEOUT_MS: u32 = 6_000;
const JOIN_RETRY_BASE_MS: u32 = 10_000;
const JOIN_MAX_RETRIES: u32 = 5;

pub fn otaa_join(
    radio: &mut Sx1278,
    dev_eui: &DevEui,
    app_eui: &AppEui,
    app_key: &AppKey,
) -> Result<LorawanSession> {
    let dev_nonce: u16 =
        (unsafe { esp_idf_svc::sys::esp_timer_get_time() } as u64 / 1000 & 0xFFFF) as u16;

    let mut app_eui_le = *app_eui;
    app_eui_le.reverse();
    let mut dev_eui_le = *dev_eui;
    dev_eui_le.reverse();

    let mic = join_request_mic(app_key, &app_eui_le, &dev_eui_le, dev_nonce);
    let join_req = build_join_request(app_eui, dev_eui, dev_nonce, &mic);

    let mut retry_delay_ms = JOIN_RETRY_BASE_MS;

    for attempt in 1..=JOIN_MAX_RETRIES {
        info!("lorawan_join attempt={} dev_nonce={:#06x}", attempt, dev_nonce);

        radio.transmit(&join_req)?;

        let mut buf = [0u8; 64];
        match radio.receive_with_timeout(&mut buf, JOIN_ACCEPT_TIMEOUT_MS) {
            Ok(Some(n)) => {
                let raw = &mut buf[..n];
                if raw[0] == MHDR_JOIN_ACCEPT && n >= 17 {
                    let body = &mut raw[1..];
                    decrypt_join_accept(app_key, body);

                    let mic_off = body.len() - 4;
                    let mic_bytes: [u8; 4] = body[mic_off..].try_into().unwrap();

                    if !verify_join_accept_mic(app_key, MHDR_JOIN_ACCEPT, &body[..mic_off], &mic_bytes) {
                        warn!("lorawan_join_accept mic_invalid attempt={}", attempt);
                    } else if let Some(fields) = parse_join_accept(raw) {
                        let (nwk_skey, app_skey) =
                            derive_session_keys(app_key, fields.app_nonce, fields.net_id, dev_nonce);
                        let session = LorawanSession::new(fields.dev_addr, nwk_skey, app_skey);
                        info!(
                            "lorawan_join_ok dev_addr={:02X?} attempt={}",
                            session.dev_addr, attempt
                        );
                        return Ok(session);
                    }
                }
            }
            Ok(None) => warn!("lorawan_join_timeout attempt={}", attempt),
            Err(e) => error!("lorawan_join_rx_error={:?} attempt={}", e, attempt),
        }

        esp_idf_hal::delay::FreeRtos::delay_ms(retry_delay_ms);
        retry_delay_ms = retry_delay_ms.saturating_mul(2).min(300_000);
    }

    bail!("lorawan_join_failed after {} attempts", JOIN_MAX_RETRIES)
}

pub fn send_uplink(
    radio: &mut Sx1278,
    session: &mut LorawanSession,
    frm_payload: &mut [u8],
) -> Result<()> {
    let fcnt = session.next_fcnt();

    encrypt_frm_payload(&session.app_skey, &session.dev_addr, fcnt, frm_payload);

    let mac_payload = build_mac_payload(&session.dev_addr, fcnt, FPORT_WEATHER, frm_payload);
    let mic = uplink_mic(&session.nwk_skey, &session.dev_addr, fcnt, &mac_payload);
    let frame = build_uplink(&session.dev_addr, fcnt, FPORT_WEATHER, frm_payload, &mic);

    info!("lorawan_uplink fcnt={} payload_len={}", fcnt, frm_payload.len());
    radio.transmit(frame.as_slice())?;
    Ok(())
}
