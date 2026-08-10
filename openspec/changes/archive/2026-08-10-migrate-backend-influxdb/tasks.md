## 1. Consolidación de apps FastAPI

- [x] 1.1 Mover el startup MQTT de `backend/app.py` a `backend/app/main.py` (registrar en `@app.on_event("startup")` / lifespan). Configurar `client_id="weather-backend"` y `clean_session=False` para sesión persistente.
  Commit: `feat(backend): consolidar subscriber MQTT en app principal FastAPI`
- [x] 1.2 Eliminar `backend/app.py` (root-level). Verificar que el `Dockerfile` apunta a `app.main:app`.
  Commit: `chore(backend): eliminar app.py duplicado (fusionado en app/main.py)`
- [x] 1.3 Eliminar `backend/app/api/integration_routes.py` y su registro en `app/main.py` (webhook HTTP de ChirpStack ya no aplica).
  Commit: `chore(backend): eliminar integration_routes (webhook HTTP supersedido por MQTT)`
- [x] 1.4 Eliminar `backend/app/db/` (modelos SQLAlchemy, session, base), `backend/alembic/` y `backend/alembic.ini`.
  Commit: `chore(backend): eliminar capa SQLAlchemy/PostgreSQL del backend`
- [x] 1.5 Limpiar `backend/requirements.txt`: eliminar `sqlalchemy`, `alembic`, `asyncpg`, `psycopg2-binary`; confirmar que `influxdb-client` y `paho-mqtt` están presentes.
  Commit: `chore(backend): limpiar dependencias — solo influxdb-client y paho-mqtt`

## 2. Capa de lectura InfluxDB

- [x] 2.1 Crear `backend/app/services/influx.py`: cliente InfluxDB singleton (URL, token, org, bucket desde env), función `query(flux: str) -> list[dict]` con manejo de errores.
  Commit: `feat(backend): cliente InfluxDB singleton con helper de queries Flux`
- [x] 2.2 Reescribir `backend/app/services/stations.py`:
  - `list_stations()`: query `schema.tagValues(tag: "dev_eui")` → devuelve lista de station dicts derivados de tags.
  - `get_station(dev_eui)`: last point de `station_meta` para el dev_eui dado + last point de `weather_reading` para status/timestamp.
  - `ensure_station(dev_eui)`: escribe punto en `station_meta` si no existe (idempotente por check previo).
  - `latest_reading(dev_eui)`: last point de `weather_reading` con todos los fields.
  Commit: `feat(backend): reescribir stations service sobre InfluxDB (sin PostgreSQL)`
- [x] 2.3 Reescribir `backend/app/services/metrics.py`:
  - `get_recent_metric(dev_eui, field, minutes)`: range query con filter por field.
  - `hourly_points(dev_eui, field, hours)`: `aggregateWindow(every: 1h, fn: mean)`.
  - `daily_summaries(dev_eui, field, days)`: `aggregateWindow(every: 1d, fn: mean/sum según field)`.
  Commit: `feat(backend): reescribir metrics service con Flux queries sobre InfluxDB`
- [x] 2.4 Exponer `seq` en `ReadingResponse` y en los endpoints de lecturas recientes. Actualizar `backend/app/schemas.py`.
  Commit: `feat(backend): exponer campo seq en API para diagnóstico de gaps`
- [x] 2.5 Actualizar `backend/app/api/routes.py`: reemplazar `SessionDep` (SQLAlchemy) por llamadas directas a los servicios InfluxDB. Eliminar imports de SQLAlchemy.
  Commit: `refactor(backend): actualizar routes para usar servicios InfluxDB`

## 3. Robustez MQTT

- [x] 3.1 Cambiar QoS de 0 a 1 en `client.subscribe()` dentro del startup MQTT. Agregar `reconnect_delay_set(1, 30)`.
  Commit: `feat(backend): MQTT QoS 1 con reconexión automática y sesión persistente`
- [x] 3.2 Registrar `_last_msg_at = datetime.now(UTC)` en `on_message`. Agregar variable global `_mqtt_connected = False` actualizada en `on_connect`/`on_disconnect`.
  Commit: `feat(backend): tracking de liveness MQTT para healthcheck`
- [x] 3.3 Actualizar `GET /health` para retornar estado MQTT: `{"status": "ok"|"degraded", "mqtt": "connected"|"disconnected", "last_msg_ago_s": N}`. Status `"degraded"` si MQTT desconectado o último mensaje hace más de 600s.
  Commit: `feat(backend): healthcheck con liveness de subscriber MQTT`

## 4. Infraestructura

- [x] 4.1 Actualizar `infra/docker-compose.yml` servicio `backend`:
  - Eliminar `DATABASE_URL` del env.
  - Agregar `INFLUXDB_URL`, `INFLUXDB_TOKEN`, `INFLUXDB_ORG`, `INFLUXDB_BUCKET`.
  - Mantener `CHIRPSTACK_MQTT_BROKER`, `CHIRPSTACK_APP_ID`, `SENSOR_K_WIND`, `SENSOR_K_RAIN`.
  - Cambiar `depends_on` a solo `mosquitto` e `influxdb` (remover `postgres`).
  Commit: `chore(infra): actualizar docker-compose backend — InfluxDB en lugar de PostgreSQL`
- [x] 4.2 Actualizar `infra/mosquitto/mosquitto.conf`: agregar `persistence true` y `persistence_location /mosquitto/data/` para soportar sesiones QoS 1.
  Commit: `chore(infra): habilitar persistencia en Mosquitto para QoS 1`

## 5. Archivo

- [x] 5.1 Mover `openspec/changes/backend-lorawan-ingestion/` a `openspec/changes/archive/backend-lorawan-ingestion/`. Agregar nota al inicio de `proposal.md`: "Supersedido por `migrate-backend-influxdb`."
  Commit: `docs: archivar change backend-lorawan-ingestion (supersedido)`
