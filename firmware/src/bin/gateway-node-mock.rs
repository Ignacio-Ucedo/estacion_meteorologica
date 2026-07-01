//! Gateway sintético para validación de la cadena completa sin SX1278.
//!
//! Conecta via WiFi, realiza OTAA join a través de ChirpStack via el protocolo
//! Semtech UDP Packet Forwarder (sin radio LoRa), genera lecturas meteorológicas
//! simuladas, construye frames LoRaWAN reales (OTAA, 14 bytes, MIC) y los inyecta
//! como RXPK PUSH_DATA directamente en el ChirpStack Gateway Bridge.
//!
//! Cadena validada: ESP32 → WiFi → UDP → ChirpStack → MQTT → Backend → PostgreSQL → Frontend
//!
//! Diferencias respecto a otros binarios:
//!   device_id = 3  (real=1, sensor-node-mock=2, gateway-node-mock=3)
//!   No requiere SX1278 (no hay radio LoRa)
//!   OTAA join via UDP (no via RF)
//!   Lecturas sintéticas (ciclo triangular MockEnvironmentSensor)

use esp_idf_hal::delay::FreeRtos;
use esp_idf_svc::{
    eventloop::EspSystemEventLoop,
    nvs::EspDefaultNvsPartition,
    wifi::{AuthMethod, BlockingWifi, ClientConfiguration, Configuration, EspWifi},
};
use log::{error, info, warn};
use std::{
    net::UdpSocket,
    time::{Duration, Instant},
};
use weather_firmware::{
    lorawan::{crypto, frame, session::LorawanSession},
    nvs,
    payload::{build_binary, BinaryMeasurement},
    sensors::{EnvironmentSensor, MockEnvironmentSensor},
    udp_forwarder::{
        PKT_PULL_RESP, build_rxpk_json, build_stat_json, compute_gateway_eui, eui_to_hex,
        send_pull_data, send_push_data, send_tx_ack,
    },
};

const WIFI_SSID: &str = env!("WIFI_SSID");
const WIFI_PASS: &str = env!("WIFI_PASS");
const CHIRPSTACK_GW_BRIDGE_HOST: &str = env!("CHIRPSTACK_HOST");
const CHIRPSTACK_GW_BRIDGE_PORT: u16 = 1700;
const SEND_INTERVAL_MS: u32 = 10 * 60 * 1_000;

