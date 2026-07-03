# lorawan-ingestion-bridge/spec.md

# Especificación: LoRaWAN Ingestion Bridge

## Overview

Módulo del backend que recibe uplinks LoRaWAN vía webhook HTTP desde ChirpStack, parsea el payload binario, aplica el field mapping al modelo `Reading` de PostgreSQL, y auto-provisiona `Station` para dispositivos nuevos.

---

## Requirements

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

#### Scenario: Uplink válido genera Reading en PostgreSQL

- **WHEN** ChirpStack envía un webhook con payload CRC válido
- **THEN** aparece un nuevo `Reading` en PostgreSQL con `temperature`, `humidity`, `wind_speed` y `precipitation` convertidos correctamente, y el log incluye `reading_persisted dev_eui=... seq=...`

#### Scenario: Constantes configurables via entorno

- **WHEN** el backend inicia con `SENSOR_K_WIND=1.0` y `SENSOR_K_RAIN=0.5` en el entorno
- **THEN** los valores de `wind_speed` y `precipitation` de los uplinks subsiguientes reflejan las nuevas constantes

#### Scenario: Campo time ausente en el evento ChirpStack

- **WHEN** llega un uplink sin el campo `time`
- **THEN** el `Reading` se persiste con `timestamp = datetime.now(UTC)` sin error

### Requirement: Auto-provisioning de Station por dev_eui desconocido

El backend SHALL crear automáticamente una `Station` en PostgreSQL la primera vez que recibe un uplink de un `dev_eui` no registrado, con los siguientes valores por defecto:

- `id`: `"dev-{dev_eui[:8]}"` (primeros 8 caracteres del devEUI en minúsculas)
- `name`: `"Auto {dev_eui[:8]}"`
- `location`: `"Unknown"`
- `status`: `"online"`

Si la Station ya existe, SHALL usarse la existente sin modificarla. La operación SHALL ser idempotente ante concurrencia.

#### Scenario: Primer uplink de dev_eui nuevo crea Station automáticamente

- **WHEN** llega el primer uplink de un `dev_eui` que no existe en PostgreSQL
- **THEN** se crea una `Station` con id `dev-{dev_eui[:8]}`, el log incluye `station_auto_created dev_eui=...`, y el `Reading` se asocia a esa Station

#### Scenario: Uplinks subsiguientes del mismo dev_eui no duplican Station

- **WHEN** llegan múltiples uplinks del mismo `dev_eui`
- **THEN** solo existe una `Station` para ese `dev_eui` y todos los `Reading` se asocian a ella

### Requirement: Calibration constants configurables por variable de entorno

El backend SHALL leer `SENSOR_K_WIND` y `SENSOR_K_RAIN` desde variables de entorno al iniciar. Los defaults SHALL ser `0.5` (m/s/pulso) y `0.2794` (mm/pulso) respectivamente.

#### Scenario: Defaults aplicados sin variables de entorno

- **WHEN** el backend inicia sin `SENSOR_K_WIND` ni `SENSOR_K_RAIN`
- **THEN** se aplican los valores `0.5` y `0.2794` respectivamente

### Requirement: Servicio backend en docker-compose

El `infra/docker-compose.yml` SHALL incluir un servicio `backend` que construye la imagen desde `../backend`, expone el puerto `8000`, y depende de `postgres`. El servicio no requiere dependencia de `mosquitto`.

#### Scenario: Stack completo levanta con un solo comando

- **WHEN** se ejecuta `docker compose up -d` en `infra/`
- **THEN** los servicios `chirpstack`, `postgres`, `redis`, `influxdb` y `backend` inician correctamente
