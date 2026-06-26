# Firmware LoRa Sensor Spike

Rust + ESP-IDF firmware spike for two ESP32 DevKitC V1 boards:

- `sensor-node`: reads the bench sensors, counts rain/wind pulses, builds a debug CSV payload, and transmits it over LoRa P2P.
- `receiver-node`: receives LoRa payloads, logs the raw CSV, and parses the expected fields.

## Local Build

The expected toolchain is the ESP-RS ESP-IDF flow:

```powershell
cargo install espup ldproxy espflash
espup install
cargo build --bin sensor-node
cargo build --bin receiver-node
```

This repository currently records the workspace and source layout. Build verification still requires `cargo`, `rustup`, `espup`, and the ESP-IDF environment to be available on the workstation.

## Flash Targets

```powershell
cargo espflash flash --bin sensor-node --monitor
cargo espflash flash --bin receiver-node --monitor
```

Use USB-powered boards for this spike. Deep sleep, battery measurement, solar charging, WiFi forwarding, BLE calibration, field range validation, and the production binary LoRa payload are intentionally deferred.
