//! Helpers del protocolo Semtech UDP Packet Forwarder v2.
//!
//! Compartido entre `gateway-node` (reenvía paquetes LoRa reales) y
//! `gateway-node-mock` (inyecta frames sintéticos directamente en ChirpStack).

use std::{
    net::UdpSocket,
    sync::atomic::{AtomicU16, Ordering},
};

use base64::Engine as _;
use log::warn;

static TOKEN: AtomicU16 = AtomicU16::new(1);

const PROTOCOL_VERSION: u8 = 2;
const PKT_PUSH_DATA: u8 = 0x00;
const PKT_PULL_DATA: u8 = 0x02;
pub const PKT_PULL_RESP: u8 = 0x03;
pub const PKT_TX_ACK: u8 = 0x05;

/// Deriva el Gateway EUI (EUI-64) a partir de la MAC WiFi (EUI-48).
pub fn compute_gateway_eui(mac: &[u8; 6]) -> [u8; 8] {
    [mac[0], mac[1], mac[2], 0xFF, 0xFE, mac[3], mac[4], mac[5]]
}

pub fn eui_to_hex(eui: &[u8; 8]) -> String {
    eui.iter()
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(":")
}

/// Token de 2 bytes con contador monotónico (evita colisiones entre llamadas consecutivas).
pub fn random_token() -> [u8; 2] {
    let t = TOKEN.fetch_add(1, Ordering::Relaxed);
    [t as u8, (t >> 8) as u8]
}

/// Construye el JSON RXPK para un paquete recibido (o sintetizado).
/// `raw`: bytes del frame LoRaWAN (MHDR…MIC).
pub fn build_rxpk_json(raw: &[u8], rssi: i16, snr: f32, tmst_us: u64) -> String {
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(raw);
    format!(
        r#"{{"rxpk":[{{"tmst":{tmst},"freq":433.175,"chan":0,"rfch":0,"stat":1,"modu":"LORA","datr":"SF7BW125","codr":"4/5","rssi":{rssi},"lsnr":{snr:.1},"size":{size},"data":"{data}"}}]}}"#,
        tmst = tmst_us,
        rssi = rssi,
        snr = snr,
        size = raw.len(),
        data = data_b64,
    )
}

/// Construye el JSON de estadísticas para el heartbeat STAT.
pub fn build_stat_json(rxnb: u32, rxok: u32, rxfw: u32) -> String {
    format!(
        r#"{{"stat":{{"rxnb":{rxnb},"rxok":{rxok},"rxfw":{rxfw},"ackr":0.0,"dwnb":0,"txnb":0}}}}"#,
        rxnb = rxnb,
        rxok = rxok,
        rxfw = rxfw,
    )
}

/// Envía PUSH_DATA (uplink o stat) al ChirpStack Gateway Bridge.
pub fn send_push_data(
    sock: &UdpSocket,
    gateway_eui: &[u8; 8],
    json: &str,
    target_addr: &str,
) {
    let token = random_token();
    let mut pkt = Vec::with_capacity(12 + json.len());
    pkt.push(PROTOCOL_VERSION);
    pkt.extend_from_slice(&token);
    pkt.push(PKT_PUSH_DATA);
    pkt.extend_from_slice(gateway_eui);
    pkt.extend_from_slice(json.as_bytes());
    if let Err(e) = sock.send_to(&pkt, target_addr) {
        warn!("udp_push_error={:?}", e);
    }
}

/// Envía PULL_DATA para mantener la sesión UDP activa con ChirpStack.
pub fn send_pull_data(sock: &UdpSocket, gateway_eui: &[u8; 8], target_addr: &str) {
    let token = random_token();
    let mut pkt = [0u8; 12];
    pkt[0] = PROTOCOL_VERSION;
    pkt[1] = token[0];
    pkt[2] = token[1];
    pkt[3] = PKT_PULL_DATA;
    pkt[4..12].copy_from_slice(gateway_eui);
    if let Err(e) = sock.send_to(&pkt, target_addr) {
        warn!("udp_pull_error={:?}", e);
    }
}

/// Envía TX_ACK al Gateway Bridge en respuesta a un PULL_RESP recibido.
pub fn send_tx_ack(
    sock: &UdpSocket,
    gateway_eui: &[u8; 8],
    token: &[u8; 2],
    target_addr: &str,
) {
    let mut pkt = [0u8; 12];
    pkt[0] = PROTOCOL_VERSION;
    pkt[1] = token[0];
    pkt[2] = token[1];
    pkt[3] = PKT_TX_ACK;
    pkt[4..12].copy_from_slice(gateway_eui);
    if let Err(e) = sock.send_to(&pkt, target_addr) {
        warn!("udp_tx_ack_error={:?}", e);
    }
}
