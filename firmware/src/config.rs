/// Pin mapping reference for the ESP32 DevKitC V1.
/// Confirm against physical wiring before flashing.
/// See firmware/docs/hardware-assumptions.md for notes.
#[derive(Debug, Clone, Copy)]
pub struct PinConfig {
    pub dht22_data: i32,
    pub spi_sck: i32,
    pub spi_miso: i32,
    pub spi_mosi: i32,
    pub lora_nss: i32,
    pub lora_rst: i32,
    pub lora_dio0: i32,
    pub rain_pulse: i32,
    pub wind_pulse: i32,
}

pub const PINS: PinConfig = PinConfig {
    dht22_data: 4,
    spi_sck: 18,
    spi_miso: 19,
    spi_mosi: 23,
    lora_nss: 5,
    lora_rst: 14,
    lora_dio0: 26,
    rain_pulse: 32,
    wind_pulse: 33,
};
