//! Construcción y parseo de tramas LoRaWAN (LoRaWAN 1.0.2).

use super::crypto::{AppEui, AppKey, DevEui, DevAddr};

// MHDR values
pub const MHDR_JOIN_REQUEST: u8 = 0x00;
pub const MHDR_JOIN_ACCEPT: u8 = 0x20;
pub const MHDR_UNCONFIRMED_DATA_UP: u8 = 0x40;

/// Construye la trama completa del JoinRequest (23 bytes).
/// AppEUI y DevEUI se transmiten LSB first en el wire.
pub fn build_join_request(
    app_eui: &AppEui,
    dev_eui: &DevEui,
    dev_nonce: u16,
    mic: &[u8; 4],
) -> [u8; 23] {
    let mut frame = [0u8; 23];
    frame[0] = MHDR_JOIN_REQUEST;
    // AppEUI LSB first
    for (i, &b) in app_eui.iter().rev().enumerate() {
        frame[1 + i] = b;
    }
    // DevEUI LSB first
    for (i, &b) in dev_eui.iter().rev().enumerate() {
        frame[9 + i] = b;
    }
    frame[17] = (dev_nonce & 0xFF) as u8;
    frame[18] = (dev_nonce >> 8) as u8;
    frame[19..23].copy_from_slice(mic);
    frame
}

/// Campos decodificados del JoinAccept (tras descifrar).
#[derive(Debug)]
pub struct JoinAcceptFields {
    pub app_nonce: [u8; 3],
    pub net_id: [u8; 3],
    pub dev_addr: DevAddr, // little-endian
    pub dl_settings: u8,
    pub rx_delay: u8,
    pub mic: [u8; 4],
}

/// Parsea el JoinAccept tras haber descifrado el cuerpo.
/// `frame`: trama completa incluyendo MHDR en [0].
/// Mínimo: 1 (MHDR) + 12 (body) + 4 (MIC) = 17 bytes.
pub fn parse_join_accept(frame: &[u8]) -> Option<JoinAcceptFields> {
    if frame.len() < 17 {
        return None;
    }
    let body = &frame[1..]; // skip MHDR
    let n = body.len();
    let mic_off = n - 4;

    Some(JoinAcceptFields {
        app_nonce: [body[0], body[1], body[2]],
        net_id: [body[3], body[4], body[5]],
        dev_addr: [body[6], body[7], body[8], body[9]],
        dl_settings: body[10],
        rx_delay: body[11],
        mic: [body[mic_off], body[mic_off + 1], body[mic_off + 2], body[mic_off + 3]],
    })
}

/// Construye la trama de uplink (MHDR + FHDR + FPort + FRMPayload cifrado + MIC).
/// Retorna un Vec con hasta ~30 bytes (14 bytes payload + overhead).
pub fn build_uplink(
    dev_addr: &DevAddr,
    fcnt: u32,
    fport: u8,
    frm_payload_encrypted: &[u8],
    mic: &[u8; 4],
) -> heapless::Vec<u8, 64> {
    let mut frame: heapless::Vec<u8, 64> = heapless::Vec::new();

    // MHDR
    frame.push(MHDR_UNCONFIRMED_DATA_UP).ok();

    // FHDR: DevAddr (LE, 4 bytes) | FCtrl (1) | FCnt (LE u16, 2 bytes) | FOpts (0 bytes)
    frame.extend_from_slice(dev_addr).ok();
    frame.push(0x00).ok(); // FCtrl: sin ADR, sin ACK, sin FPending, FOptsLen=0
    frame.push((fcnt & 0xFF) as u8).ok();
    frame.push(((fcnt >> 8) & 0xFF) as u8).ok();

    // FPort
    frame.push(fport).ok();

    // FRMPayload (ya cifrado)
    frame.extend_from_slice(frm_payload_encrypted).ok();

    // MIC
    frame.extend_from_slice(mic).ok();

    frame
}
