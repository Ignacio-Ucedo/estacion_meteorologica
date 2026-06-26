use core::time::Duration;

#[derive(Debug, Clone, Copy)]
pub struct DeviceConfig {
    pub device_id: &'static str,
    pub send_interval: Duration,
}

#[derive(Debug, Clone, Copy)]
pub struct PinConfig {
    pub dht22_data: i32,
    pub i2c_sda: i32,
    pub i2c_scl: i32,
    pub spi_sck: i32,
    pub spi_miso: i32,
    pub spi_mosi: i32,
    pub lora_nss: i32,
    pub lora_rst: i32,
    pub lora_dio0: i32,
    pub rain_pulse: i32,
    pub wind_pulse: i32,
}

#[derive(Debug, Clone, Copy)]
pub struct LoraConfig {
    pub frequency_hz: u32,
    pub spreading_factor: u8,
    pub bandwidth_hz: u32,
    pub coding_rate_denominator: u8,
    pub preamble_len: u16,
    pub sync_word: u8,
    pub tx_power_dbm: i8,
}

pub const DEVICE: DeviceConfig = DeviceConfig {
    device_id: "wx-spike-001",
    send_interval: Duration::from_secs(5 * 60),
};

pub const PINS: PinConfig = PinConfig {
    dht22_data: 4,
    i2c_sda: 21,
    i2c_scl: 22,
    spi_sck: 18,
    spi_miso: 19,
    spi_mosi: 23,
    lora_nss: 5,
    lora_rst: 14,
    lora_dio0: 26,
    rain_pulse: 32,
    wind_pulse: 33,
};

pub const LORA: LoraConfig = LoraConfig {
    frequency_hz: 433_000_000,
    spreading_factor: 7,
    bandwidth_hz: 125_000,
    coding_rate_denominator: 5,
    preamble_len: 8,
    sync_word: 0x12,
    tx_power_dbm: 10,
};
