# Design: validacion-etapa3a-sensores-ambientales

## Context

Esta etapa introduce los primeros sensores físicos. El DHT22 usa un protocolo 1-wire propietario de Aosong; el driver en Rust usa un crate existente del ecosistema esp-rs. El ADC de batería usa el ADC interno del ESP32 (ADC1, para evitar el conflicto ADC2/WiFi del ESP32 clásico) con un divisor de tensión resistivo para escalar la tensión de la batería LiPo (max 4.2 V) al rango del ADC (0–3.3 V).

El payload de 14 bytes no cambia: los campos `temp_c*100` y `hum*100` ahora vienen del DHT22 real (antes del MockEnvironmentSensor), y `bateria_mv` viene del ADC real (antes era constante 3700). Los campos de pulsos (lluvia, viento) siguen en 0 hasta Etapa 3b.

## End-to-End Data Flow

```
DHT22 → GPIO pin (GPIO4, TBD en OQ1) → driver Rust (crate dht-sensor o similar)
                 → temp_c (i16, *100, LE), hum_rh (u16, *100, LE) reales

Batería LiPo → divisor tensión (R1=100kΩ, R2=100kΩ) → ADC1_CH6 (GPIO34, TBD en OQ2)
                 → bateria_mv (u16 LE) real

        ↓
Payload 14 bytes:
  [device_id: u8][seq: u16 LE][temp_c*100: i16 LE][hum*100: u16 LE]
  [lluvia_pulsos: u16 LE = 0][viento_pulsos: u16 LE = 0][bateria_mv: u16 LE][crc8]

        ↓
lr1121-modem-e → RF AU915 sub-band 2 (916.8 MHz SF7BW125)
        ↓
ESP32 gateway (lr1121-transceiver) → UDP Packet Forwarder
        ↓
ChirpStack v4 (Docker) → MQTT
        ↓
FastAPI backend (paho-mqtt) → InfluxDB
  measurement: weather_reading
  tags: device_id=1
  fields: temp_c, humidity_rh, battery_mv, lluvia_pulsos=0, viento_pulsos=0
        ↓
React frontend (dashboard) → visualización de valores reales
```

## Goals / Non-Goals

**Goals:**
- Verificar que el driver DHT22 en Rust lee temperatura y humedad sin errores de checksum.
- Verificar que el ADC de batería da lecturas estables dentro del rango esperado.
- Confirmar que los valores reales llegan a InfluxDB con los tags correctos.
- Comparar lecturas del DHT22 contra un instrumento de referencia para validar la calibración de fábrica.

**Non-Goals:**
- No se integran pluviómetro, anemómetro ni veleta (Etapa 3b).
- No se hace calibración fina del DHT22 (la calibración de fábrica ±0.3 °C es suficiente para esta etapa).
- No se valida el enclosure 3D ni la impermeabilización.
- No se valida el comportamiento en condiciones extremas de temperatura o humedad.

## Decisions

**ADC1 para batería (no ADC2):** En el ESP32 clásico, ADC2 no puede usarse mientras WiFi está activo. El nodo usa WiFi solo indirectamente (a través del Modem-E, que no usa el WiFi del ESP32), pero por precaución y consistencia con el ESP32-S3 del gateway, se usa ADC1.

**Divisor de tensión resistivo:** Solución simple, sin componentes adicionales. Relación de divisor: R1=100 kΩ, R2=100 kΩ → factor 0.5 → tensión máxima en ADC = 4.2 V × 0.5 = 2.1 V (dentro del rango de 3.3 V del ADC). Margen suficiente.

**Pulsos lluvia y viento en 0 durante esta etapa:** Permite usar el mismo firmware `sensor-node` sin modificaciones una vez que los drivers de pulsos estén implementados; los campos simplemente quedarán en 0 hasta que se conecten los sensores en Etapa 3b.

**Error handling — lecturas DHT22 inválidas:** Si el driver reporta error de checksum, el firmware reintenta hasta 3 veces antes de loguear el error y volver a intentar en el siguiente ciclo. No se transmite un uplink con datos inválidos.

**InfluxDB schema (sin cambios respecto a etapas anteriores):**
```
measurement: weather_reading
tags:
  device_id: string  (valor "1" para el nodo sensor)
fields:
  temp_c:         float  (°C, resolución 0.01)
  humidity_rh:    float  (%, resolución 0.01)
  battery_mv:     integer (mV)
  lluvia_pulsos:  integer (pulsos desde último uplink; 0 hasta etapa 3b)
  viento_pulsos:  integer (pulsos desde último uplink; 0 hasta etapa 3b)
timestamp: tiempo de recepción en ChirpStack
```

## Firmware Memory/CPU Impact

- El driver DHT22 agrega ~5 KB de flash y ~200 bytes de RAM (estimado, el protocolo es simple).
- El ADC driver es nativo de esp-idf, sin overhead adicional significativo.
- Sin impacto en el ciclo de 10 minutos.

## Risks / Trade-offs

**[Riesgo] Driver DHT22 da errores de checksum intermitentes** → Mitigación: verificar longitud del cable de datos (máx 5 m recomendado), resistencia pull-up correcta (4.7–10 kΩ), timing del driver. Si persiste, probar con crate alternativo.

**[Riesgo] ADC del ESP32 no lineal en los extremos del rango** → Mitigación: calibrar el ADC con voltajes conocidos o usar la corrección de no-linealidad incluida en esp-idf. Para el propósito de esta etapa (lectura de batería ±50 mV es suficiente), la no-linealidad de fábrica es aceptable.

**[Riesgo] Driver DHT22 no implementado en `firmware-sensor-drivers` cuando se inicia esta etapa** → Bloqueador: prerequisito explícito. Esta etapa no puede comenzar hasta que el driver DHT22 esté implementado y el binario `sensor-node` compile correctamente.

## Open Questions

- **OQ1:** ¿Qué GPIO se usa para el DHT22? El netlist actual no lo especifica. Sugerencia: GPIO4 (disponible, no strapping pin).
- **OQ2:** ¿Qué canal ADC1 se usa para la batería? Sugerencia: ADC1_CH6 (GPIO34 en ESP32 clásico, input-only, ideal para ADC).
