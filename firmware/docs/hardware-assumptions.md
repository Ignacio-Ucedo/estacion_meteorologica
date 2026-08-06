# Hardware Assumptions And Follow-Ups

## Bench Pin Placeholders

These pins are placeholders for the first wiring pass and must be reviewed against the physical ESP32 DevKitC V1 boards before flashing:

| Signal | Placeholder GPIO | Notes |
| --- | ---: | --- |
| DHT22 data | 4 | Requires pull-up, typical 4.7k to 10k. |
| SX1278 SPI SCK | 18 | VSPI-style wiring placeholder. |
| SX1278 SPI MISO | 19 | VSPI-style wiring placeholder. |
| SX1278 SPI MOSI | 23 | VSPI-style wiring placeholder. |
| SX1278 NSS/CS | 5 | Review boot strap constraints before final wiring. |
| SX1278 RST | 14 | Placeholder reset GPIO. |
| SX1278 DIO0 | 26 | RxDone/TxDone interrupt candidate. |
| Rain reed input | 32 | Input-only capable ADC pin, suitable for pulse input with conditioning. |
| Wind pulse input | 33 | Treat as pulse/NPN only after confirming the sensor variant. |

## LoRa Parameters

- Frequency: 433.175 MHz (EU433 canal 0).
- Mode: LoRaWAN EU433, OTAA, band plan 433.175–434.665 MHz.
- Spreading factor: SF7.
- Bandwidth: 125 kHz.
- Coding rate: 4/5.
- Gateway limitation: single-channel fixed to 433.175 MHz SF7BW125 (prototype, not full
  EU433 spec-compliant). See `firmware/README.md`.

## Calibration Placeholders

- Rain: payload uses raw pulse counts for the interval. Final mm-per-tip calibration is deferred.
- Wind: payload uses raw pulse counts for the interval. Final speed conversion is deferred.

## Follow-Ups

- **Anemómetro (TBD):** confirmar variante de salida del anemómetro de cazoletas sin marca
  (conector XLR/aviación 3 pines). Probable Hall open-collector NPN → pull-up a 3.3V en GPIO33.
  Medir con multímetro antes de diseñar el esquemático. Ver `docs/hardware-questions.md`.
- **Pluviómetro:** se comprará un tipping bucket nuevo con reed switch (mm/pulso documentado).
  Será compatible directo con GPIO32. La constante mm/pulso definirá la calibración.
- **DHT22:** confirmado como AM2302 (variante cableada). Implementar driver GPIO en
  `sensor-node` para reemplazar `UnwiredEnvironmentSensor`.
- Connect rain (GPIO 32) and wind (GPIO 33) ISRs to `PulseCounters` in `sensor-node`.
- **Alimentación:** sistema 12V (SLA 5Ah PoC / LiFePO4 4S producto). Buck 12V→3.3V +
  divisor de tensión para ADC de batería (rango real 10000–14600 mV). Ver nota en
  `docs/hardware-questions.md` sobre corrección del rango de `bateria_mv`.
- Add deep sleep, energy budget, and field range validation in later changes.

## Known Prototype Limits

This firmware does not prove autonomy or deployment readiness. It excludes deep sleep,
battery and panel measurement, BLE calibration, final calibration constants, and
field-range validation.
