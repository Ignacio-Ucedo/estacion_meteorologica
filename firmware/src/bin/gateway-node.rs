//! Gateway LoRaWAN single-channel: SX1278 RX continuo → Semtech UDP hacia ChirpStack.
//!
//! Limitación de prototipo documentada: un único canal fijo (433.175 MHz SF7BW125).
//! No es spec-compliant con LoRaWAN EU433 (requeriría 3 canales), pero suficiente
//! para un nodo operando en canal fijo.
//!
//! Protocolo implementado: Semtech UDP Packet Forwarder
//! https://github.com/Lora-net/packet_forwarder/blob/master/PROTOCOL.TXT

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::PinDriver,
    peripherals::Peripherals,
    spi::{SpiDeviceDriver, SpiDriver, config::Config as SpiConfig},
};
use esp_idf_svc::{
    eventloop::EspSystemEventLoop,
    nvs::EspDefaultNvsPartition,
    wifi::{AuthMethod, BlockingWifi, ClientConfiguration, Configuration, EspWifi},
};
use log::{error, info, warn};
use std::net::UdpSocket;
use std::time::{Duration, Instant};
use weather_firmware::radio::Sx1278;

// --- Configuración ---
// Ajustar según el entorno. En producción usar variables de entorno o NVS.
const WIFI_SSID: &str = env!("WIFI_SSID");
const WIFI_PASS: &str = env!("WIFI_PASS");
const CHIRPSTACK_GW_BRIDGE_HOST: &str = env!("CHIRPSTACK_HOST"); // IP o hostname del host Docker
const CHIRPSTACK_GW_BRIDGE_PORT: u16 = 1700;

// GatewayEUI: derivar de MAC WiFi al iniciar (ver `compute_gateway_eui`)
// Para registrar en ChirpStack, este valor se imprime por serial al arrancar.

const STAT_INTERVAL_S: u64 = 30;
const PROTOCOL_VERSION: u8 = 2;

// Identificadores del protocolo Semtech UDP
const PKT_PUSH_DATA: u8 = 0x00;
const PKT_PULL_DATA: u8 = 0x02;

fn compute_gateway_eui(mac: &[u8; 6]) -> [u8; 8] {
    // EUI-48 → EUI-64 insertando FF:FE en el centro
    [mac[0], mac[1], mac[2], 0xFF, 0xFE, mac[3], mac[4], mac[5]]
}

fn eui_to_hex(eui: &[u8; 8]) -> String {
    eui.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(":")
}

fn random_token() -> [u8; 2] {
    // Simple pseudo-random usando tiempo (suficiente para el protocolo UDP)
    let t = FreeRtos::now_ms();
    [(t & 0xFF) as u8, ((t >> 8) & 0xFF) as u8]
}

/// Construye el JSON RXPK para un paquete LoRa recibido.
fn build_rxpk_json(raw: &[u8], rssi: i16, snr: f32, tmst_us: u64) -> String {
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(raw);
    // Tamaño del payload LoRa (sin LoRaWAN overhead — ChirpStack lo separa)
    format!(
        r#"{{"rxpk":[{{"tmst":{tmst},"freq":433.175,"chan":0,"rfch":0,"stat":1,"modu":"LORA","datr":"SF7BW125","codr":"4/5","rssi":{rssi},"lsnr":{snr:.1},"size":{size},"data":"{data}"}}]}}"#,
        tmst = tmst_us,
        rssi = rssi,
        snr = snr,
        size = raw.len(),
        data = data_b64
    )
}

/// Construye el JSON de estadísticas para el heartbeat STAT.
fn build_stat_json(rxnb: u32, rxok: u32, rxfw: u32) -> String {
    // Timestamp RFC 2822 simplificado (ChirpStack lo acepta en cualquier formato)
    format!(
        r#"{{"stat":{{"rxnb":{rxnb},"rxok":{rxok},"rxfw":{rxfw},"ackr":0.0,"dwnb":0,"txnb":0}}}}"#,
        rxnb = rxnb,
        rxok = rxok,
        rxfw = rxfw
    )
}

/// Envía un PUSH_DATA al ChirpStack Gateway Bridge.
fn send_push_data(sock: &UdpSocket, gateway_eui: &[u8; 8], json: &str) {
    let token = random_token();
    let mut pkt = Vec::with_capacity(12 + json.len());
    pkt.push(PROTOCOL_VERSION);
    pkt.extend_from_slice(&token);
    pkt.push(PKT_PUSH_DATA);
    pkt.extend_from_slice(gateway_eui);
    pkt.extend_from_slice(json.as_bytes());

    let addr = format!("{}:{}", CHIRPSTACK_GW_BRIDGE_HOST, CHIRPSTACK_GW_BRIDGE_PORT);
    if let Err(e) = sock.send_to(&pkt, &addr) {
        warn!("udp_send_error={:?}", e);
    }
}

