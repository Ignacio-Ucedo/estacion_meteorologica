## Why

El payload LoRaWAN actual de 14 bytes no incluye dirección de viento, campo meteorológico esencial para caracterizar el régimen eólico de la estación. La PCB ya tiene el circuito de acondicionamiento (divisor R4/R7 → GPIO34) y el conector XLR 5p macho para la veleta; la ausencia de driver y campo de payload es el único bloqueante para tener esta variable en la visualización.

## What Changes

- **BREAKING** — Formato de payload binario: crece de 14 a **16 bytes**. Se agrega `veleta_dir` (u16 LE, décimas de grado, 0–3599 → 0.0°–359.9°) en bytes 11–12; `bateria_mv` se desplaza a bytes 13–14; el CRC-8/MAXIM pasa a byte 15. Todos los componentes que parsean el payload deben actualizarse simultáneamente.
- **firmware**: nueva lectura ADC en GPIO34 (divisor R4=100 kΩ / R7=33 kΩ / C5=100 nF, ratio 0.248; salida analógica veleta 0–5 V → 0–3.3 V). Actualizar `BinaryMeasurement`, `build_binary()`, `parse_binary()` en `weather-core/src/payload.rs`.
- **backend**: actualizar codec ChirpStack (JavaScript) para parsear 16 bytes; actualizar el ingestion bridge (`/integrations/chirpstack/uplink`) para extraer `wind_direction` como campo real en lugar de `"N/A"`; agregar campo `wind_direction` (float, grados, 0.0–359.9) al modelo `Reading` de PostgreSQL con migración Alembic.
- **frontend**: agregar tarjeta de métrica y/o visualización de rosa de los vientos en el dashboard React para `wind_direction`.
- **docs**: actualizar `openspec/config.yaml` (bloque de arquitectura, descripción del payload), `CLAUDE.md` y `hardware/netlist.md` con el pinout confirmado de la veleta.

La implementación está **bloqueada** hasta confirmar con multímetro: (a) pinout del conector XLR 5p macho de la veleta, y (b) alimentación del sensor (voltaje de salida, rango 0–5 V vs. otra escala). Estas mediciones son prerrequisito de campo antes de escribir el driver ADC.

## Capabilities

### New Capabilities

- `wind-direction-adc`: lectura ADC en GPIO34 con divisor R4/R7, mapeo del voltaje a ángulo de dirección de viento en décimas de grado (0–3599), y campo `veleta_dir` en `BinaryMeasurement`.
- `wind-direction-backend`: extensión del modelo `Reading` de PostgreSQL con campo `wind_direction` (float), migración Alembic, y extracción en el ingestion bridge.
- `wind-direction-frontend`: visualización de dirección de viento en el dashboard React (tarjeta de métrica y/o rosa de los vientos).

### Modified Capabilities

- `lorawan-ingestion-bridge`: el field mapping de payload LoRaWAN a `Reading` cambia para extraer `wind_direction` real (en lugar de constante `"N/A"`) y para parsear el nuevo payload de 16 bytes con `bateria_mv` desplazado a bytes 13–14 y CRC en byte 15. **BREAKING** — el codec y el parser deben actualizarse en la misma ventana de despliegue que el firmware.

## Impact

- **firmware/weather-core**: `payload.rs` (estructura `BinaryMeasurement`, `BINARY_PAYLOAD_LEN`, `build_binary`, `parse_binary`, `verify_binary_crc`); `sensor-node.rs` (nueva lectura ADC GPIO34 antes de construir payload).
- **backend/**: codec ChirpStack JS (16 bytes), ingestion bridge (parser 16 bytes, campo `wind_direction`), modelo `Reading` + migración Alembic.
- **frontend/**: nuevo componente o tarjeta para `wind_direction`.
- **Sin impacto en**: gateway (forward opaco del frame LoRaWAN cifrado), Android (no implementado aún), modelos 3D.
- **Impacto energético**: la lectura ADC single-shot (GPIO34) antes de cada uplink añade < 1 ms de CPU activo cada 10 min; impacto en autonomía despreciable.
- **Impacto en comunicación LoRa**: el payload FRMPayload crece de 14 a 16 bytes. Ambos caben en el máximo LoRaWAN DR0/DR5; no cambia la frecuencia de envío ni el canal.
- **Plan de rollback**: si el payload nuevo llega a ChirpStack antes de actualizar el codec/backend, los uplinks serán rechazados con CRC inválido o parseados incorrectamente. Secuencia de despliegue obligatoria: (1) actualizar codec ChirpStack, (2) actualizar backend, (3) flashear firmware con payload de 16 bytes. Rollback: re-flashear firmware con payload de 14 bytes y revertir codec/backend al commit anterior.
