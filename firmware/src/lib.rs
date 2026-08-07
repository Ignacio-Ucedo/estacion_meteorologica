// Módulos compartidos (Rust puro) — viven en weather-core
pub use weather_core::payload;
pub use weather_core::sensors;
pub use weather_core::udp_forwarder;

// lorawan: re-exporta primitivas LoRaWAN radio-agnósticas de weather-core
pub mod lorawan;

// Módulos específicos del firmware ESP32
pub mod config;
pub mod nvs;
pub mod pulse;
