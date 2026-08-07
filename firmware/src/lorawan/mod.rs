//! Re-exports de las primitivas LoRaWAN radio-agnósticas (crypto/frame/session).
//!
//! Estos módulos viven en weather-core (Rust puro, compilable en host) y se
//! re-exportan acá para que los bins puedan usar
//! `weather_firmware::lorawan::{crypto, frame, session}` sin cambios. El
//! nodo sensor y su mock construyen el frame LoRaWAN dentro del chip LR1121
//! (Modem-E, vía el crate `lr1121-modem-e`); `gateway-node-mock` es el único
//! binario que sigue construyendo frames LoRaWAN en software, y usa estas
//! primitivas directamente.

pub use weather_core::lorawan::crypto;
pub use weather_core::lorawan::frame;
pub use weather_core::lorawan::session;
