# lorawan-ingestion-bridge/spec.md

## Overview

Módulo del backend que recibe uplinks LoRaWAN vía MQTT desde ChirpStack, parsea el payload binario (14 bytes, CRC-8/MAXIM), y escribe series temporales en InfluxDB. Auto-provisiona metadatos de station la primera vez que aparece un `dev_eui` nuevo.

Migrado en `migrate-backend-influxdb` (supersede la integración HTTP webhook).

---

## Requirements

### Requirement: MQTT como único mecanismo de ingesta

El backend SHALL suscribirse al topic MQTT de ChirpStack como único mecanismo de ingesta. No SHALL existir un endpoint HTTP de webhook.

El subscriber MQTT SHALL usar QoS 1 y `clean_session=False` con `client_id` fijo (`"weather-backend"`). Mosquitto SHALL tener persistencia habilitada para garantizar entrega de mensajes acumulados durante reinicios del backend.

#### Scenario: Backend reinicia durante uplinks

- **GIVEN** el broker Mosquitto tiene persistencia habilitada
- **WHEN** el backend se reinicia mientras ChirpStack publica uplinks
- **THEN** al reconectar, el broker entrega los mensajes acumulados y se escriben en InfluxDB sin pérdida

### Requirement: Storage en InfluxDB exclusivo

El backend SHALL leer y escribir exclusivamente en InfluxDB. No SHALL existir dependencia de PostgreSQL para los datos del backend (PostgreSQL es usado internamente por ChirpStack).

Las stations SHALL derivarse de los tags `dev_eui` en la measurement `weather_reading`. Los metadatos de station SHALL persistirse en la measurement `station_meta`.

Por cada uplink válido, el backend SHALL escribir un punto en `weather_reading` con los siguientes fields:

| Campo payload (LoRaWAN) | Field InfluxDB | Conversión |
|---|---|---|
| `temp_c` | `temp_c` | directo (float, °C) |
| `humidity_pct` | `humidity_pct` | directo (float, %RH) |
| `wind_pulses` | `wind_pulses` | directo (int, pulsos crudos) |
| `rain_pulses` | `rain_pulses` | directo (int, pulsos crudos) |
| `battery_mv` | `battery_mv` | directo (int, mV) |
| `seq` | `seq` | directo (int, contador de secuencia) |

Tags: `dev_eui`, `device_id`.

#### Scenario: Uplink válido se escribe en InfluxDB

- **WHEN** ChirpStack publica un uplink MQTT con payload CRC válido
- **THEN** aparece un nuevo punto en `weather_reading` con los fields correctos y el log incluye `influx_write_ok dev_eui=...`

#### Scenario: Payload con CRC inválido es descartado

- **WHEN** llega un uplink con CRC-8/MAXIM inválido
- **THEN** no se escribe en InfluxDB y el log incluye `payload_invalid dev_eui=...`

### Requirement: Auto-provisioning de station_meta

El backend SHALL crear automáticamente un punto en `station_meta` la primera vez que recibe un uplink de un `dev_eui` no registrado:

- `station_id` (tag y field): `"dev-{dev_eui[:8]}"`
- `name` (field): `"Auto {dev_eui[:8]}"`
- `location` (field): `"Unknown"`

La operación SHALL ser idempotente.

#### Scenario: Primer uplink de dev_eui nuevo crea station_meta

- **WHEN** llega el primer uplink de un `dev_eui` que no existe en `station_meta`
- **THEN** se crea un punto en `station_meta` con los valores por defecto y el log incluye `station_created dev_eui=...`

### Requirement: Health check con liveness MQTT

El endpoint `GET /health` SHALL retornar:
```json
{
  "status": "ok" | "degraded",
  "mqtt": "connected" | "disconnected",
  "last_msg_ago_s": N
}
```

SHALL retornar `"degraded"` si el subscriber MQTT está desconectado o el último mensaje fue hace más de 600 segundos.

#### Scenario: Thread MQTT muere silenciosamente

- **WHEN** el thread paho-mqtt se desconecta sin que uvicorn reinicie
- **THEN** `GET /health` retorna `{"status": "degraded", "mqtt": "disconnected"}`

### Requirement: Campo `seq` en responses de lecturas

Los endpoints de lecturas recientes SHALL incluir el campo `seq` (u16, contador de secuencia del firmware) en cada punto retornado. Permite detectar gaps en el histórico sin consultar InfluxDB directamente.
