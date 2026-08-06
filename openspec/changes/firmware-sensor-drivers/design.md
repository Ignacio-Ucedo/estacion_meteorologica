## Context

El nodo sensor ya tiene el stack LoRaWAN completo (OTAA, uplink cada 10 min, payload binario 14 bytes). Lo que falta son los tres subsistemas de adquisición de datos físicos: DHT22 (temperatura y humedad), contadores de pulsos ISR (lluvia y viento) y ADC de batería. El firmware usa `UnwiredEnvironmentSensor` que siempre devuelve error, las ISRs de GPIO32/GPIO33 están comentadas como TODO, y `bateria_mv` está fijo en 0.

Hardware del nodo sensor (PCB con ESP32 DevKitC V1):

| Subsistema       | GPIO | Circuito                                        |
|------------------|------|-------------------------------------------------|
| DHT22 DATA       | 4    | Pull-up R3 10 kΩ a 3.3 V; cable XLR 5p hembra |
| Pluviómetro      | 32   | Pull-up interno ESP32; reed switch contacto seco |
| Anemómetro       | 33   | Pull-up R5 10 kΩ (DNP si push-pull)            |
| ADC batería      | 35   | Divisor R1=100 kΩ / R2=33 kΩ / C4=100 nF      |

Flujo de datos end-to-end (sin cambios respecto a `migrate-lorawan-sx1278`):

```
DHT22 (1-wire, GPIO4)                     → temp_c_x100, hum_x100
Pluviómetro ISR (GPIO32, edge-falling)    → lluvia_pulsos (acumulado)
Anemómetro ISR (GPIO33, edge-falling)     → viento_pulsos (acumulado)
ADC GPIO35 (single-shot, 12-bit, Atten11) → bateria_mv
    ↓
BinaryMeasurement → build_binary() → payload [14 bytes]
    ↓
LoRaWAN uplink (SX1278, 433.175 MHz, SF7BW125)
    ↓
ChirpStack → MQTT → FastAPI → InfluxDB (measurement weather_reading)
    ↓
React frontend (Recharts)
```

## Goals / Non-Goals

**Goals:**
- Driver DHT22 real en GPIO4, implementando el trait `EnvironmentSensor`.
- ISRs GPIO32 y GPIO33 conectadas a `PulseCounters` (ya implementado en `firmware/src/pulse.rs`).
- Lectura ADC GPIO35 mapeada a mV para `bateria_mv`.
- El build sin hardware (`feature = "mock-sensors"`) sigue funcionando con `MockEnvironmentSensor`.

**Non-Goals:**
- Deep sleep / power management.
- Calibración final mm/pulso del pluviómetro ni km/h/pulso del anemómetro.
- Driver de veleta (dirección de viento) — cubierto en el change `veleta-wind-direction`.
- OTA / actualización remota de firmware.
- Cualquier cambio al formato del payload binario (14 bytes, sin alteración).

## Decisions

### D1: Driver DHT22 — `esp-idf-sys` RMT vs. GPIO bit-bang

El DHT22 usa un protocolo 1-wire con timings de decenas de microsegundos. En FreeRTOS las interrupciones pueden introducir jitter que corrompe la lectura si se hace bit-bang desde Rust puro.

**Decisión**: usar el periférico **RMT** (Remote Control Transceiver) del ESP32 vía `esp-idf-hal::rmt`, que captura edges con precisión de 80 ns sin necesidad de deshabilitar interrupciones. Alternativa descartada: crate `dht-hal` de ecosistema `esp-hal` (bare-metal), incompatible con ESP-IDF que usa el firmware actual.

Si RMT resulta problemático en el hardware real, fallback: GPIO con `EspCriticalSection` (deshabilita interrupciones durante la lectura; máx. ~5 ms de latencia).

### D2: ISRs de pulsos — edge-falling con debounce por software

Los contactos reed switch pueden rebotar. El debounce en hardware (condensador) ya está en la PCB (ver netlist). Por seguridad se agrega debounce mínimo por software: ignorar pulsos con separación < 50 ms usando un timestamp atómico en la ISR.

### D3: ADC batería — lectura single-shot con atenuación 11 dB

GPIO35 es input-only y solo soporta ADC1. La atenuación de 11 dB amplía el rango de medición a ~0–3.9 V. Con divisor ratio 0.248:

```
V_bat = V_adc / 0.248
```

El ESP32 ADC tiene no-linealidad notable; aplicar corrección de offset lineal empírica en campo (pendiente de calibración). Por ahora se entrega la lectura cruda × factor.

### D4: Gestión del campo `pressure_hpa`

`EnvironmentReading` tiene `pressure_hpa: f32`. El nodo LoRaWAN definitivo no tiene sensor de presión (el MPL115A2 fue solo del spike). El nuevo `Dht22EnvironmentSensor` devuelve `pressure_hpa: 0.0`; el payload binario no incluye presión, por lo que esto no rompe nada aguas abajo.

No se elimina el campo de la struct en este change para no forzar cambios en `MockEnvironmentSensor` ni en tests existentes.

## Risks / Trade-offs

- **[Risk] Pinout XLR de DHT22 TBD** → Bloquea implementación hasta medir con multímetro los 5 pines del cable (3 activos VCC/GND/DATA, 2 NC). La tarea de firmware está marcada como bloqueada por esta acción de campo.
- **[Risk] Tipo de salida del anemómetro (NPN vs. push-pull) TBD** → Determina si R5 (pull-up 10 kΩ) debe estar poblada o DNP. Bloquea la tarea ISR de viento.
- **[Risk] No-linealidad ADC ESP32** → Las lecturas de batería pueden tener error de ±5–10 %. Mitigación: calibrar offset lineal en campo contra voltímetro de referencia; documentar el factor de corrección en `config.rs`.
- **[Risk] Reboot si DHT22 no responde durante RMT capture** → El driver debe tener timeout explícito y devolver `Err(SensorError::Dht22Unavailable)` para que el loop principal continúe con valor centinela.

## Migration Plan

1. Fusionar este change sobre `main` sin cambiar el payload binario — el gateway y backend no necesitan actualización.
2. Flash en hardware de banco (con DHT22, sin pluviómetro/anemómetro conectados) para validar driver DHT22 vía log serial.
3. Conectar pluviómetro y anemómetro; validar incremento de contadores en log.
4. Medir voltaje de batería con multímetro y comparar con `bateria_mv` reportado para determinar factor de corrección ADC.

**Rollback**: recompilar con feature `mock-sensors` y flashear; no requiere cambio de protocolo ni de infraestructura.

## Open Questions

- **OQ1**: ¿Cuál es el pinout exacto del cable XLR 5p hembra del DHT22? (medir con multímetro) → bloquea D1.
- **OQ2**: ¿La salida del anemómetro es NPN open-collector o push-pull? (medir con multímetro) → determina si R5 está poblada o DNP (bloquea tarea ISR viento).
- **OQ3**: ¿Cuál es el offset de no-linealidad ADC del ESP32 en el rango 0–3.9 V para este PCB específico? (calibración en campo).
