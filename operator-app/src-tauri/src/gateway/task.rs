use std::{
    net::UdpSocket,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use base64::Engine as _;
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

use weather_core::{
    lorawan::{
        crypto,
        frame::{self, MHDR_JOIN_ACCEPT},
        session::LorawanSession,
    },
    payload::{BinaryMeasurement, build_binary},
    sensors::{EnvironmentSensor, MockEnvironmentSensor},
    udp_forwarder::{
        PKT_PULL_RESP, build_rxpk_json, build_stat_json, send_pull_data, send_push_data,
        send_tx_ack,
    },
};

use crate::state::GatewayConfig;

const DEVICE_ID: u8 = 3;
const FPORT_WEATHER: u8 = 2;
const GATEWAY_EUI: [u8; 8] = [0xAA, 0xBB, 0xCC, 0xFF, 0xFE, 0xDD, 0xEE, 0xFF];

fn now_us() -> u32 {
    (SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as u64 & 0xFFFF_FFFF) as u32
}

fn emit_log(app: &AppHandle, level: &str, msg: &str) {
    let now = chrono_local_time();
    let _ = app.emit("gateway_log", serde_json::json!({ "level": level, "msg": msg, "ts": now }));
}

fn chrono_local_time() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let total = secs % 86400;
    format!("{:02}:{:02}:{:02}", total / 3600, (total % 3600) / 60, total % 60)
}

