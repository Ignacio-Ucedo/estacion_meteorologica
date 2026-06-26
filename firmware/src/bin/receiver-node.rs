use esp_idf_hal::delay::FreeRtos;
use log::{info, warn};
use weather_spike_firmware::{
    config::{LORA, PINS},
    payload::parse_csv,
    radio::{LoraRadio, UnwiredLoraRadio},
};

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    info!("receiver-node starting");
    info!("lora_frequency_hz={}", LORA.frequency_hz);
    info!("pin_placeholders={:?}", PINS);

    let mut radio = UnwiredLoraRadio;
    let mut buffer = [0_u8; 128];

    loop {
        match radio.receive(&mut buffer) {
            Ok(Some(payload)) => {
                info!("lora_rx_raw={payload}");
                match parse_csv(payload) {
                    Ok(parsed) => info!(
                        "lora_rx_parsed device_id={} seq={} temp_c={} humidity_rh={} pressure_hpa={} rain_pulses={} wind_pulses={}",
                        parsed.device_id,
                        parsed.seq,
                        parsed.temp_c,
                        parsed.humidity_rh,
                        parsed.pressure_hpa,
                        parsed.rain_pulses,
                        parsed.wind_pulses
                    ),
                    Err(err) => warn!("lora_rx_malformed error={err:?} payload={payload}"),
                }
            }
            Ok(None) => FreeRtos::delay_ms(100),
            Err(err) => {
                warn!("lora_rx_error={err:?}");
                FreeRtos::delay_ms(500);
            }
        }
    }
}
