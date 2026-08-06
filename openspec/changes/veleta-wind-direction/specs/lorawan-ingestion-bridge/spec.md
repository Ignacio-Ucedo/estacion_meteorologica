## MODIFIED Requirements

### Requirement: Field mapping de payload LoRaWAN a Reading de PostgreSQL

Por cada webhook de uplink válido, el backend SHALL parsear el payload binario de **16 bytes** y persistir un `Reading` en PostgreSQL aplicando el siguiente mapping:

| Campo payload (LoRaWAN) | Bytes   | Campo `Reading` (PostgreSQL) | Conversión                                              |
|-------------------------|---------|------------------------------|---------------------------------------------------------|
| `temp_c`                | 3–4     | `temperature`                | directo (float, °C, rango −40 a +85, resolución 0.01)  |
| `humidity_pct`          | 5–6     | `humidity`                   | directo (float, %RH, rango 0–100, resolución 0.01)      |
| `wind_pulses`           | 9–10    | `wind_speed`                 | `wind_pulses × K_WIND` (m/s; K_WIND configurable, default 0.5) |
| `rain_pulses`           | 7–8     | `precipitation`              | `rain_pulses × K_RAIN` (mm; K_RAIN configurable, default 0.2794) |
| `veleta_dir`            | 11–12   | `wind_direction`             | `veleta_dir / 10.0` (grados float, 0.0–359.9; 65535 → `None`) |
| `bateria_mv`            | 13–14   | *(no mapeado a Reading)*     | disponible en log; reservado para futura métrica        |

El `timestamp` del `Reading` SHALL ser el campo `time` del evento ChirpStack (ISO 8601). Si `time` está ausente o inválido, SHALL usarse `datetime.now(UTC)`.

El parser SHALL rechazar payloads con longitud distinta a 16 bytes con `422 Unprocessable Entity`.

#### Scenario: Uplink válido genera Reading en PostgreSQL con wind_direction

- **WHEN** ChirpStack envía un webhook con payload de 16 bytes y CRC-8/MAXIM válido
- **THEN** aparece un nuevo `Reading` en PostgreSQL con `temperature`, `humidity`, `wind_speed`, `precipitation` y `wind_direction` convertidos correctamente, y el log incluye `reading_persisted dev_eui=... seq=...`

#### Scenario: veleta_dir = 0xFFFF (centinela de error) persiste como None

- **WHEN** el payload contiene `veleta_dir = 65535` (centinela de fallo ADC)
- **THEN** el campo `wind_direction` del `Reading` se persiste como `NULL` y el log incluye `wind_direction_sensor_error`

#### Scenario: Constantes configurables via entorno

- **WHEN** el backend inicia con `SENSOR_K_WIND=1.0` y `SENSOR_K_RAIN=0.5` en el entorno
- **THEN** los valores de `wind_speed` y `precipitation` de los uplinks subsiguientes reflejan las nuevas constantes

#### Scenario: Payload de longitud incorrecta es rechazado

- **WHEN** llega un webhook con payload distinto a 16 bytes (ej. 14 bytes del formato anterior)
- **THEN** el endpoint retorna `422 Unprocessable Entity` con log `payload_wrong_length expected=16 got=<n>`
