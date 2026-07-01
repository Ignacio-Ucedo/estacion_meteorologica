## Why

El pipeline de ingesta LoRaWAN (`backend/app.py`) escribe en InfluxDB pero el REST API (`backend/app/main.py`) lee de PostgreSQL: son dos FastAPIs separados que no comparten store. Los datos del `gateway-mock` nunca llegan al frontend porque el REST API devuelve un Postgres vacío. Este change cierra ese loop unificando los dos backends y definiendo el field mapping entre el payload binario LoRaWAN y el esquema de lectura existente.

## What Changes

- `backend/app/main.py`: incorpora el subscriber MQTT (paho-mqtt) en el startup de FastAPI, persistiendo cada uplink como `Reading` en PostgreSQL con field mapping desde el payload LoRaWAN de 14 bytes.
- `backend/app/services/ingestion.py` (nuevo): módulo de ingesta con las calibration constants (`K_WIND`, `K_RAIN`), el field mapping y la lógica de auto-creación de `Station` por `dev_eui`.
- `backend/app/config.py`: agregar variables `CHIRPSTACK_MQTT_BROKER` y `CHIRPSTACK_APP_ID`.
- `infra/docker-compose.yml`: agregar servicio `backend` (uvicorn) y perfil opcional `mock` para `gateway-mock`.
- `backend/README.md`: documentar variables de entorno y cómo correr el stack completo.
- `backend/app.py`: queda como referencia legacy (no se elimina); el entrypoint principal pasa a ser `app/main.py`.

**Field mapping provisional** (se calibra con hardware real en change posterior):
| Payload LoRaWAN | Campo REST API | Conversión |
|---|---|---|
| `temp_c` | `temperature` | directo |
| `humidity_pct` | `humidity` | directo |
| `wind_pulses` | `wind_speed` | `× K_WIND` (default 0.5 m/s/pulso) |
| `rain_pulses` | `precipitation` | `× K_RAIN` (default 0.2794 mm/pulso) |
| *(no existe)* | `wind_direction` | `"N/A"` fijo |
| `battery_mv` | `battery_level` | `(mv − 3300) / 9.0` → % 0–100 (**requiere `add-battery-level-backend`**) |

## Capabilities

### New Capabilities

- `lorawan-ingestion-bridge`: subscriber MQTT integrado en el backend principal que persiste uplinks LoRaWAN a PostgreSQL con field mapping y auto-provisioning de estaciones.

### Modified Capabilities

- `backend-API`: los endpoints de lecturas y métricas ahora reciben datos reales desde el gateway-mock vía MQTT; se agregan variables de entorno de configuración MQTT. Requiere que `add-battery-level-backend` esté implementado para exponer `battery_level`.

## Impact

- **Backend**: `app/main.py`, `app/config.py`, `app/services/` (nuevo módulo), `app/db/models.py` (sin cambio de schema propio, pero depende del schema de `add-battery-level-backend`).
- **Infra**: `infra/docker-compose.yml` agrega servicio `backend`.
- **Docs**: `backend/README.md`.
- **Dependencia explícita**: `add-battery-level-backend` debe implementarse antes o en paralelo para que `battery_level` se persista correctamente.
- No afecta: firmware, gateway hardware, frontend, android, 3d.
