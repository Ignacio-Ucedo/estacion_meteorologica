//! Nodo sensor mock: stack LoRaWAN real (LR1121 Modem-E), datos de sensores simulados.
//!
//! Sustituye lecturas GPIO por datos deterministicos plausibles mientras
//! los sensores físicos (DHT22, pluviómetro, anemómetro) no están soldados.
//! Permite validar el flujo completo nodo → gateway → ChirpStack → backend
//! en banco sin hardware de sensores.
//!
//! Diferencias respecto a sensor-node (real):
//!   - device_id = 2  (nodo real = 1)
//!   - MockEnvironmentSensor (ciclo triangular 15–25 °C, no GPIO)
//!   - Pulsos calculados de seq (no ISR)
//!   - bateria_mv = 3700 constante
//!
//! Requiere: ESP32 + LR1121 (Modem-E v2.1.0), claves OTAA distintas en NVS,
//! dispositivo registrado en ChirpStack (ver infra/SETUP.md).

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
    sensors::{EnvironmentSensor, MockEnvironmentSensor},
};

const SEND_INTERVAL_MS: u32 = 10 * 60 * 1_000;
const DEVICE_ID: u8 = 2;

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("sensor-node-mock starting — datos simulados, LoRaWAN AU915 sub-band 2 via Modem-E v2.1.0");

    let peripherals = Peripherals::take()?;

    let keys = load_otaa_keys().map_err(|e| {
        error!("nvs_load_failed={:?} — ejecutar nvs-provision con claves del mock", e);
        e
    })?;
    info!("dev_eui={:02X?}", keys.dev_eui);
    info!("app_eui={:02X?}", keys.app_eui);

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

    let busy  = PinDriver::input(unsafe { AnyInputPin::new(27) })?;
    let reset = PinDriver::output(unsafe { AnyOutputPin::new(14) })?;
    let dio1  = PinDriver::input(unsafe { AnyInputPin::new(26) })?;

    let mut modem = ModemE::new(spi_device, busy, reset, dio1)
        .map_err(|e| anyhow::anyhow!("modem_e_init_failed: {:?}", e))?;

    modem.configure_au915_subband2(&keys.dev_eui, &keys.app_eui, &keys.app_key)
        .map_err(|e| anyhow::anyhow!("modem_e_configure_failed: {:?}", e))?;
    info!("modem_e_configured region=AU915 subband=2 fport=2");

    let mut sensors = MockEnvironmentSensor::new();

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

    let mut seq: u16 = 0;
    loop {
        seq = seq.wrapping_add(1);

        let (temp_c_x100, hum_x100) = match sensors.read_environment() {
            Ok(r) => {
                let t = (r.temp_c * 100.0) as i16;
                let h = (r.humidity_rh * 100.0).clamp(0.0, 10000.0) as u16;
                info!("mock_sensor temp_c={:.2} hum_rh={:.2}", r.temp_c, r.humidity_rh);
                (t, h)
            }
            Err(e) => {
                warn!("mock_sensor_error={:?}", e);
                (i16::MIN, 0)
            }
        };

        // Pulsos deterministicos basados en seq (sin ISR)
        let lluvia: u16 = if seq % 12 == 0 { 3 } else if seq % 7 == 0 { 1 } else { 0 };
        let viento: u16 = seq % 10;
        let bateria_mv: u16 = 3700;

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
            "mock_uplink seq={} temp_c={:.2} hum={:.2} lluvia_pulsos={} viento_pulsos={} bateria_mv={} crc={:#04x}",
            seq,
            temp_c_x100 as f32 / 100.0,
            hum_x100 as f32 / 100.0,
            lluvia,
            viento,
            bateria_mv,
            payload[13]
        );

        if let Err(e) = modem.request_uplink(&payload) {
            error!("uplink_error={:?} — continuando ciclo mock", e);
        }

        FreeRtos::delay_ms(SEND_INTERVAL_MS);
    }
}
