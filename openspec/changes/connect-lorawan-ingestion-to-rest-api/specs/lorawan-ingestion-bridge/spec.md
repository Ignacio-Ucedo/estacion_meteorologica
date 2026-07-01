## ADDED Requirements

### Requirement: Subscriber MQTT integrado en el backend principal

El backend FastAPI (`app/main.py`) SHALL iniciar un subscriber paho-mqtt en el evento `startup` y detenerlo en el evento `shutdown`. El subscriber SHALL suscribirse al topic `application/{CHIRPSTACK_APP_ID}/device/+/event/up` con reconexión automática (backoff 1–30 s). Si `CHIRPSTACK_APP_ID` no está configurado, el subscriber SHALL no iniciarse y el REST API SHALL continuar funcionando normalmente.

#### Scenario: Backend arranca con CHIRPSTACK_APP_ID configurado

- **WHEN** el backend inicia con `CHIRPSTACK_APP_ID` definido en el entorno
- **THEN** el log incluye `mqtt_startup broker=... topic=application/{appId}/device/+/event/up` y el subscriber queda activo

#### Scenario: Backend arranca sin CHIRPSTACK_APP_ID

- **WHEN** el backend inicia sin `CHIRPSTACK_APP_ID` en el entorno
- **THEN** el log incluye un warning indicando que MQTT no fue iniciado, y el REST API responde normalmente en `/api/health`

#### Scenario: Reconexión ante caída del broker

- **WHEN** el broker Mosquitto se detiene y se reinicia mientras el backend corre
- **THEN** el subscriber se reconecta sin reiniciar uvicorn, y los uplinks posteriores se procesan correctamente

---

### Requirement: Field mapping de payload LoRaWAN a Reading de PostgreSQL

Por cada uplink MQTT válido, el backend SHALL parsear el payload binario de 14 bytes y persistir un `Reading` en PostgreSQL aplicando el siguiente mapping:

| Campo payload (LoRaWAN) | Campo `Reading` (PostgreSQL) | Conversión |
|---|---|---|
| `temp_c` | `temperature` | directo (float, °C, rango −40 a +85, resolución 0.01) |
| `humidity_pct` | `humidity` | directo (float, %RH, rango 0–100, resolución 0.01) |
| `wind_pulses` | `wind_speed` | `wind_pulses × K_WIND` (m/s; K_WIND configurable, default 0.5) |
| `rain_pulses` | `precipitation` | `rain_pulses × K_RAIN` (mm; K_RAIN configurable, default 0.2794) |
| *(no existe)* | `wind_direction` | constante `"N/A"` |

El `timestamp` del `Reading` SHALL ser el campo `time` del evento ChirpStack (ISO 8601). Si `time` está ausente o inválido, SHALL usarse `datetime.now(UTC)`.

#### Scenario: Uplink válido genera Reading en PostgreSQL

- **WHEN** el gateway-mock publica un uplink con payload CRC válido
- **THEN** aparece un nuevo `Reading` en PostgreSQL con `temperature`, `humidity`, `wind_speed` y `precipitation` convertidos correctamente, y el log incluye `reading_persisted dev_eui=... seq=...`

#### Scenario: Constantes configurables via entorno

- **WHEN** el backend inicia con `SENSOR_K_WIND=1.0` y `SENSOR_K_RAIN=0.5` en el entorno
- **THEN** los valores de `wind_speed` y `precipitation` de los uplinks subsiguientes reflejan las nuevas constantes

#### Scenario: Payload con CRC inválido es descartado

- **WHEN** se publica un mensaje MQTT con un payload cuyo CRC-8/MAXIM no coincide
- **THEN** el log incluye `payload_invalid` con el hex del payload, no se persiste ningún `Reading`, y el subscriber continúa procesando el siguiente mensaje

#### Scenario: Campo time ausente en el evento ChirpStack

- **WHEN** llega un uplink sin el campo `time`
- **THEN** el `Reading` se persiste con `timestamp = datetime.now(UTC)` sin error

---

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

---

### Requirement: Calibration constants configurables por variable de entorno

El backend SHALL leer `SENSOR_K_WIND` y `SENSOR_K_RAIN` desde variables de entorno al iniciar. Los defaults SHALL ser `0.5` (m/s/pulso) y `0.2794` (mm/pulso) respectivamente. Los valores SHALL documentarse en `backend/README.md` como provisionales, pendientes de calibración con hardware real.

#### Scenario: Defaults aplicados sin variables de entorno

- **WHEN** el backend inicia sin `SENSOR_K_WIND` ni `SENSOR_K_RAIN`
- **THEN** se aplican los valores `0.5` y `0.2794` respectivamente

---

### Requirement: Servicio backend en docker-compose

El `infra/docker-compose.yml` SHALL incluir un servicio `backend` que construye la imagen desde `../backend`, expone el puerto `8000`, y depende de `mosquitto` y `postgres`. El servicio `gateway-mock` SHALL incluirse bajo el perfil `mock` para uso opcional sin modificar el stack por defecto.

#### Scenario: Stack completo levanta con un solo comando

- **WHEN** se ejecuta `docker compose up -d` en `infra/`
- **THEN** los servicios `chirpstack`, `mosquitto`, `postgres`, `redis`, `influxdb` y `backend` inician correctamente

#### Scenario: gateway-mock se levanta solo con perfil mock

- **WHEN** se ejecuta `docker compose --profile mock up -d`
- **THEN** el servicio `gateway-mock` inicia y publica uplinks al broker Mosquitto del stack
