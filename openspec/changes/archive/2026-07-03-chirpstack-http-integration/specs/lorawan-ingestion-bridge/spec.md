## MODIFIED Requirements

### Requirement: Webhook HTTP como mecanismo de ingesta de uplinks
El backend FastAPI SHALL exponer el endpoint `POST /integrations/chirpstack/uplink` que recibe eventos de uplink LoRaWAN desde la integración HTTP nativa de ChirpStack. El endpoint SHALL procesar el payload JSON con la misma lógica de parseo, field mapping y auto-provisión de Station que el subscriber MQTT anterior. El backend SHALL arrancar sin necesidad de configurar variables de entorno MQTT; si no llegan webhooks, el REST API SHALL continuar funcionando normalmente.

#### Scenario: Uplink válido recibido por webhook genera Reading en PostgreSQL
- **WHEN** ChirpStack hace `POST /integrations/chirpstack/uplink` con un evento JSON de uplink con payload CRC válido
- **THEN** el backend persiste un `Reading` en PostgreSQL con los campos convertidos correctamente y retorna `200 OK`

#### Scenario: Backend arranca sin configuración MQTT
- **WHEN** el backend inicia sin variables `CHIRPSTACK_MQTT_BROKER` ni `CHIRPSTACK_APP_ID` en el entorno
- **THEN** el backend arranca sin warnings MQTT y el REST API responde normalmente en `/api/health`

#### Scenario: Payload con CRC inválido es descartado
- **WHEN** ChirpStack envía un webhook con payload cuyo CRC-8/MAXIM no coincide
- **THEN** el endpoint retorna `422 Unprocessable Entity`, el log incluye `payload_invalid` con el hex del payload, y no se persiste ningún `Reading`

#### Scenario: Uplink sin campo `data` es ignorado
- **WHEN** el webhook llega sin campo `data` o con `data` vacío
- **THEN** el endpoint retorna `422 Unprocessable Entity` y el log incluye `uplink_no_data`

### Requirement: Field mapping de payload LoRaWAN a Reading de PostgreSQL
Por cada webhook de uplink válido, el backend SHALL parsear el payload binario de 14 bytes y persistir un `Reading` en PostgreSQL aplicando el siguiente mapping:

| Campo payload (LoRaWAN) | Campo `Reading` (PostgreSQL) | Conversión |
|---|---|---|
| `temp_c` | `temperature` | directo (float, °C, rango −40 a +85, resolución 0.01) |
| `humidity_pct` | `humidity` | directo (float, %RH, rango 0–100, resolución 0.01) |
| `wind_pulses` | `wind_speed` | `wind_pulses × K_WIND` (m/s; K_WIND configurable, default 0.5) |
| `rain_pulses` | `precipitation` | `rain_pulses × K_RAIN` (mm; K_RAIN configurable, default 0.2794) |
| *(no existe)* | `wind_direction` | constante `"N/A"` |

El `timestamp` del `Reading` SHALL ser el campo `time` del evento ChirpStack (ISO 8601). Si `time` está ausente o inválido, SHALL usarse `datetime.now(UTC)`.

#### Scenario: Constantes configurables via entorno
- **WHEN** el backend inicia con `SENSOR_K_WIND=1.0` y `SENSOR_K_RAIN=0.5` en el entorno
- **THEN** los valores de `wind_speed` y `precipitation` de los uplinks subsiguientes reflejan las nuevas constantes

## REMOVED Requirements

### Requirement: Subscriber MQTT integrado en el backend principal
**Reason**: reemplazado por webhook HTTP. El subscriber paho-mqtt, el thread de reconexión y las variables `CHIRPSTACK_MQTT_BROKER` / `CHIRPSTACK_APP_ID` son eliminados.  
**Migration**: configurar la integración HTTP en el panel de ChirpStack apuntando a `POST /integrations/chirpstack/uplink` del backend.