/// Envía PULL_DATA para mantener la conexión viva con ChirpStack.
fn send_pull_data(sock: &UdpSocket, gateway_eui: &[u8; 8]) {
    let token = random_token();
    let mut pkt = [0u8; 12];
    pkt[0] = PROTOCOL_VERSION;
    pkt[1] = token[0];
    pkt[2] = token[1];
    pkt[3] = PKT_PULL_DATA;
    pkt[4..12].copy_from_slice(gateway_eui);

    let addr = format!("{}:{}", CHIRPSTACK_GW_BRIDGE_HOST, CHIRPSTACK_GW_BRIDGE_PORT);
    if let Err(e) = sock.send_to(&pkt, &addr) {
        warn!("pull_data_error={:?}", e);
    }
}

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("gateway-node starting — single-channel UDP packet forwarder");
    info!("channel=433.175MHz sf=7 bw=125kHz (EU433 canal 0)");
    info!("NOTA: single-channel no spec-compliant — solo para prototipo");

    let peripherals = Peripherals::take()?;
    let sysloop = EspSystemEventLoop::take()?;
    let nvs_partition = EspDefaultNvsPartition::take()?;

    // --- WiFi ---
    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(peripherals.modem, sysloop.clone(), Some(nvs_partition))?,
        sysloop,
    )?;

    connect_wifi(&mut wifi)?;

    let mac = wifi.wifi().sta_netif().get_mac()?;
    let gateway_eui = compute_gateway_eui(&mac);
    info!("gateway_eui={}", eui_to_hex(&gateway_eui));
    info!("→ Registrar este EUI en ChirpStack como Gateway ID");

    // --- SX1278 ---
    let spi_driver = SpiDriver::new(
        peripherals.spi2,
        peripherals.pins.gpio18,
        peripherals.pins.gpio23,
        Some(peripherals.pins.gpio19),
        &esp_idf_hal::spi::SpiDriverConfig::new(),
    )?;
    let spi_device = SpiDeviceDriver::new(
        spi_driver,
        Some(peripherals.pins.gpio5),
        &SpiConfig::new().baudrate(esp_idf_hal::units::Hertz(1_000_000)),
    )?;
    let reset = PinDriver::output(peripherals.pins.gpio14)?;
    let mut radio = Sx1278::new(spi_device, reset)?;
    info!("sx1278_init_ok — modo RX continuo");

    // --- UDP socket ---
    let sock = UdpSocket::bind("0.0.0.0:0")?;
    sock.set_read_timeout(Some(Duration::from_millis(100)))?;

    // Contadores de estadísticas
    let mut rxnb = 0u32; // paquetes recibidos (cualquier trama)
    let mut rxok = 0u32; // paquetes con CRC válido
    let mut rxfw = 0u32; // paquetes reenviados a ChirpStack

    let mut last_stat = Instant::now();
    let mut last_pull = Instant::now();
    let mut buf = [0u8; 256];

    // Enviar PULL_DATA inicial
    send_pull_data(&sock, &gateway_eui);

    loop {
        // --- Verificar WiFi y reconectar si es necesario (Task 3.4) ---
        if !wifi.is_connected()? {
            warn!("wifi_disconnected — reconectando");
            if let Err(e) = connect_wifi(&mut wifi) {
                error!("wifi_reconnect_failed={:?} — reintentando en 5s", e);
                FreeRtos::delay_ms(5_000);
                continue;
            }
            info!("wifi_reconnected_ok");
        }

        // --- Intentar recibir paquete LoRa (non-blocking con timeout corto) ---
        match radio.receive_with_timeout(&mut buf, 200) {
            Ok(Some(n)) => {
                rxnb += 1;
                let raw = &buf[..n];
                let tmst_us = FreeRtos::now_ms() as u64 * 1000;

                // Task 3.5: registrar metadata por serial
                info!(
                    "lora_rx n={} hex={}",
                    n,
                    raw.iter().map(|b| format!("{:02X}", b)).collect::<String>()
                );

                rxok += 1;

                // Reenviar a ChirpStack si WiFi disponible (Task 3.2)
                let json = build_rxpk_json(raw, -100, 7.0, tmst_us);
                // RSSI y SNR reales se obtienen de receive_continuous; aquí placeholders
                // para receive_with_timeout (simplificación del prototipo)
                send_push_data(&sock, &gateway_eui, &json);
                rxfw += 1;
                info!("lora_rx_forwarded tmst={}", tmst_us);
            }
            Ok(None) => {} // timeout normal — continuar loop
            Err(e) => error!("lora_rx_error={:?}", e),
        }

        // --- Heartbeat STAT cada 30 s (Task 3.3) ---
        if last_stat.elapsed() >= Duration::from_secs(STAT_INTERVAL_S) {
            let stat_json = build_stat_json(rxnb, rxok, rxfw);
            send_push_data(&sock, &gateway_eui, &stat_json);
            info!("stat_sent rxnb={} rxok={} rxfw={}", rxnb, rxok, rxfw);
            last_stat = Instant::now();
        }

        // --- PULL_DATA cada 10 s para mantener conexión UDP ---
        if last_pull.elapsed() >= Duration::from_secs(10) {
            send_pull_data(&sock, &gateway_eui);
            last_pull = Instant::now();
        }
    }
}

/// Conecta a WiFi con blocking wait.
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
