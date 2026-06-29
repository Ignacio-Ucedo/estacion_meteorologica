# Hardware Assumptions And Follow-Ups

## Bench Pin Placeholders

These pins are placeholders for the first wiring pass and must be reviewed against the physical ESP32 DevKitC V1 boards before flashing:

| Signal | Placeholder GPIO | Notes |
| --- | ---: | --- |
| DHT22 data | 4 | Requires pull-up, typical 4.7k to 10k. |
| MPL115A2 SDA | 21 | ESP32 default I2C SDA candidate. |
| MPL115A2 SCL | 22 | ESP32 default I2C SCL candidate. |
| SX1278 SPI SCK | 18 | VSPI-style wiring placeholder. |
| SX1278 SPI MISO | 19 | VSPI-style wiring placeholder. |
| SX1278 SPI MOSI | 23 | VSPI-style wiring placeholder. |
| SX1278 NSS/CS | 5 | Review boot strap constraints before final wiring. |
| SX1278 RST | 14 | Placeholder reset GPIO. |
| SX1278 DIO0 | 26 | RxDone/TxDone interrupt candidate. |
| Rain reed input | 32 | Input-only capable ADC pin, suitable for pulse input with conditioning. |
| Wind pulse input | 33 | Treat as pulse/NPN only after confirming the sensor variant. |

## LoRa Bench Parameters

- Frequency: 433 MHz.
- Mode: LoRa P2P, not LoRaWAN.
- Spreading factor: SF7 placeholder.
- Bandwidth: 125 kHz placeholder.
- Coding rate: 4/5 placeholder.
- Preamble length: 8 placeholder.
- Sync word: private/test value placeholder.
- TX power: keep low for bench testing and confirm local regulatory limits before any field test.

## Calibration Placeholders

- Rain: payload uses raw pulse counts for the interval. Final mm-per-tip calibration is deferred.
- Wind: payload uses raw pulse counts for the interval. Final speed conversion is deferred.

## Follow-Ups

- Confirm the exact RS-FSJT-N01 output variant before designing final hardware. If it is RS485, voltage, or current-loop instead of pulse/NPN, create a separate hardware interface change.
- Define final rain and wind calibration constants, plus the BLE calibration flow from Android.
- Replace the debug CSV payload with a fixed-size binary LoRa payload before production or autonomy work.
- Add deep sleep, energy budget, battery/solar measurement, and field range validation in later changes.

## Known Spike Limits

This spike does not prove autonomy or deployment readiness. It excludes deep sleep, battery and panel measurement, WiFi/backend ingestion, BLE calibration, final calibration constants, binary payloads, and field-range validation.