fn parse_hex_bytes(s: &str, len: usize) -> Result<Vec<u8>, String> {
    let clean = s.replace([':', '-', ' '], "");
    if clean.len() != len * 2 {
        return Err(format!("expected {} bytes, got {}", len, clean.len() / 2));
    }
    (0..len)
        .map(|i| u8::from_str_radix(&clean[i * 2..i * 2 + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

pub async fn run_gateway(app: AppHandle, config: GatewayConfig, token: CancellationToken) {
    let result = run_gateway_inner(&app, &config, &token).await;
    if let Err(e) = result {
        emit_log(&app, "ERROR", &format!("gateway_error: {e}"));
    }
    let _ = app.emit("gateway_status", "stopped");
}

async fn run_gateway_inner(
    app: &AppHandle,
    config: &GatewayConfig,
    token: &CancellationToken,
) -> Result<(), String> {
    let dev_eui_bytes = parse_hex_bytes(&config.dev_eui, 8)
        .map_err(|e| format!("dev_eui inválido: {e}"))?;
    let app_eui_bytes = parse_hex_bytes(&config.app_eui, 8)
        .map_err(|e| format!("app_eui inválido: {e}"))?;
    let app_key_bytes = parse_hex_bytes(&config.app_key, 16)
        .map_err(|e| format!("app_key inválido: {e}"))?;

    let dev_eui: [u8; 8] = dev_eui_bytes.try_into().unwrap();
    let app_eui: [u8; 8] = app_eui_bytes.try_into().unwrap();
    let app_key: [u8; 16] = app_key_bytes.try_into().unwrap();

    // Resolve host to determine address family before binding
    use std::net::ToSocketAddrs;
    let target_addr = config.host.to_socket_addrs()
        .map_err(|e| format!("No se pudo resolver '{}': {e}", config.host))?
        .next()
        .ok_or_else(|| format!("No se encontró dirección para '{}'", config.host))?;

    let bind_addr = if target_addr.is_ipv6() { "[::]:0" } else { "0.0.0.0:0" };
    let sock = UdpSocket::bind(bind_addr).map_err(|e| format!("bind UDP: {e}"))?;
    sock.set_read_timeout(Some(Duration::from_secs(1))).ok();

    let host_resolved = target_addr.to_string();

    emit_log(app, "INFO", &format!("PULL_DATA → {}", config.host));
    if let Err(e) = send_pull_data(&sock, &GATEWAY_EUI, &host_resolved) {
        return Err(format!("No se pudo enviar PULL_DATA: {e}"));
    }

    let _ = app.emit("gateway_status", "connecting");

    emit_log(app, "INFO", "Iniciando OTAA join...");
    let mut session = join_otaa(app, &sock, &GATEWAY_EUI, &dev_eui, &app_eui, &app_key, &host_resolved, token).await?;

    let _ = app.emit("gateway_status", "running");
    emit_log(app, "INFO", &format!("Sesión establecida dev_addr={:02X?}", session.dev_addr));

    let mut sensors = MockEnvironmentSensor::new();
    let mut seq: u16 = 0;
    let mut rxfw: u32 = 0;
    let mut last_pull = Instant::now();
    let mut last_stat = Instant::now();
    let interval = Duration::from_secs(config.interval_secs);

    loop {
        if token.is_cancelled() {
            emit_log(app, "INFO", "Gateway detenido");
            return Ok(());
        }

        // Keepalive PULL_DATA cada 30 s
        if last_pull.elapsed() >= Duration::from_secs(30) {
            if let Err(e) = send_pull_data(&sock, &GATEWAY_EUI, &host_resolved) {
                emit_log(app, "WARN", &format!("PULL_DATA falló: {e}"));
            }
            last_pull = Instant::now();
        }

        // Stat cada 60 s
        if last_stat.elapsed() >= Duration::from_secs(60) {
            let stat = build_stat_json(rxfw, rxfw, rxfw);
            if let Err(e) = send_push_data(&sock, &GATEWAY_EUI, &stat, &host_resolved) {
                emit_log(app, "WARN", &format!("STAT falló: {e}"));
            }
            last_stat = Instant::now();
        }

        // Drenar PULL_RESP pendientes (responder con TX_ACK)
        let mut buf = [0u8; 512];
        while let Ok(n) = sock.recv(&mut buf) {
            if n >= 4 && buf[3] == PKT_PULL_RESP {
                let token_bytes = [buf[1], buf[2]];
                let _ = send_tx_ack(&sock, &GATEWAY_EUI, &token_bytes, &host_resolved);
            }
        }

        // Generar lectura sintética
        seq = seq.wrapping_add(1);
        let reading = sensors.read_environment().unwrap_or(weather_core::sensors::EnvironmentReading {
            temp_c: 20.0,
            humidity_rh: 60.0,
            pressure_hpa: 1013.25,
        });

        let lluvia: u16 = if seq % 12 == 0 { 3 } else if seq % 7 == 0 { 1 } else { 0 };
        let viento: u16 = seq % 10;

        let m = BinaryMeasurement {
            device_id: DEVICE_ID,
            seq,
            temp_c_x100: (reading.temp_c * 100.0) as i16,
            hum_x100: (reading.humidity_rh * 100.0).clamp(0.0, 10_000.0) as u16,
            lluvia_pulsos: lluvia,
            viento_pulsos: viento,
            bateria_mv: 4200,
        };
        let mut payload = build_binary(&m);

        let fcnt = session.next_fcnt();
        crypto::encrypt_frm_payload(&session.app_skey, &session.dev_addr, fcnt, &mut payload);
        let mac_payload = frame::build_mac_payload(&session.dev_addr, fcnt, FPORT_WEATHER, &payload);
        let mic = crypto::uplink_mic(&session.nwk_skey, &session.dev_addr, fcnt, &mac_payload);
        let uplink_frame = frame::build_uplink(&session.dev_addr, fcnt, FPORT_WEATHER, &payload, &mic);

        let rxpk = build_rxpk_json(&uplink_frame, 916.8, -80, 7.0, now_us());
        if let Err(e) = send_push_data(&sock, &GATEWAY_EUI, &rxpk, &host_resolved) {
            emit_log(app, "WARN", &format!("uplink UDP falló: {e}"));
        }
        rxfw += 1;

        emit_log(
            app,
            "INFO",
            &format!(
                "Uplink #{seq} temp={:.1}°C hum={:.1}% lluvia={lluvia} viento={viento} fcnt={fcnt}",
                reading.temp_c,
                reading.humidity_rh,
            ),
        );

        // Esperar intervalo respetando cancelación
        let deadline = Instant::now() + interval;
        loop {
            if token.is_cancelled() {
                return Ok(());
            }
            if Instant::now() >= deadline {
                break;
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }
}

async fn join_otaa(
    app: &AppHandle,
    sock: &UdpSocket,
    gateway_eui: &[u8; 8],
    dev_eui: &[u8; 8],
    app_eui: &[u8; 8],
    app_key: &[u8; 16],
    host: &str,
    token: &CancellationToken,
) -> Result<LorawanSession, String> {
    let dev_nonce = (now_us() / 1000 & 0xFFFF) as u16;

    let mut app_eui_le = *app_eui;
    app_eui_le.reverse();
    let mut dev_eui_le = *dev_eui;
    dev_eui_le.reverse();

    let mic = crypto::join_request_mic(app_key, &app_eui_le, &dev_eui_le, dev_nonce);
    let join_req = frame::build_join_request(app_eui, dev_eui, dev_nonce, &mic);

    for attempt in 1u32..=5 {
        if token.is_cancelled() {
            return Err("cancelado durante join".into());
        }

        if let Err(e) = send_pull_data(sock, gateway_eui, host) {
            return Err(format!("PULL_DATA falló (attempt {attempt}): {e}"));
        }
        tokio::time::sleep(Duration::from_millis(200)).await;

        let rxpk = build_rxpk_json(&join_req, 916.8, -75, 9.5, now_us());
        if let Err(e) = send_push_data(sock, gateway_eui, &rxpk, host) {
            return Err(format!("PUSH_DATA JoinRequest falló (attempt {attempt}): {e}"));
        }
        emit_log(app, "INFO", &format!("JoinRequest enviado attempt={attempt} dev_nonce={dev_nonce:#06x}"));

        let deadline = Instant::now() + Duration::from_secs(10);
        let mut buf = [0u8; 512];

        loop {
            if token.is_cancelled() {
                return Err("cancelado durante join".into());
            }
            if Instant::now() >= deadline {
                emit_log(app, "WARN", &format!("JoinAccept timeout attempt={attempt}"));
                break;
            }

            match sock.recv(&mut buf) {
                Ok(n) if n >= 4 && buf[3] == PKT_PULL_RESP => {
                    let token_bytes = [buf[1], buf[2]];
                    let json_bytes = &buf[4..n];

                    #[derive(serde::Deserialize)]
                    struct PullResp { txpk: TxPk }
                    #[derive(serde::Deserialize)]
                    struct TxPk { data: String }

                    if let Ok(resp) = serde_json::from_slice::<PullResp>(json_bytes) {
                        if let Ok(mut raw) = base64::engine::general_purpose::STANDARD.decode(&resp.txpk.data) {
                            if raw.len() >= 17 && raw[0] == MHDR_JOIN_ACCEPT {
                                crypto::decrypt_join_accept(app_key, &mut raw[1..]);
                                let n = raw.len();
                                let mic_bytes: [u8; 4] = raw[n - 4..].try_into().unwrap();

                                if !crypto::verify_join_accept_mic(app_key, raw[0], &raw[1..n - 4], &mic_bytes) {
                                    emit_log(app, "WARN", "JoinAccept MIC inválido");
                                    continue;
                                }
                                if let Some(fields) = frame::parse_join_accept(&raw) {
                                    let (nwk_skey, app_skey) = crypto::derive_session_keys(
                                        app_key, fields.app_nonce, fields.net_id, dev_nonce,
                                    );
                                    let session = LorawanSession::new(fields.dev_addr, nwk_skey, app_skey);
                                    let _ = send_tx_ack(sock, gateway_eui, &token_bytes, host);
                                    emit_log(app, "INFO", &format!("JoinAccept ok dev_addr={:02X?}", session.dev_addr));
                                    return Ok(session);
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        if attempt < 5 {
            let wait = Duration::from_secs(5 * attempt as u64);
            emit_log(app, "WARN", &format!("Reintentando join en {}s...", wait.as_secs()));
            let deadline2 = Instant::now() + wait;
            loop {
                if token.is_cancelled() { return Err("cancelado".into()); }
                if Instant::now() >= deadline2 { break; }
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }
    }

    Err("OTAA join fallido después de 5 intentos. Verificá que el device esté registrado en ChirpStack con el DevEUI/AppKey correctos.".into())
}
