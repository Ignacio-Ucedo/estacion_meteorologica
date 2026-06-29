//! Firmware del nodo sensor: LoRaWAN EU433, OTAA, uplink cada 10 min.
//!
//! Flujo:
//! 1. Leer claves OTAA (DevEUI, AppEUI, AppKey) desde NVS.
//! 2. Inicializar SX1278 en 433.175 MHz SF7BW125.
//! 3. Join OTAA con ChirpStack (reintenta con backoff si falla).
//! 4. Loop: leer sensores → construir payload binario 14 bytes → transmitir uplink.

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::PinDriver,
    peripherals::Peripherals,
    spi::{SpiDeviceDriver, SpiDriver, config::Config as SpiConfig},
};
use log::{error, info, warn};
use weather_firmware::{
    config::PINS,
    lorawan,
    nvs::load_otaa_keys,
    payload::{build_binary, BinaryMeasurement},
    pulse::PulseCounters,
    radio::Sx1278,
    sensors::{EnvironmentSensor, UnwiredEnvironmentSensor},
};

const SEND_INTERVAL_MS: u32 = 10 * 60 * 1_000; // 10 minutos
const DEVICE_ID: u8 = 1;

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("sensor-node starting — LoRaWAN EU433 433.175 MHz SF7BW125");

    let peripherals = Peripherals::take()?;

    // --- Claves OTAA desde NVS ---
    let keys = load_otaa_keys().map_err(|e| {
        error!("nvs_load_failed={:?} — ejecutar nvs-provision", e);
        e
    })?;
    info!("dev_eui={:02X?}", keys.dev_eui);
    info!("app_eui={:02X?}", keys.app_eui);

    // --- SPI y SX1278 ---
    // Pines: ver firmware/docs/hardware-assumptions.md
    let spi_driver = SpiDriver::new(
        peripherals.spi2,
        peripherals.pins.gpio18, // SCK
        peripherals.pins.gpio23, // MOSI
        Some(peripherals.pins.gpio19), // MISO
        &esp_idf_hal::spi::SpiDriverConfig::new(),
    )?;

    let spi_device = SpiDeviceDriver::new(
        spi_driver,
        Some(peripherals.pins.gpio5), // NSS (CS)
        &SpiConfig::new().baudrate(esp_idf_hal::units::Hertz(1_000_000)),
    )?;

    let reset = PinDriver::output(peripherals.pins.gpio14)?;

    let mut radio = Sx1278::new(spi_device, reset)?;
    info!("sx1278_init_ok freq=433.175MHz sf=7 bw=125kHz");

    // --- Contadores de pulsos (ISR — requiere hardware) ---
    let counters = PulseCounters::new();
    // TODO: conectar ISR de gpio32 (lluvia) y gpio33 (viento) cuando haya hardware

    // --- Sensores de ambiente (requiere hardware DHT22) ---
    let mut sensors = UnwiredEnvironmentSensor;
    // TODO: reemplazar con implementación real de DHT22 + ESP-IDF

    // --- Join OTAA ---
    let mut session = loop {
        match lorawan::otaa_join(&mut radio, &keys.dev_eui, &keys.app_eui, &keys.app_key) {
            Ok(s) => break s,
            Err(e) => {
                error!("otaa_join_failed={:?} retrying in 60s", e);
                FreeRtos::delay_ms(60_000);
            }
        }
    };
    info!("lorawan_session_ok dev_addr={:02X?}", session.dev_addr);

    // --- Loop principal ---
    let mut seq: u16 = 0;
    loop {
        seq = seq.wrapping_add(1);

        // Leer ambiente
        let (temp_c_x100, hum_x100) = match sensors.read_environment() {
            Ok(r) => {
                let t = (r.temp_c * 100.0) as i16;
                let h = (r.humidity_rh * 100.0).clamp(0.0, 10000.0) as u16;
                info!("sensor_ok temp_c={:.2} hum_rh={:.2}", r.temp_c, r.humidity_rh);
                (t, h)
            }
            Err(e) => {
                warn!("sensor_error={:?}", e);
                (i16::MIN, 0) // valor centinela — backend puede detectar y descartar
            }
        };

        // Pulsos acumulados (reset al tomar snapshot)
        let snap = counters.snapshot_and_reset();
        let lluvia = snap.rain_pulses.min(u16::MAX as u32) as u16;
        let viento = snap.wind_pulses.min(u16::MAX as u32) as u16;

        // Batería: placeholder (sin ADC en prototipo)
        let bateria_mv: u16 = 0;

        // Construir payload binario
        let m = BinaryMeasurement { device_id: DEVICE_ID, seq, temp_c_x100, hum_x100, lluvia_pulsos: lluvia, viento_pulsos: viento, bateria_mv };
        let mut payload = build_binary(&m);
        info!("payload_binary seq={} temp_c={:.2} hum={:.2} lluvia_pulsos={} viento_pulsos={} crc={:#04x}",
            seq,
            temp_c_x100 as f32 / 100.0,
            hum_x100 as f32 / 100.0,
            lluvia,
            viento,
            payload[13]
        );

        // Transmitir uplink LoRaWAN (cifra payload in-place)
        if let Err(e) = lorawan::send_uplink(&mut radio, &mut session, &mut payload) {
            // Task 2.6: ante fallo de TX, continuar leyendo sensores (no detener el loop)
            error!("uplink_error={:?} — continuando ciclo de sensores", e);
        }

        FreeRtos::delay_ms(SEND_INTERVAL_MS);
    }
}
