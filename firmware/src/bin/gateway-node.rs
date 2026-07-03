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
use weather_firmware::{
    radio::Sx1278,
    udp_forwarder::{
        build_rxpk_json, build_stat_json, compute_gateway_eui, eui_to_hex, send_pull_data,
        send_push_data,
    },
};

const WIFI_SSID: &str = env!("WIFI_SSID");
const WIFI_PASS: &str = env!("WIFI_PASS");
const CHIRPSTACK_GW_BRIDGE_HOST: &str = env!("CHIRPSTACK_HOST");
const CHIRPSTACK_GW_BRIDGE_PORT: u16 = 1700;

const STAT_INTERVAL_S: u64 = 30;

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("gateway-node starting — single-channel UDP packet forwarder");
    info!("channel=433.175MHz sf=7 bw=125kHz (EU433 canal 0)");
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

    let sock = UdpSocket::bind("0.0.0.0:0")?;
    sock.set_read_timeout(Some(Duration::from_millis(100)))?;

    let target_addr = format!("{}:{}", CHIRPSTACK_GW_BRIDGE_HOST, CHIRPSTACK_GW_BRIDGE_PORT);

    let mut rxnb = 0u32;
    let mut rxok = 0u32;
    let mut rxfw = 0u32;

    let mut last_stat = Instant::now();
    let mut last_pull = Instant::now();
    let mut buf = [0u8; 256];

    let _ = send_pull_data(&sock, &gateway_eui, &target_addr);

    loop {
        if !wifi.is_connected()? {
            warn!("wifi_disconnected — reconectando");
            if let Err(e) = connect_wifi(&mut wifi) {
                error!("wifi_reconnect_failed={:?} — reintentando en 5s", e);
                FreeRtos::delay_ms(5_000);
                continue;
            }
            info!("wifi_reconnected_ok");
        }

        match radio.receive_with_timeout(&mut buf, 200) {
            Ok(Some(n)) => {
                rxnb += 1;
                let raw = &buf[..n];
                let tmst_us = FreeRtos::now_ms().wrapping_mul(1000);

                info!(
                    "lora_rx n={} hex={}",
                    n,
                    raw.iter().map(|b| format!("{:02X}", b)).collect::<String>()
                );

                rxok += 1;

                let json = build_rxpk_json(raw, -100, 7.0, tmst_us);
                let _ = send_push_data(&sock, &gateway_eui, &json, &target_addr);
                rxfw += 1;
                info!("lora_rx_forwarded tmst={}", tmst_us);
            }
            Ok(None) => {}
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
