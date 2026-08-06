## Why

El nodo sensor transmite payload LoRaWAN con todos los campos de sensores hardcodeados o en stub: `UnwiredEnvironmentSensor` siempre devuelve error, las ISRs de GPIO32 (lluvia) y GPIO33 (viento) no están conectadas, y `bateria_mv` está fijo en 0. Sin drivers reales, el sistema completo no puede validarse en campo aunque el stack LoRaWAN ya funcione.

## What Changes

- **Driver DHT22/AM2302** (GPIO4, pull-up R3 10 kΩ): reemplaza `UnwiredEnvironmentSensor` por una implementación real que lee temperatura (°C) y humedad (%RH) usando la interfaz 1-wire del DHT22 vía `esp-idf-hal`. El campo `pressure_hpa` de `EnvironmentReading` queda en desuso para este driver (sin sensor de presión en el nodo LoRaWAN definitivo).
- **ISR pluviómetro** (GPIO32, pull-up interno ESP32): conectar interrupción GPIO a `PulseCounters::record_rain_pulse()`. Sensor de cubeta basculante con contacto reed switch (contacto seco). Factor de calibración mm/pulso a determinar en campo.
- **ISR anemómetro** (GPIO33, pull-up R5 10 kΩ DNP si push-pull): conectar interrupción GPIO a `PulseCounters::record_wind_pulse()`. Tipo de salida (NPN open-collector o push-pull) a confirmar con multímetro antes de implementar.
- **ADC batería** (GPIO35 input-only, divisor R1=100 kΩ / R2=33 kΩ / C4=100 nF, ratio 0.248): reemplaza el placeholder `bateria_mv = 0` por lectura ADC real. Rango objetivo: 10 000–14 600 mV (sistema 12 V SLA/LiFePO4).

El formato binario del payload (14 bytes) no cambia. La frecuencia de uplink (10 min) no cambia. No hay cambios en el stack LoRaWAN ni en el gateway.

## Capabilities

### New Capabilities

- `dht22-driver`: Driver firmware para lectura de temperatura y humedad desde DHT22/AM2302 en GPIO4, implementando el trait `EnvironmentSensor` de `weather-core`.
- `pulse-isr`: Conexión de interrupciones GPIO para conteo de pulsos de pluviómetro (GPIO32) y anemómetro (GPIO33) en el nodo sensor.
- `battery-adc`: Lectura ADC del nivel de batería en GPIO35 con divisor resistivo, mapeado a mV para el campo `bateria_mv` del payload binario.

### Modified Capabilities

- `firmware-lora-sensor-spike`: El campo `pressure_hpa` de `EnvironmentReading` no tiene sensor físico en el nodo LoRaWAN definitivo (el MPL115A2 fue solo del spike); se elimina de la estructura o se fija a 0 en el nuevo driver.

## Impact

- **firmware/**: `src/bin/sensor-node.rs` (conectar ISRs, instanciar driver real, leer ADC); `src/pulse.rs` (registrar handlers de interrupción GPIO).
- **weather-core/**: `src/sensors.rs` (agregar implementación `Dht22EnvironmentSensor` con feature flag `hardware`; posiblemente remover `pressure_hpa` o marcarlo opcional).
- Sin impacto en gateway, backend, frontend, Android ni modelos 3D.
- Impacto energético: mínimo. La lectura DHT22 tarda ~20 ms cada 10 min; las ISRs son edge-triggered y consumen CPU solo en el handler. No se implementa deep sleep en este change.
- Plan de rollback: si el driver DHT22 falla en campo, el firmware puede revertir a `MockEnvironmentSensor` recompilando sin feature `hardware` — sin necesidad de flash OTA (el nodo no tiene OTA aún).