const DEVICE_ID: u8 = 3;
const FPORT_WEATHER: u8 = 2;

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("gateway-node-mock starting — WiFi+UDP synthetic gateway, no SX1278");
    info!("channel=433.175MHz sf=7 bw=125kHz (EU433) device_id={}", DEVICE_ID);

    // Load OTAA keys before WiFi (both call EspDefaultNvsPartition::take internally,
    // which is Arc-based and safe to call multiple times)
    let keys = nvs::load_otaa_keys().map_err(|e| {
        error!("nvs_load_failed={:?} — ejecutar nvs-provision con claves del mock", e);
        e
    })?;
    info!("dev_eui={:02X?}", keys.dev_eui);
    info!("app_eui={:02X?}", keys.app_eui);

    // Restore seq counter from NVS (survives reboots)
    let mut seq: u16 = nvs::load_seq().unwrap_or(0);
    info!("seq_restored={}", seq);

    let peripherals = esp_idf_hal::peripherals::Peripherals::take()?;
    let sysloop = EspSystemEventLoop::take()?;
    let nvs_partition = EspDefaultNvsPartition::take()?;

    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(peripherals.modem, sysloop.clone(), Some(nvs_partition))?,
        sysloop,
    )?;
    connect_wifi(&mut wifi)?;

    let mac = wifi.wifi().sta_netif().get_mac()?;
    let gateway_eui = compute_gateway_eui(&mac);
    info!("gateway_eui={}", eui_to_hex(&gateway_eui));
    info!("→ Registrar este EUI en ChirpStack como Gateway ID");

    let target_addr = format!("{}:{}", CHIRPSTACK_GW_BRIDGE_HOST, CHIRPSTACK_GW_BRIDGE_PORT);
    let sock = UdpSocket::bind("0.0.0.0:0")?;

    // Send PULL_DATA early so ChirpStack GW Bridge records our UDP endpoint.
    // The JoinAccept (and all downlinks) will be delivered as PULL_RESP to this address.
    send_pull_data(&sock, &gateway_eui, &target_addr);

    // Restore session from NVS or perform OTAA join
    let mut session = match nvs::load_lorawan_session() {
        Ok(Some((dev_addr, nwk_skey, app_skey, fcnt_up))) => {
            info!("lorawan_session_restored dev_addr={:02X?} fcnt_up={}", dev_addr, fcnt_up);
            let mut s = LorawanSession::new(dev_addr, nwk_skey, app_skey);
            s.fcnt_up = fcnt_up;
            s
        }
        _ => {
            info!("no_session_in_nvs — starting OTAA join");
            join_via_udp(&sock, &gateway_eui, &keys, &target_addr)?
        }
    };

    let mut sensors = MockEnvironmentSensor::new();
    let mut rxfw = 0u32;
    let mut last_stat = Instant::now();
    let mut last_pull = Instant::now();

    loop {
        // WiFi watchdog
        if !wifi.is_connected()? {
            warn!("wifi_disconnected — reconectando");
            if let Err(e) = connect_wifi(&mut wifi) {
                error!("wifi_reconnect_failed={:?} — reintentando en 5s", e);
                FreeRtos::delay_ms(5_000);
                continue;
            }
            info!("wifi_reconnected_ok");
            send_pull_data(&sock, &gateway_eui, &target_addr);
        }

        // Keepalive
        if last_pull.elapsed() >= Duration::from_secs(10) {
            send_pull_data(&sock, &gateway_eui, &target_addr);
            last_pull = Instant::now();
        }
        if last_stat.elapsed() >= Duration::from_secs(30) {
            let stat_json = build_stat_json(rxfw, rxfw, rxfw);
            send_push_data(&sock, &gateway_eui, &stat_json, &target_addr);
            info!("stat_sent rxfw={}", rxfw);
            last_stat = Instant::now();
        }

        // Generate synthetic reading
        seq = seq.wrapping_add(1);

        let (temp_c_x100, hum_x100) = match sensors.read_environment() {
            Ok(r) => {
                let t = (r.temp_c * 100.0) as i16;
                let h = (r.humidity_rh * 100.0).clamp(0.0, 10_000.0) as u16;
                info!("mock_sensor temp_c={:.2} hum_rh={:.2}", r.temp_c, r.humidity_rh);
                (t, h)
            }
            Err(e) => {
                warn!("sensor_error={:?}", e);
                (2000i16, 6000u16) // 20.0°C, 60.0%
            }
        };

        let lluvia: u16 = if seq % 12 == 0 { 3 } else if seq % 7 == 0 { 1 } else { 0 };
        let viento: u16 = seq % 10;

        let measurement = BinaryMeasurement {
            device_id: DEVICE_ID,
            seq,
            temp_c_x100,
            hum_x100,
            lluvia_pulsos: lluvia,
            viento_pulsos: viento,
            bateria_mv: 3700,
        };
        let payload_bytes = build_binary(&measurement);

        info!(
            "mock_uplink seq={} temp_c={:.2} hum={:.2} lluvia={} viento={} bat_mv=3700",
            seq,
            temp_c_x100 as f32 / 100.0,
            hum_x100 as f32 / 100.0,
            lluvia,
            viento,
        );

        // Build LoRaWAN frame
        let frame = build_lorawan_frame(&mut session, payload_bytes);

        // Inject as synthetic RXPK
        let tmst_us = FreeRtos::now_ms() as u64 * 1000;
        let rxpk_json = build_rxpk_json(&frame, -75, 9.5, tmst_us);
        send_push_data(&sock, &gateway_eui, &rxpk_json, &target_addr);
        rxfw += 1;
        info!("uplink_sent seq={} fcnt={} frame_len={}", seq, session.fcnt_up, frame.len());

        // Persist state so reboots don't replay frame counters
        if let Err(e) = nvs::store_seq(seq) {
            warn!("nvs_seq_store_failed={:?}", e);
        }
        if let Err(e) = nvs::store_lorawan_session(
            &session.dev_addr,
            &session.nwk_skey,
            &session.app_skey,
            session.fcnt_up,
        ) {
            warn!("nvs_session_store_failed={:?}", e);
        }

        FreeRtos::delay_ms(SEND_INTERVAL_MS);
    }
}

/// Construye un frame LoRaWAN UnconfirmedDataUp completo (cifrado + MIC).
fn build_lorawan_frame(session: &mut LorawanSession, mut payload: [u8; 14]) -> Vec<u8> {
    let fcnt = session.next_fcnt();
    crypto::encrypt_frm_payload(&session.app_skey, &session.dev_addr, fcnt, &mut payload);
    let mic = crypto::uplink_mic(&session.nwk_skey, &session.dev_addr, fcnt, &payload);
    let frm = frame::build_uplink(&session.dev_addr, fcnt, FPORT_WEATHER, &payload, &mic);
    frm.to_vec()
}

