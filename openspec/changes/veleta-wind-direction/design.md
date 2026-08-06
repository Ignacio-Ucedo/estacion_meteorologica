## Context

El payload LoRaWAN actual de 14 bytes ocupa los campos `bateria_mv` en bytes 11–12 y `crc8` en byte 13. Para agregar `veleta_dir` sin mover `viento_pulsos` ni ningún campo anterior, se insertan 2 bytes en la posición 11–12 y se desplazan `bateria_mv` y `crc8` al final.

Hardware de la veleta (PCB nodo sensor):

| Señal        | GPIO | Circuito                                              |
|--------------|------|-------------------------------------------------------|
| Veleta AIN   | 34   | Divisor R4=100 kΩ / R7=33 kΩ / C5=100 nF → ADC1    |
| Alimentación | TBD  | Pinout XLR 5p macho a confirmar con multímetro        |

Salida analógica asumida: 0–5 V → 0–3.3 V con divisor (ratio 0.248). Escala física a validar en campo.

**Nuevo layout del payload binario (16 bytes, little-endian):**

```
Offset  Campo            Tipo     Rango / Notas
 0      device_id        u8       0–255
 1–2    seq              u16 LE   0–65535 (wrapping)
 3–4    temp_c_x100      i16 LE   °C×100 (−4000..+8500)
 5–6    hum_x100         u16 LE   %RH×100 (0–10000)
 7–8    lluvia_pulsos    u16 LE   pulsos acumulados
 9–10   viento_pulsos    u16 LE   pulsos acumulados
11–12   veleta_dir       u16 LE   décimas de grado (0–3599 → 0.0°–359.9°)
13–14   bateria_mv       u16 LE   mV (0–15000)
15      crc8             u8       CRC-8/MAXIM sobre bytes 0–14
```

Flujo de datos end-to-end con el nuevo campo:

```
Veleta analógica 0–5V → divisor R4/R7 → GPIO34 ADC1 (12-bit, atten 11dB)
    → V_raw → veleta_dir [0–3599 décimas de grado]
    ↓
BinaryMeasurement (16 bytes) → build_binary() → FRMPayload LoRaWAN
    ↓
SX1278 → 433.175 MHz → Gateway ESP32 → Semtech UDP → ChirpStack
    ↓
Codec JS ChirpStack (decode 16 bytes) → webhook HTTP POST /integrations/chirpstack/uplink
    ↓
FastAPI ingestion bridge → Reading(wind_direction=...) → PostgreSQL
    ↓
REST API GET /api/stations/{id}/readings → React frontend (tarjeta wind_direction)
```

## Goals / Non-Goals

**Goals:**
- Extensión del payload de 14 → 16 bytes con `veleta_dir` en posición 11–12.
- Driver ADC en GPIO34: lectura de voltaje y mapeo a ángulo 0.0°–359.9°.
- Actualización coordinada de codec ChirpStack, ingestion bridge y modelo `Reading`.
- Visualización básica de dirección de viento en el frontend.

**Non-Goals:**
- Calibración de la curva voltaje→ángulo de la veleta específica (queda para validación de campo).
- Rosa de los vientos con historial (componente complejo para una iteración posterior).
- OTA / actualización remota del firmware.
- Cambios en el gateway (reenvía bytes opacos, no afectado).
- Soporte Android (no implementado aún).

## Decisions

### D1: Posición de `veleta_dir` en el payload

Se inserta en bytes 11–12, entre `viento_pulsos` y `bateria_mv`. Alternativa descartada: agregar al final antes del CRC sin mover `bateria_mv` (habría requerido CRC en posición 13 con ambigüedad en parsers que ya asumen byte 13 = CRC). La nueva posición es más semánticamente cohesiva (datos de viento juntos).

### D2: Unidad — décimas de grado (0–3599) en u16

Un campo u16 con décimas de grado permite resolución de 0.1° en todo el círculo (0.0°–359.9°) sin necesidad de float en el payload. Alternativa descartada: ángulo en grados enteros (u8, 0–255) — resolución de ~1.4° insuficiente para veleta analógica.

### D3: Mapeo voltaje → ángulo

La veleta analógica entrega un voltaje proporcional al ángulo. La curva exacta depende del modelo; se asume lineal (0 V → 0°, V_max → 360°) como primera aproximación. La corrección de no-linealidad queda para calibración en campo.

```
ángulo_deg = (V_adc / V_max) × 360.0
veleta_dir  = (ángulo_deg × 10.0) as u16  // décimas de grado, 0–3599
```

`V_max` = voltaje máximo de la veleta medido en campo (≈ 5 V × 0.248 ≈ 1.24 V en el ADC).

### D4: Despliegue coordinado (firmware + codec + backend)

El cambio de formato es breaking. Secuencia obligatoria:
1. Actualizar codec ChirpStack (JavaScript) para 16 bytes.
2. Actualizar e desplegar backend (nuevo campo `wind_direction`, parser 16 bytes).
3. Flashear firmware con nuevo payload.

Invertir el orden causará que uplinks 16-byte sean parseados como 14-byte con CRC incorrecto (rechazados por el backend). El codec antiguo fallará silenciosamente con payload más largo.

## Risks / Trade-offs

- **[Risk] Pinout y alimentación de veleta TBD** → Bloquea implementación del driver ADC. Mitigación: prerrequisito de campo documentado como tarea 1.1 y 1.2; sin estas mediciones no se flashea.
- **[Risk] Curva voltaje→ángulo no lineal** → La primera versión usa mapeo lineal; puede haber error en zonas no lineales. Mitigación: documentar factor de calibración en `config.rs`; la spec permite actualizar `V_max` y offset sin cambiar el protocolo.
- **[Risk] Despliegue no coordinado** → Uplinks con payload nuevo y codec/backend antiguo causan pérdida de datos. Mitigación: usar ventana de mantenimiento corta; el nodo reintenta cada 10 min.
- **[Risk] GPIO34 solo ADC1** → ADC1 no tiene conflicto con WiFi (ADC2 sí lo tiene). Riesgo bajo.

## Migration Plan

1. Actualizar `weather-core/src/payload.rs` (nuevo `BINARY_PAYLOAD_LEN = 16`, struct, builders, parsers).
2. Actualizar codec JS en ChirpStack (UI o archivo de device profile) — sin downtime.
3. Migrar BD PostgreSQL: `alembic upgrade head` (agrega columna `wind_direction FLOAT` nullable → luego NOT NULL con default 0).
4. Desplegar backend actualizado (`docker compose up -d backend`).
5. Flashear firmware nuevo en el nodo sensor.
6. Verificar en ChirpStack que los uplinks llegan y `wind_direction` aparece en `/api/stations/{id}/readings`.

**Rollback**: `git revert` en firmware + re-flash payload 14 bytes; revert codec JS; `alembic downgrade -1` en backend.

## Open Questions

- **OQ1**: ¿Cuál es el pinout exacto del conector XLR 5p macho de la veleta? (VCC, GND, AIN, NC) → bloquea D3.
- **OQ2**: ¿Cuál es el voltaje de alimentación requerido por la veleta y su salida máxima? ¿Confirmar que la salida es 0–5 V analógico? → bloquea D3 y el cálculo de `V_max`.
- **OQ3**: ¿Hay no-linealidad conocida en la curva voltaje→ángulo del modelo de veleta a adquirir? → determina si se necesita LUT o corrección polinomial en el driver.
