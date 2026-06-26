use esp_idf_hal::delay::FreeRtos;
use log::{error, info, warn};
use weather_spike_firmware::{
    config::{DEVICE, LORA, PINS},
    payload::{build_csv, Measurement},
    pulse::PulseCounters,
    radio::{LoraRadio, UnwiredLoraRadio},
    sensors::{EnvironmentSensor, UnwiredEnvironmentSensor},
};

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("sensor-node starting");
    info!("device_id={}", DEVICE.device_id);
    info!("send_interval_s={}", DEVICE.send_interval.as_secs());
    info!("lora_frequency_hz={}", LORA.frequency_hz);
    info!("pin_placeholders={:?}", PINS);

    let counters = PulseCounters::new();
    let mut sensors = UnwiredEnvironmentSensor;
    let mut radio = UnwiredLoraRadio;
    let mut seq = 0_u32;

    loop {
        seq = seq.wrapping_add(1);

        let reading = match sensors.read_environment() {
            Ok(reading) => {
                info!(
                    "environment temp_c={:.1} humidity_rh={:.1} pressure_hpa={:.1}",
                    reading.temp_c, reading.humidity_rh, reading.pressure_hpa
                );
                Some(reading)
            }
            Err(err) => {
                warn!("environment_read_error={err:?}");
                None
            }
        };

        let pulse_snapshot = counters.snapshot_and_reset();
        let payload = build_csv(
            DEVICE.device_id,
            Measurement {
                seq,
                temp_c: reading.map(|value| value.temp_c),
                humidity_rh: reading.map(|value| value.humidity_rh),
                pressure_hpa: reading.map(|value| value.pressure_hpa),
                rain_pulses: pulse_snapshot.rain_pulses,
                wind_pulses: pulse_snapshot.wind_pulses,
            },
        )?;

        info!("payload_csv={}", payload.as_str());
        if let Err(err) = radio.transmit(payload.as_bytes()) {
            error!("lora_tx_error={err:?}");
        }

        FreeRtos::delay_ms((DEVICE.send_interval.as_millis() as u32).max(1));
    }
}