/// OTAA join via UDP: inyecta el JoinRequest como RXPK y espera el JoinAccept
/// en un PULL_RESP del ChirpStack Gateway Bridge. Sin radio LoRa.
fn join_via_udp(
    sock: &UdpSocket,
    gateway_eui: &[u8; 8],
    keys: &nvs::OtaaKeys,
    target_addr: &str,
) -> anyhow::Result<LorawanSession> {
    use anyhow::Context as _;
    use base64::Engine as _;

    let dev_nonce = (FreeRtos::now_ms() & 0xFFFF) as u16;

    // Wire order for MIC computation is LSB-first; NVS stores MSB-first
    let mut app_eui_le = keys.app_eui;
    app_eui_le.reverse();
    let mut dev_eui_le = keys.dev_eui;
    dev_eui_le.reverse();

    let mic = crypto::join_request_mic(&keys.app_key, &app_eui_le, &dev_eui_le, dev_nonce);
    let join_req = frame::build_join_request(&keys.app_eui, &keys.dev_eui, dev_nonce, &mic);

    let mut retry_delay_ms: u32 = 10_000;

    for attempt in 1u32..=5 {
        // Re-register our UDP endpoint before each attempt
        send_pull_data(sock, gateway_eui, target_addr);
        FreeRtos::delay_ms(200);

        let tmst_us = FreeRtos::now_ms() as u64 * 1000;
        let rxpk_json = build_rxpk_json(&join_req, -75, 9.5, tmst_us);
        send_push_data(sock, gateway_eui, &rxpk_json, target_addr);
        info!("lorawan_join attempt={} dev_nonce={:#06x}", attempt, dev_nonce);

        // Poll for PULL_RESP (JoinAccept) with a 7s window (LoRaWAN RX1+RX2 + margin)
        sock.set_read_timeout(Some(Duration::from_secs(1))).ok();
        let deadline = Instant::now() + Duration::from_secs(7);
        let mut buf = [0u8; 512];

        loop {
            if Instant::now() >= deadline {
                break;
            }
            match sock.recv(&mut buf) {
                Ok(n) if n >= 4 && buf[3] == PKT_PULL_RESP => {
                    let token = [buf[1], buf[2]];
                    let json_bytes = &buf[4..n];

                    #[derive(serde::Deserialize)]
                    struct PullResp {
                        txpk: TxPk,
                    }
                    #[derive(serde::Deserialize)]
                    struct TxPk {
                        data: String,
                    }

                    match serde_json::from_slice::<PullResp>(json_bytes) {
                        Ok(resp) => {
                            match base64::engine::general_purpose::STANDARD
                                .decode(&resp.txpk.data)
                            {
                                Ok(mut raw) if raw.len() >= 17
                                    && raw[0] == frame::MHDR_JOIN_ACCEPT =>
                                {
                                    // Decrypt: everything after MHDR (includes encrypted MIC)
                                    crypto::decrypt_join_accept(&keys.app_key, &mut raw[1..]);

                                    let n = raw.len();
                                    let mic_bytes: [u8; 4] =
                                        raw[n - 4..].try_into().unwrap();

                                    if !crypto::verify_join_accept_mic(
                                        &keys.app_key,
                                        raw[0],
                                        &raw[1..n - 4],
                                        &mic_bytes,
                                    ) {
                                        warn!("join_accept_mic_invalid attempt={}", attempt);
                                    } else if let Some(fields) =
                                        frame::parse_join_accept(&raw)
                                    {
                                        let (nwk_skey, app_skey) = crypto::derive_session_keys(
                                            &keys.app_key,
                                            fields.app_nonce,
                                            fields.net_id,
                                            dev_nonce,
                                        );
                                        let session = LorawanSession::new(
                                            fields.dev_addr,
                                            nwk_skey,
                                            app_skey,
                                        );
                                        send_tx_ack(sock, gateway_eui, &token, target_addr);
                                        info!(
                                            "lorawan_join_ok dev_addr={:02X?} attempt={}",
                                            session.dev_addr, attempt
                                        );
                                        return Ok(session);
                                    }
                                }
                                Ok(raw) => {
                                    warn!(
                                        "pull_resp_not_join_accept mhdr={:#04x} len={}",
                                        raw.first().copied().unwrap_or(0),
                                        raw.len()
                                    );
                                }
                                Err(e) => warn!("join_accept_b64_error={:?}", e),
                            }
                        }
                        Err(e) => warn!("pull_resp_json_error={:?}", e),
                    }
                }
                Ok(_) => {} // PUSH_ACK, PULL_ACK, etc.
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(e) => warn!("udp_recv_error={:?}", e),
            }
        }

        warn!(
            "lorawan_join_timeout attempt={} retrying_in={}ms",
            attempt, retry_delay_ms
        );
        FreeRtos::delay_ms(retry_delay_ms);
        retry_delay_ms = retry_delay_ms.saturating_mul(2).min(300_000);
    }

    anyhow::bail!("lorawan_join_failed after 5 attempts")
}

fn connect_wifi(wifi: &mut BlockingWifi<EspWifi<'static>>) -> anyhow::Result<()> {
    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: WIFI_SSID.try_into().unwrap(),
        password: WIFI_PASS.try_into().unwrap(),
        auth_method: AuthMethod::WPA2Personal,
        ..Default::default()
    }))?;
    wifi.start()?;
    wifi.connect()?;
    wifi.wait_netif_up()?;
    info!("wifi_connected ip={:?}", wifi.wifi().sta_netif().get_ip_info()?.ip);
    Ok(())
}
