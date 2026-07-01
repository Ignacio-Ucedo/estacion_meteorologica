## Context

El proyecto tiene dos FastAPI separados que no comparten store:

- `backend/app.py` — ingesta MQTT → InfluxDB (implementado en `backend-lorawan-ingestion`). Solo expone `/health`.
- `backend/app/main.py` — REST API → PostgreSQL (implementado en `implement-backend-rest-api`). Ningún dato de sensores llega aquí.

El `gateway-mock` publica uplinks LoRaWAN-like a MQTT y los datos terminan en InfluxDB. El frontend llama al REST API y recibe PostgreSQL vacío. El loop nunca cierra.

El `backend-lorawan-ingestion/design.md` declaró explícitamente que la API REST era "Non-Goal — change futuro". Este change es ese futuro.

## Goals / Non-Goals

**Goals:**
- Integrar el subscriber MQTT de `app.py` dentro del startup de `app/main.py` para que ambas responsabilidades corran en un único proceso.
- Persistir cada uplink LoRaWAN válido como `Reading` en PostgreSQL, con field mapping desde el payload binario de 14 bytes.
- Auto-crear una `Station` en PostgreSQL la primera vez que se recibe un uplink de un `dev_eui` desconocido.
- Agregar el servicio `backend` al `docker-compose.yml` para que el stack levante completo con un solo comando.
- Documentar las variables de entorno MQTT en `backend/README.md`.

**Non-Goals:**
- Migrar los endpoints de métricas a leer de InfluxDB (InfluxDB queda como analytics opcional, no bloquea el loop).
- Implementar campo `battery_level` en `Reading` (eso es responsabilidad de `add-battery-level-backend`).
- Calibración real de constantes `K_WIND` / `K_RAIN` con hardware (requiere campo; se usan valores provisionales documentados).
- TLS o autenticación en el broker MQTT (Mosquitto en red local, suficiente para prototipo).

## Decisions

### 1. Unificar los dos backends en un único proceso

**Alternativas consideradas:**
- (A) Dual write: `app.py` escribe en InfluxDB Y PostgreSQL → dos procesos, dos stores, lógica duplicada.
- (B) REST API lee InfluxDB: requiere reescribir todas las queries de métricas → alto costo, bajo beneficio para el prototipo.
- **(C) Unificar: mover MQTT subscriber a `app/main.py`** → un proceso, un store, cero duplicación. El REST API ya funciona; solo hay que alimentarlo.

Se elige C. `backend/app.py` queda como referencia legacy pero no es el entrypoint del stack.

### 2. Módulo `backend/app/services/ingestion.py`

Toda la lógica de ingesta (field mapping, calibración, auto-provisioning de Station) se encapsula en un módulo nuevo para no contaminar `main.py` con lógica de dominio.

### 3. Field mapping con calibration constants configurables por entorno

| Payload LoRaWAN | Campo `Reading` | Conversión |
|---|---|---|
| `temp_c` | `temperature` | directo |
| `humidity_pct` | `humidity` | directo |
| `wind_pulses` | `wind_speed` | `wind_pulses × K_WIND` |
| `rain_pulses` | `precipitation` | `rain_pulses × K_RAIN` |
| *(no existe)* | `wind_direction` | `"N/A"` |
| `battery_mv` | `battery_level` | `(mv − 3300) / 9.0` clamped 0–100 (**solo si `add-battery-level-backend` está implementado**) |

Las constantes `K_WIND` y `K_RAIN` se leen desde variables de entorno con defaults documentados:
- `SENSOR_K_WIND` = 0.5 m/s por pulso (equivale a ~1.8 km/h/pulso, valor conservador para anemómetro de cuchara)
- `SENSOR_K_RAIN` = 0.2794 mm por pulso (resolución típica de pluviómetro de cuchara Davis)

### 4. Auto-provisioning de Station

Cuando llega un uplink de un `dev_eui` que no existe en PostgreSQL:
- Se crea una `Station` con `id = "dev-{dev_eui[:8]}"`, `name = "Auto {dev_eui[:8]}"`, `location = "Unknown"`, `status = "online"`.
- Se registra en log para que el operador pueda renombrarla vía `POST /api/stations` o actualización directa en DB.
- La lógica usa `INSERT ... ON CONFLICT DO NOTHING` (o check-then-insert con lock optimista) para evitar duplicados ante concurrencia.

### 5. Thread daemon para paho-mqtt (igual que app.py)

FastAPI corre sobre uvicorn (asyncio). paho-mqtt tiene loop bloqueante. Se mantiene la decisión del change `backend-lorawan-ingestion`: thread daemon con `loop_forever()`. No se introduce `aiomqtt` para evitar dependencias nuevas.

### 6. Servicio backend en docker-compose con build context

