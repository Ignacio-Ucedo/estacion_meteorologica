//! Stack LoRaWAN minimal para Class A, EU433, OTAA.
//!
//! Implementa:
//! - JoinRequest / JoinAccept (OTAA)
//! - Uplink no confirmado (UnconfirmedDataUp)
//! - Crypto: AES-CMAC (MIC), AES-ECB (JoinAccept + session keys), AES-CTR (FRMPayload)
//!
//! No implementa (fuera del scope del prototipo):
//! - ADR (Adaptive Data Rate)
//! - Downlinks / ACK confirmados
//! - Class B / Class C
//! - Frame counter persistente en NVS (se reinicia en cada power cycle)
//! - Channel hopping (single-channel fijo: 433.175 MHz SF7BW125)

pub mod crypto;
pub mod frame;
pub mod session;

use anyhow::{bail, Result};
use log::{error, info, warn};

use crate::radio::Sx1278;
use session::LorawanSession;
use crypto::{
    join_request_mic, decrypt_join_accept, verify_join_accept_mic,
    derive_session_keys, uplink_mic, encrypt_frm_payload,
    DevEui, AppEui, AppKey,
};
use frame::{build_join_request, parse_join_accept, build_uplink, MHDR_JOIN_ACCEPT};

const FPORT_WEATHER: u8 = 2;
/// Tiempo máximo de espera del JoinAccept (ventana RX1 de EU433: ~1 s + margen)
const JOIN_ACCEPT_TIMEOUT_MS: u32 = 6_000;
/// Backoff inicial entre reintentos de join
const JOIN_RETRY_BASE_MS: u32 = 10_000;
/// Máximo de retries antes de resetear el contador
const JOIN_MAX_RETRIES: u32 = 5;

/// Realiza el join OTAA con backoff exponencial.
/// Retorna la sesión si tiene éxito.
pub fn otaa_join(
    radio: &mut Sx1278,
    dev_eui: &DevEui,
    app_eui: &AppEui,
    app_key: &AppKey,
) -> Result<LorawanSession> {
    // DevNonce: simple counter; para mayor seguridad usar NVS persistente
    let dev_nonce: u16 = (esp_idf_hal::delay::FreeRtos::now_ms() & 0xFFFF) as u16;

    // AppEUI y DevEUI en wire son LSB first
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

        // Esperar JoinAccept en ventana RX1
        let mut buf = [0u8; 64];
        match radio.receive_with_timeout(&mut buf, JOIN_ACCEPT_TIMEOUT_MS) {
            Ok(Some(n)) => {
                let raw = &mut buf[..n];
                if raw[0] == MHDR_JOIN_ACCEPT && n >= 17 {
                    // Descifrar body (bytes 1..)
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

/// Transmite un uplink no confirmado con el FRMPayload dado.
/// Modifica `frm_payload` in-place (cifrado).
pub fn send_uplink(
    radio: &mut Sx1278,
    session: &mut LorawanSession,
    frm_payload: &mut [u8],
) -> Result<()> {
    let fcnt = session.next_fcnt();

    // Cifrar FRMPayload in-place
    encrypt_frm_payload(&session.app_skey, &session.dev_addr, fcnt, frm_payload);

    // Construir trama completa (MHDR + FHDR + FPort + payload cifrado)
    let mic = uplink_mic(&session.nwk_skey, &session.dev_addr, fcnt, frm_payload);
    let frame = build_uplink(&session.dev_addr, fcnt, FPORT_WEATHER, frm_payload, &mic);

    info!("lorawan_uplink fcnt={} payload_len={}", fcnt, frm_payload.len());
    radio.transmit(frame.as_slice())?;
    Ok(())
}
