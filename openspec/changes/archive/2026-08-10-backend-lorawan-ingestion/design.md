## Context

ChirpStack publica cada uplink del nodo sensor en el topic MQTT:
`application/{appId}/device/{devEUI}/event/up`

El campo `data` del payload JSON contiene el FRMPayload descifrado por ChirpStack, codificado en base64. El FRMPayload tiene 14 bytes en little-endian según la spec `lorawan-backend-integration`.

El backend FastAPI es el único consumidor de ese topic. No hay más componentes intermedios entre ChirpStack y InfluxDB.

## Goals / Non-Goals

**Goals:**
- Suscribirse al topic MQTT de ChirpStack con paho-mqtt y reconexión automática.
- Deserializar el FRMPayload de 14 bytes y validar CRC-8/MAXIM.
- Escribir cada lectura válida en InfluxDB con el schema definido.
- Aislar errores de CRC e InfluxDB para que no detengan el procesamiento del siguiente mensaje.

**Non-Goals:**
- API REST para el frontend (change futuro).
- Autenticación del broker MQTT (Mosquitto en red local, sin TLS, suficiente para el prototipo).
- Persistencia de mensajes MQTT perdidos durante downtime (QoS 0 aceptado para el prototipo).
- Retry de escritura en InfluxDB (el gap se detecta por `seq` incremental).

## Decisions

### 1. paho-mqtt en thread daemon sobre integración nativa de asyncio

FastAPI se ejecuta sobre uvicorn (asyncio). paho-mqtt tiene un loop bloqueante (`loop_forever()`). Se elige ejecutarlo en un `threading.Thread(daemon=True)` para desacoplarlo del event loop de asyncio sin introducir dependencias adicionales (`aiomqtt`, `asyncio-mqtt`). La simplicidad del prototipo no justifica complejidad async.

### 2. Reconexión automática vía `reconnect_delay_set`

paho-mqtt v2 soporta reconexión automática con backoff configurable (`min_delay`, `max_delay`). Se usa `min_delay=1, max_delay=30` sin lógica adicional en el callback `on_disconnect`.

### 3. QoS 0 (fire-and-forget)

Para el prototipo, la pérdida ocasional de una lectura de 10 minutos es aceptable. Si se requiere garantía de entrega, cambiar a QoS 1 con sesión persistente en ChirpStack.

### 4. Escritura síncrona en InfluxDB (`SYNCHRONOUS`)

`influxdb-client` en modo `SYNCHRONOUS` bloquea hasta confirmar escritura. En el contexto del thread MQTT (no del event loop de FastAPI) esto es correcto y evita complejidad de batching. Para volúmenes altos se puede migrar a `WriteOptions` con batch asíncrono.

## Flujo de datos (segmento backend)

```
ChirpStack MQTT
  topic: application/{appId}/device/{devEUI}/event/up
        │
        │  JSON: {"deviceInfo": {"devEui": "..."}, "data": "<base64>", "time": "..."}
        ▼
paho-mqtt client (thread daemon en FastAPI startup)
        │
        │  base64.decode(data) → 14 bytes
        ▼
payload.parse_and_validate()
        │  deserializa LE, verifica CRC-8/MAXIM
        │  PayloadError → log + descartar
        ▼
influxdb_client.write_api.write()
        │  measurement=weather_reading
        │  tags: device_id, dev_eui
        │  fields: temp_c, humidity_pct, rain_pulses, wind_pulses, battery_mv, seq
        │  timestamp: event["time"] (ISO 8601) o now() si ausente
        │  Exception → log + continuar
        ▼
InfluxDB bucket "weather"
```

## Schema InfluxDB

- **measurement**: `weather_reading`
- **tags**: `device_id` (str), `dev_eui` (str)
- **fields**: `temp_c` (float), `humidity_pct` (float), `rain_pulses` (int), `wind_pulses` (int), `battery_mv` (int), `seq` (int)
- **timestamp**: nanosegundos (WritePrecision.NANOSECONDS), fuente: campo `time` del evento ChirpStack

## Manejo de errores

| Escenario | Comportamiento |
|-----------|---------------|
| Broker MQTT caído | paho-mqtt reconecta automáticamente (backoff 1–30 s) |
| FastAPI reinicia | El thread MQTT se reinicia en el startup handler |
| `data` ausente en el evento | Log warning, continuar |
| base64 inválido | Log error, continuar |
| CRC-8/MAXIM inválido | Log error con hex del payload, no escribir en InfluxDB |
| InfluxDB no disponible | Log error, continuar procesando el siguiente mensaje |

## Configuración por variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CHIRPSTACK_MQTT_BROKER` | `localhost:1883` | host:port de Mosquitto |
| `CHIRPSTACK_APP_ID` | _(requerido)_ | Application ID de ChirpStack |
| `INFLUXDB_URL` | `http://localhost:8086` | URL de InfluxDB |
| `INFLUXDB_TOKEN` | `weather-station-token` | Token de autenticación |
| `INFLUXDB_ORG` | `weather-station` | Organización InfluxDB |
| `INFLUXDB_BUCKET` | `weather` | Bucket destino |

## Risks / Trade-offs

- **QoS 0**: mensajes perdidos durante downtime del backend no se recuperan. Mitigación: aceptado para prototipo; el campo `seq` permite detectar gaps en el histórico.
- **Thread daemon paho-mqtt**: si el proceso uvicorn muere abruptamente, el thread se termina sin `disconnect()`. Mitigación: el `on_event("shutdown")` llama a `disconnect()` en shutdown limpio.
- **`SYNCHRONOUS` write**: bloquea el thread MQTT durante la escritura. Con un nodo y uplinks cada 10 min, el throughput es insignificante.

## Migration Plan

1. Instalar dependencias: `pip install -r backend/requirements.txt`
2. Configurar variables de entorno (ver tabla).
3. Iniciar backend: `uvicorn app:app --host 0.0.0.0 --port 8000`
4. Verificar con `GET /health` → `{"status": "ok"}`
5. Monitorear logs para confirmar subscripción MQTT y escrituras en InfluxDB.

Rollback: detener el proceso uvicorn. No hay cambios de schema en InfluxDB; los datos ya escritos se conservan.

## Open Questions

- ¿QoS 0 o QoS 1? QoS 1 requiere session persistente en ChirpStack + `clean_session=False` en paho-mqtt. Decidir según tolerancia a pérdida de lecturas.
- ¿Retry con backoff en escritura InfluxDB, o aceptar la pérdida? Para el prototipo, aceptar.
