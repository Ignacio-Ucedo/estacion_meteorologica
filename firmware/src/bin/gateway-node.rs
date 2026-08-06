//! Gateway LoRaWAN single-channel: LR1121 transceiver RX → Semtech UDP → ChirpStack.
//!
//! El LR1121 opera en modo transceiver (firmware de fábrica).
//! Canal fijo: 903.9 MHz SF7BW125 (AU915 sub-band 2, canal 8).
//!
//! Limitación de PoC documentada: single-channel, no spec-compliant con AU915 completo.
//! Protocolo: Semtech UDP Packet Forwarder (sin cambios respecto a la versión SX1278).
//!
//! Pines LR1121 (ver hardware/netlist.md):
//!   SCK=18, MISO=19, MOSI=23, NSS=5, RESET=14, BUSY=27, DIO1=26

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::{AnyInputPin, AnyOutputPin, PinDriver},
    peripherals::Peripherals,
    spi::{SpiDeviceDriver, SpiDriver, config::Config as SpiConfig},
};
use esp_idf_svc::{
    eventloop::EspSystemEventLoop,
    nvs::EspDefaultNvsPartition,
    wifi::{AuthMethod, BlockingWifi, ClientConfiguration, Configuration, EspWifi},
};
use log::{error, info, warn};
use lr1121_transceiver::{AU915_SUBBAND2_FREQ_HZ, Bandwidth, Lr1121Transceiver, SpreadingFactor};
use std::net::UdpSocket;
use std::time::{Duration, Instant};
use weather_firmware::udp_forwarder::{
    build_rxpk_json, build_stat_json, compute_gateway_eui, eui_to_hex, send_pull_data,
    send_push_data,
};

const WIFI_SSID: &str = env!("WIFI_SSID");
const WIFI_PASS: &str = env!("WIFI_PASS");
const CHIRPSTACK_GW_BRIDGE_HOST: &str = env!("CHIRPSTACK_HOST");
const CHIRPSTACK_GW_BRIDGE_PORT: u16 = 1700;

const STAT_INTERVAL_S: u64 = 30;

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("gateway-node starting — AU915 sub-band 2 — LR1121 transceiver");
    info!("channel=903.9MHz sf=SF7 bw=BW125 (AU915 canal 8, PoC single-channel)");
    info!("NOTA: single-channel no spec-compliant — solo para prototipo");

    let peripherals = Peripherals::take()?;
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

    // --- SPI + GPIO LR1121 ---
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
        &SpiConfig::new().baudrate(esp_idf_hal::units::Hertz(8_000_000)),
    )?;

    let busy  = PinDriver::input(unsafe { AnyInputPin::new(27) })?;
    let reset = PinDriver::output(unsafe { AnyOutputPin::new(14) })?;
    let dio1  = PinDriver::input(unsafe { AnyInputPin::new(26) })?;

    // --- Inicializar LR1121 transceiver ---
    let mut radio = Lr1121Transceiver::new(spi_device, busy, reset, dio1)
        .map_err(|e| anyhow::anyhow!("lr1121_transceiver_init_failed: {:?}", e))?;

    radio.set_rx_config(AU915_SUBBAND2_FREQ_HZ, SpreadingFactor::Sf7, Bandwidth::Bw125)
        .map_err(|e| anyhow::anyhow!("lr1121_rx_config_failed: {:?}", e))?;

    radio.start_rx_continuous()
        .map_err(|e| anyhow::anyhow!("lr1121_rx_start_failed: {:?}", e))?;

    info!("lr1121_transceiver_ok — modo RX continuo 903.9 MHz SF7BW125");

    // --- UDP socket ---
    let sock = UdpSocket::bind("0.0.0.0:0")?;
    sock.set_read_timeout(Some(Duration::from_millis(100)))?;
    let target_addr = format!("{}:{}", CHIRPSTACK_GW_BRIDGE_HOST, CHIRPSTACK_GW_BRIDGE_PORT);

    let mut rxnb = 0u32;
    let mut rxok = 0u32;
    let mut rxfw = 0u32;

    let mut last_stat = Instant::now();
    let mut last_pull = Instant::now();

    let _ = send_pull_data(&sock, &gateway_eui, &target_addr);

    loop {
        // Reconexión WiFi
        if !wifi.is_connected()? {
            warn!("wifi_disconnected — reconectando");
            if let Err(e) = connect_wifi(&mut wifi) {
                error!("wifi_reconnect_failed={:?} — reintentando en 5s", e);
                FreeRtos::delay_ms(5_000);
                continue;
            }
            info!("wifi_reconnected_ok");
        }

        // RX de paquete LoRa (bloqueante hasta DIO1)
        match radio.read_packet() {
            Ok(pkt) => {
                rxnb += 1;
                let tmst_us = FreeRtos::now_ms().wrapping_mul(1000);
                info!(
                    "lora_rx n={} rssi={}dBm snr={}dB hex={}",
                    pkt.payload.len(),
                    pkt.rssi_dbm,
                    pkt.snr_db,
                    pkt.payload.iter().map(|b| format!("{:02X}", b)).collect::<String>()
                );
                rxok += 1;
                let json = build_rxpk_json(
                    &pkt.payload,
                    pkt.rssi_dbm,
                    pkt.snr_db as f32,
                    tmst_us,
                );
                if send_push_data(&sock, &gateway_eui, &json, &target_addr).is_ok() {
                    rxfw += 1;
                    info!("lora_rx_forwarded tmst={}", tmst_us);
                } else {
                    warn!("lora_rx_forward_failed — WiFi caído o ChirpStack no disponible");
                }
            }
            Err(e) => error!("lora_rx_error={:?}", e),
        }

        if last_stat.elapsed() >= Duration::from_secs(STAT_INTERVAL_S) {
            let stat_json = build_stat_json(rxnb, rxok, rxfw);
            let _ = send_push_data(&sock, &gateway_eui, &stat_json, &target_addr);
            info!("stat_sent rxnb={} rxok={} rxfw={}", rxnb, rxok, rxfw);
            last_stat = Instant::now();
        }

        if last_pull.elapsed() >= Duration::from_secs(10) {
            let _ = send_pull_data(&sock, &gateway_eui, &target_addr);
            last_pull = Instant::now();
        }
    }
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
