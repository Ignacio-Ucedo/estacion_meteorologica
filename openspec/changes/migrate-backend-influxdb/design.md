## Context

El backend existente tiene dos apps desacopladas. Este change las funde en una y reemplaza el stack de lectura PostgreSQL/SQLAlchemy por Flux queries sobre InfluxDB.

## Goals / Non-Goals

**Goals:**
- Una sola app FastAPI: arranca el subscriber MQTT en startup, sirve la REST API leyendo de InfluxDB.
- Stations como ciudadanos de primera clase en InfluxDB (sin PostgreSQL para datos del backend).
- QoS 1 + sesión persistente: no perder uplinks ante reinicios del backend.
- Health check observable: `/health` refleja el estado real del subscriber MQTT.
- `seq` visible en la API para diagnóstico de gaps.

**Non-Goals:**
- Autenticación del broker MQTT (Mosquitto en red local sin TLS, suficiente para PoC).
- Retry con backoff en escritura InfluxDB (gap detectable por `seq` incremental).
- Migración de datos históricos de PostgreSQL a InfluxDB (no hay datos reales aún).

## Flujo de datos completo

```
gateway-node-mock (ESP32)
  │  UDP Semtech :1700
  ▼
ChirpStack Gateway Bridge
  │  MQTT: application/{appId}/device/{devEUI}/event/up  QoS 1
  ▼
Mosquitto (sesión persistente, client_id fijo)
  │
  ▼
FastAPI + paho-mqtt (thread daemon, QoS 1, reconnect automático)
  │
  ├─► measurement: weather_reading
  │     tags:   device_id, dev_eui
  │     fields: temp_c, humidity_pct, rain_pulses, wind_pulses, battery_mv, seq
  │     time:   event["time"] de ChirpStack (nanosegundos)
  │
  └─► measurement: station_meta  (solo en primer uplink por dev_eui)
        tags:   dev_eui
        fields: station_id (string), name (string), location (string)
        time:   now()
          ▼
      InfluxDB bucket "weather"
          │
          │  Flux queries
          ▼
      REST API /api/stations/...
          │
          ▼
      React frontend
```

## Decisions

### 1. Una sola app FastAPI

El subscriber MQTT se registra en `@app.on_event("startup")` de `app/main.py`. `backend/app.py` se elimina. El `Dockerfile` ya apunta a `app.main:app`; no cambia.

### 2. Stations en InfluxDB sin PostgreSQL

Al recibir el primer uplink de un `dev_eui` desconocido, se escribe un punto en `station_meta` con `name = "Auto {dev_eui[:8]}"` y `location = "Unknown"`. La lista de stations se obtiene consultando los valores únicos del tag `dev_eui` en `weather_reading`. Idempotente: si ya existe en `station_meta`, no se sobreescribe.

Consideración futura: si se necesita editar nombre/location de una station, se agrega un endpoint `PATCH /api/stations/{id}` que escribe un nuevo punto en `station_meta` (InfluxDB es append-only; la query toma el último punto por dev_eui).

### 3. QoS 1 + sesión persistente en Mosquitto

paho-mqtt v2: `clean_session=False`, `client_id="weather-backend"` fijo. Mosquitto: `persistence true` en `mosquitto.conf`. ChirpStack Gateway Bridge ya publica a QoS 1 por defecto. Con esto, los uplinks publicados mientras el backend está caído se entregan al reconectar.

### 4. MQTT liveness en /health

Se registra el timestamp del último mensaje procesado (`_last_msg_at`). El `/health` verifica:
- `mqtt_client.is_connected()` == True
- `_last_msg_at` fue hace menos de `HEALTH_MQTT_STALE_SECONDS` (default: 600s = 10 min, igual al intervalo de uplinks en producción). En modo mock (uplinks cada 30s), el threshold sigue siendo 600s para no generar falsos positivos.

### 5. Flux queries — ejemplos clave

**Lecturas recientes (últimos N minutos):**
```flux
from(bucket: "weather")
  |> range(start: -60m)
  |> filter(fn: (r) => r._measurement == "weather_reading"
      and r.dev_eui == "{dev_eui}")
  |> filter(fn: (r) => r._field == "temp_c" or r._field == "seq")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
```

**Promedio horario (últimas 24h):**
```flux
from(bucket: "weather")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "weather_reading"
      and r.dev_eui == "{dev_eui}" and r._field == "temp_c")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
```

**Lista de stations (distinct dev_eui):**
```flux
import "influxdata/influxdb/schema"
schema.tagValues(bucket: "weather", tag: "dev_eui")
```

### 6. Eliminaciones

| Archivo/módulo | Motivo |
|---|---|
| `backend/app.py` | Fusionado en `app/main.py` |
| `backend/app/api/integration_routes.py` | Webhook HTTP eliminado |
| `backend/app/db/` | Sin SQLAlchemy ni PostgreSQL |
| `backend/alembic/` | Sin migraciones de schema |
| `DATABASE_URL` en docker-compose backend | Sin PostgreSQL propio |

## Schema InfluxDB

### measurement: `weather_reading`
| Tipo | Nombre | Descripción |
|---|---|---|
| tag | `device_id` | ID numérico del firmware (u8) |
| tag | `dev_eui` | DevEUI LoRaWAN (hex string) |
| field (float) | `temp_c` | Temperatura en °C |
| field (float) | `humidity_pct` | Humedad relativa % |
| field (int) | `rain_pulses` | Pulsos pluviómetro |
| field (int) | `wind_pulses` | Pulsos anemómetro |
| field (int) | `battery_mv` | Tensión batería en mV |
| field (int) | `seq` | Contador de secuencia (diagnóstico de gaps) |

### measurement: `station_meta`
| Tipo | Nombre | Descripción |
|---|---|---|
| tag | `dev_eui` | DevEUI (clave de la station) |
| field (string) | `station_id` | `"dev-{dev_eui[:8]}"` |
| field (string) | `name` | Nombre legible (editable) |
| field (string) | `location` | Ubicación (editable) |

## Manejo de errores

| Escenario | Comportamiento |
|---|---|
| Broker MQTT caído | paho-mqtt reconecta con backoff 1–30s (QoS 1 retiene mensajes en broker) |
| Backend reinicia | Al reconectar con `clean_session=False`, broker entrega mensajes acumulados |
| InfluxDB no disponible | Log error, continuar; gap visible por `seq` en el histórico |
| CRC payload inválido | Log error con hex, no escribir en InfluxDB |
| dev_eui nuevo | Crear `station_meta` automáticamente (idempotente) |

## Migration Plan

1. `docker compose down` en `infra/`
2. Actualizar `infra/docker-compose.yml` (backend env vars, Mosquitto config)
3. `docker compose up -d --build`
4. Verificar `GET /health` → `{"status": "ok", "mqtt": "connected"}`
5. Monitorear logs del backend para confirmar suscripción MQTT y escrituras InfluxDB
