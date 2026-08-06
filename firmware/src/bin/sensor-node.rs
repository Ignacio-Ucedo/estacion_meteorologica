//! Firmware del nodo sensor: LoRaWAN AU915 sub-band 2, OTAA, uplink cada 10 min.
//!
//! El LR1121 corre Modem-E v2.1.0 — el stack LoRaWAN está embebido en el chip.
//! El ESP32 actúa como orquestador: lee sensores y envía comandos al Modem-E por SPI.
//!
//! Prerequisite: Modem-E v2.1.0 flashed en el LR1121 (tarea 1.1).
//!
//! Pines LR1121 (ver hardware/netlist.md):
//!   SCK=18, MISO=19, MOSI=23, NSS=5, RESET=14, BUSY=27, DIO1=26

use esp_idf_hal::{
    delay::FreeRtos,
    gpio::{AnyInputPin, AnyOutputPin, PinDriver},
    peripherals::Peripherals,
    spi::{SpiDeviceDriver, SpiDriver, config::Config as SpiConfig},
};
use log::{error, info, warn};
use lr1121_modem_e::{ModemE, JOIN_TIMEOUT_MS};
use weather_firmware::{
    nvs::load_otaa_keys,
    payload::{build_binary, BinaryMeasurement},
    pulse::PulseCounters,
    sensors::{EnvironmentSensor, UnwiredEnvironmentSensor},
};

const SEND_INTERVAL_MS: u32 = 10 * 60 * 1_000;
const DEVICE_ID: u8 = 1;

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("sensor-node starting — LoRaWAN AU915 sub-band 2 via Modem-E v2.1.0");

    let peripherals = Peripherals::take()?;

    // --- Claves OTAA desde NVS ---
    let keys = load_otaa_keys().map_err(|e| {
        error!("nvs_load_failed={:?}", e);
        e
    })?;
    info!("dev_eui={:02X?}", keys.dev_eui);

    // --- SPI ---
    let spi_driver = SpiDriver::new(
        peripherals.spi2,
        peripherals.pins.gpio18, // SCK
        peripherals.pins.gpio23, // MOSI
        Some(peripherals.pins.gpio19), // MISO
        &esp_idf_hal::spi::SpiDriverConfig::new(),
    )?;
    let spi_device = SpiDeviceDriver::new(
        spi_driver,
        Some(peripherals.pins.gpio5), // NSS (strapping pin — ver R6 en netlist)
        &SpiConfig::new().baudrate(esp_idf_hal::units::Hertz(8_000_000)),
    )?;

    // --- GPIO LR1121 ---
    let busy  = PinDriver::input(unsafe { AnyInputPin::new(27) })?;
    let reset = PinDriver::output(unsafe { AnyOutputPin::new(14) })?;
    let dio1  = PinDriver::input(unsafe { AnyInputPin::new(26) })?;

    // --- Inicializar Modem-E ---
    let mut modem = loop {
        match ModemE::new(spi_device, busy, reset, dio1) {
            Ok(m) => break m,
            Err(e) => {
                error!("modem_e_init_failed={:?} — reintentando en 5s", e);
                FreeRtos::delay_ms(5_000);
                // No podemos re-crear los drivers de peripheral aquí sin move.
                // En práctica: reset hardware y reiniciar el firmware.
                panic!("modem_e_init_failed — reset manual requerido");
            }
        }
    };

    // --- Configurar región AU915 sub-band 2 y credenciales OTAA ---
    modem.configure_au915_subband2(&keys.dev_eui, &keys.app_eui, &keys.app_key)
        .map_err(|e| anyhow::anyhow!("modem_e_configure_failed: {:?}", e))?;
    info!("modem_e_configured region=AU915 subband=2 fport=2");

    // --- Join OTAA ---
    // Modem-E maneja reintentos internamente; esperar hasta JOIN_TIMEOUT_MS.
    loop {
        info!("lorawan_join_start");
        match modem.join(JOIN_TIMEOUT_MS) {
            Ok(()) => {
                info!("lorawan_join_ok");
                break;
            }
            Err(e) => {
                error!("lorawan_join_failed={:?} — reintentando en 60s", e);
                FreeRtos::delay_ms(60_000);
            }
        }
    }

    // --- Contadores de pulsos ---
    let counters = PulseCounters::new();
    // TODO: conectar ISR gpio32 (lluvia) y gpio33 (viento) — tarea firmware-sensor-drivers

    // --- Sensores de ambiente ---
    let mut sensors = UnwiredEnvironmentSensor;
    // TODO: reemplazar con DHT22 real — tarea firmware-sensor-drivers

    // --- Loop principal ---
    let mut seq: u16 = 0;
    loop {
        seq = seq.wrapping_add(1);

        let (temp_c_x100, hum_x100) = match sensors.read_environment() {
            Ok(r) => {
                let t = (r.temp_c * 100.0) as i16;
                let h = (r.humidity_rh * 100.0).clamp(0.0, 10000.0) as u16;
                info!("sensor_ok temp_c={:.2} hum_rh={:.2}", r.temp_c, r.humidity_rh);
                (t, h)
            }
            Err(e) => {
                warn!("sensor_error={:?}", e);
                (i16::MIN, 0)
            }
        };

        let snap = counters.snapshot_and_reset();
        let lluvia = snap.rain_pulses.min(u16::MAX as u32) as u16;
        let viento = snap.wind_pulses.min(u16::MAX as u32) as u16;
        let bateria_mv: u16 = 0; // TODO: ADC GPIO35 — tarea firmware-sensor-drivers

        let m = BinaryMeasurement {
            device_id: DEVICE_ID,
            seq,
            temp_c_x100,
            hum_x100,
            lluvia_pulsos: lluvia,
            viento_pulsos: viento,
            bateria_mv,
        };
        let payload = build_binary(&m);
        info!(
            "payload_built seq={} temp_c={:.2} lluvia={} viento={} crc={:#04x}",
            seq,
            temp_c_x100 as f32 / 100.0,
            lluvia,
            viento,
            payload[13]
        );

        if let Err(e) = modem.request_uplink(&payload) {
            error!("uplink_error={:?} — continuando ciclo de sensores", e);
        } else {
            info!("uplink_ok seq={}", seq);
        }

        FreeRtos::delay_ms(SEND_INTERVAL_MS);
    }
}
