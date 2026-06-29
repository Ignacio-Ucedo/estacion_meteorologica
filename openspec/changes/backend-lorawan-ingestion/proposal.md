## Why

El gateway LoRaWAN (change `migrate-lorawan-sx1278`) entrega tramas al network server ChirpStack, que las publica por MQTT. El backend FastAPI necesita suscribirse a ese canal, deserializar el payload binario de 14 bytes, validar la integridad (CRC-8/MAXIM) y persistir cada lectura válida en InfluxDB para que el frontend y la app Android puedan consultarla. Este change implementa esa capa de ingesta, de responsabilidad exclusiva del equipo de backend.

## What Changes

- Directorio `backend/` existente (REST API implementada en `implement-backend-rest-api`): agregar cliente paho-mqtt y writer de InfluxDB como módulo de ingesta independiente.
- Cliente paho-mqtt en el startup de FastAPI que se suscribe al topic `application/{appId}/device/{devEUI}/event/up` de ChirpStack y reconecta automáticamente ante caídas del broker.
- Deserialización del FRMPayload binario de 14 bytes (base64 → little-endian) y validación CRC-8/MAXIM.
- Escritura en InfluxDB con measurement `weather_reading`, tags `device_id` / `dev_eui` y campos numéricos convertidos a unidades reales.
- Manejo de errores aislado: uplinks con CRC inválido se descartan sin detener el procesamiento; errores de InfluxDB se registran y no burbujean.
- `backend/requirements.txt` con dependencias fijadas.

## Capabilities

### New Capabilities

- `lorawan-backend-integration`: ingesta de uplinks LoRaWAN desde ChirpStack vía MQTT hacia InfluxDB, con validación de payload y manejo de errores.

### Modified Capabilities

_(ninguna — no hay specs principales de backend en `openspec/specs/`)_

## Impact

- **Backend** (`backend/`): agrega módulo de ingesta MQTT + InfluxDB al directorio existente; no modifica los endpoints REST ya implementados ni el esquema PostgreSQL.
- **Infraestructura**: depende del stack ChirpStack + Mosquitto + InfluxDB definido en `infra/docker-compose.yml` (change `migrate-lorawan-sx1278`). No genera cambios en ese docker-compose.
- **Rollback**: eliminar el directorio `backend/` y detener el proceso uvicorn. No hay datos en riesgo (InfluxDB es append-only; un rollback no borra lecturas ya escritas).
