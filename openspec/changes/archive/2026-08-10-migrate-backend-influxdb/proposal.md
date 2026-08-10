## Why

El backend tiene dos aplicaciones FastAPI desconectadas: `app.py` escribe en InfluxDB vía paho-mqtt (MQTT → InfluxDB), pero `app/main.py` lee desde PostgreSQL vía SQLAlchemy. El frontend llama a la REST API de `app/main.py`, que no tiene acceso a los datos de lecturas reales — ve solo una base de datos vacía. Resultado: el ciclo completo gateway-node-mock → ChirpStack → backend → frontend no funciona de extremo a extremo.

Problemas adicionales que se resuelven en este change:
- MQTT con QoS 0: si el backend se reinicia mientras ChirpStack publica un uplink, la lectura se pierde silenciosamente.
- El endpoint `/health` no verifica si el thread MQTT está activo; un crash silencioso del subscriber no es detectable.
- El campo `seq` se escribe en InfluxDB pero nunca se expone en la API, imposibilitando el diagnóstico de gaps en el histórico.

## What Changes

- **Consolidar** `backend/app.py` y `backend/app/main.py` en una sola aplicación FastAPI. El startup MQTT pasa al único `app/main.py`.
- **Reescribir la capa de lectura** (`services/metrics.py`, `services/stations.py`) para usar Flux queries sobre InfluxDB en lugar de SQLAlchemy/PostgreSQL.
- **Stations sin PostgreSQL**: las estaciones se derivan de los tags `dev_eui` en InfluxDB. Los metadatos (nombre, location) se persisten en una measurement separada `station_meta` dentro de InfluxDB al recibir el primer uplink.
- **Eliminar** `app/api/integration_routes.py` (webhook HTTP, ya no aplica), `app/db/` (modelos SQLAlchemy), `alembic/` y la dependencia de PostgreSQL del backend.
- **MQTT QoS 1** + sesión persistente en Mosquitto: garantiza entrega aunque el backend se reinicie.
- **Healthcheck con liveness MQTT**: `/health` verifica que el thread paho-mqtt esté activo y haya recibido un mensaje en los últimos N segundos.
- **Exponer `seq`** en los endpoints de lecturas recientes para diagnóstico de gaps.
- **Limpiar docker-compose**: remover `DATABASE_URL` del servicio backend; agregar env vars de InfluxDB al servicio backend; configurar Mosquitto para sesiones persistentes.
- **Archivar** el change `backend-lorawan-ingestion` (supersedido por este change).

## Capabilities

### Modified Capabilities

- `lorawan-ingestion-bridge`: el mecanismo de ingesta ya era MQTT → InfluxDB (write). Se agrega la capa de lectura Flux + stations derivadas de tags + QoS 1 + healthcheck. El stack queda InfluxDB-only para el backend de datos (sin PostgreSQL).
- `backend-API`: los endpoints `/api/stations/...` y `/api/stations/{id}/metrics/...` pasan a leer desde InfluxDB. Se agrega el campo `seq` a los responses de lecturas.

### Removed Capabilities

- `lorawan-ingestion-bridge` vía HTTP webhook (`POST /integrations/chirpstack/uplink`): eliminado, la ingesta es exclusivamente MQTT.

## Impact

- **Backend** (`backend/`): reescritura significativa de la capa de servicios. Se eliminan SQLAlchemy, Alembic, modelos de base de datos y la ruta HTTP de integración.
- **Infra** (`infra/`): el servicio `backend` en `docker-compose.yml` pierde la dependencia de PostgreSQL para sus propios datos (ChirpStack sigue usando PostgreSQL internamente). Se configura Mosquitto con sesiones persistentes.
- **Frontend** (`frontend/`): sin cambios en la interfaz. Los endpoints son los mismos; los datos ahora son reales.
- **Rollback**: restaurar `app/main.py` anterior, `app/db/`, `alembic/` desde git. Los datos en InfluxDB no se pierden; el historial sobrevive al rollback.