El `docker-compose.yml` agrega:
```yaml
backend:
  build: ../backend
  depends_on: [mosquitto, postgres]
  environment: [DATABASE_URL, CHIRPSTACK_MQTT_BROKER, CHIRPSTACK_APP_ID, ...]
  ports: ["8000:8000"]
```

El `gateway-mock` se agrega bajo el perfil `mock` (no arranca por defecto):
```yaml
gateway-mock:
  build: ../firmware/gateway-mock
  profiles: [mock]
  environment: [GATEWAY_MOCK_MQTT_BROKER=mosquitto:1883, ...]
```

## Flujo de datos (end-to-end con este change)

```
gateway-mock (Rust nativo / docker --profile mock)
    │  JSON ChirpStack, 14-byte payload base64
    │  topic: application/{appId}/device/{devEUI}/event/up
    ▼
Mosquitto :1883
    ▼
backend/app/main.py  startup handler
    │  paho-mqtt thread daemon
    │  on_message() →
    │    json.loads → base64.decode → payload.parse_and_validate()
    │    PayloadError → log + descartar
    │    ingestion.map_fields() → {temperature, humidity, wind_speed,
    │                               precipitation, wind_direction}
    │    ingestion.ensure_station(session, dev_eui)
    │    session.add(Reading(...))
    │    session.commit()
    ▼
PostgreSQL (tabla readings)
    ▼
GET /api/stations/{id}              → StationDetail + CurrentReading
GET /api/stations/{id}/readings     → historial paginado
GET /api/stations/{id}/metrics/*/hourly|daily → series temporales
    ▼
React frontend
```

## Manejo de errores

| Escenario | Comportamiento |
|---|---|
| Broker MQTT caído | paho-mqtt reconecta automáticamente (backoff 1–30 s) |
| `CHIRPSTACK_APP_ID` no configurado | log warning, MQTT no inicia; REST API sigue funcionando |
| CRC inválido | log error + hex del payload, descartar |
| `dev_eui` nuevo | auto-create Station, log info |
| Error de commit en PostgreSQL | log error, rollback, continuar con el siguiente mensaje |
| `add-battery-level-backend` no implementado | `battery_level` field ignorado en el mapping hasta que esté disponible |

## Risks / Trade-offs

- **Constantes de calibración provisionales**: `K_WIND = 0.5` y `K_RAIN = 0.2794` son estimaciones. Los valores reales dependen del hardware específico. Mitigación: documentar como provisionales, exponer como vars de entorno para ajuste sin redeployear.
- **`wind_direction = "N/A"` fijo**: el payload actual no incluye sensor de dirección. Mitigación: el campo existe en el schema; cuando se agregue el sensor, solo cambia el mapping.
- **Thread daemon paho-mqtt comparte event loop con SQLAlchemy async**: el thread MQTT usa `asyncio.run()` o una sesión síncrona separada para no bloquear el event loop de FastAPI. Se usa `AsyncSession` con `run_coroutine_threadsafe` o una `Session` síncrona en el thread MQTT. Decisión: usar `Session` síncrona (no async) en el thread MQTT para evitar complejidad de cross-thread asyncio.
- **Auto-provisioning sin validación de origen**: cualquier mensaje MQTT en el topic correcto puede crear una Station. Mitigación: aceptable para prototipo en red local; en producción agregar whitelist de dev_eui.

## Migration Plan

1. Implementar `add-battery-level-backend` (change existente, 0/11 tareas) — opcional pero recomendado antes para tener el campo disponible desde el inicio.
2. Agregar `CHIRPSTACK_MQTT_BROKER` y `CHIRPSTACK_APP_ID` a `backend/app/config.py`.
3. Crear `backend/app/services/ingestion.py` con field mapping y auto-provisioning.
4. Modificar `backend/app/main.py`: agregar startup/shutdown handlers con el subscriber MQTT.
5. Agregar `Dockerfile` en `backend/` si no existe.
6. Actualizar `infra/docker-compose.yml` con servicios `backend` y `gateway-mock`.
7. Documentar en `backend/README.md`.
8. Validación: `docker compose up -d && docker compose --profile mock up gateway-mock -d` → verificar lecturas en `GET /api/stations`.

**Rollback**: detener el backend. No hay cambios de schema propios en este change (los de battery_level son de `add-battery-level-backend`). Las Stations auto-creadas se pueden borrar con `DELETE /api/stations/{id}` una vez implementado ese endpoint, o directamente en PostgreSQL.

## Open Questions

- ¿`Session` síncrona vs `run_coroutine_threadsafe` para las escrituras desde el thread MQTT? Se propone síncrona para simplicidad; confirmar en implementación.
- ¿Dockerfile pre-existente en `backend/`? Verificar en implementación antes de crear uno nuevo.
- ¿Cuándo se implementa `add-battery-level-backend`? Si se implementa en paralelo, el campo `battery_level` puede incluirse desde el primer uplink. Si va después, el campo queda `NULL` hasta que se agregue la columna.
