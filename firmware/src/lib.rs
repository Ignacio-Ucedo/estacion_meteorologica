// Módulos compartidos (Rust puro) — viven en weather-core
pub use weather_core::payload;
pub use weather_core::sensors;
pub use weather_core::udp_forwarder;

// lorawan: re-exporta weather-core + agrega funciones radio-específicas (Sx1278)
pub mod lorawan;

// Módulos específicos del firmware ESP32
pub mod config;
pub mod nvs;
pub mod pulse;
pub mod radio;
