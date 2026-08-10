# Delta spec: lorawan-ingestion-bridge
# Change: migrate-backend-influxdb

## Cambios respecto a la spec principal

### Mecanismo de ingesta: MQTT exclusivo (elimina HTTP webhook)

El backend SHALL suscribirse al topic MQTT de ChirpStack como único mecanismo de ingesta. El endpoint `POST /integrations/chirpstack/uplink` queda eliminado. No se requiere configurar integración HTTP en ChirpStack.

### QoS 1 + sesión persistente

El subscriber MQTT SHALL usar QoS 1 y `clean_session=False` con `client_id` fijo (`"weather-backend"`). Mosquitto SHALL tener persistencia habilitada. Esto garantiza que los uplinks publicados mientras el backend está caído se entreguen al reconectar.

#### Scenario: Backend reinicia durante uplinks

- **GIVEN** el broker Mosquitto tiene persistencia habilitada
- **WHEN** el backend se reinicia mientras ChirpStack publica uplinks
- **THEN** al reconectar, el broker entrega los mensajes acumulados y se escriben en InfluxDB sin pérdida

### Storage: InfluxDB exclusivo (elimina PostgreSQL del backend)

El backend SHALL leer y escribir exclusivamente en InfluxDB. No SHALL existir dependencia de PostgreSQL para los datos del backend (PostgreSQL es usado internamente por ChirpStack, no por el backend).

Las stations SHALL derivarse de los tags `dev_eui` en la measurement `weather_reading`. Los metadatos de station SHALL persistirse en la measurement `station_meta`.

### Health check con liveness MQTT

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

### Campo `seq` en responses de lecturas

Los endpoints de lecturas recientes SHALL incluir el campo `seq` (u16, contador de secuencia del firmware) en cada punto retornado. Permite detectar gaps en el histórico sin consultar InfluxDB directamente.
