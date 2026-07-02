## ADDED Requirements

### Requirement: Variables de entorno MQTT en configuración del backend

El backend SHALL aceptar las variables de entorno `CHIRPSTACK_MQTT_BROKER` (default `localhost:1883`) y `CHIRPSTACK_APP_ID` (requerido para activar MQTT) además de las variables ya existentes (`DATABASE_URL`). Estas variables SHALL documentarse en `backend/README.md`.

#### Scenario: Variables de entorno documentadas en README

- **WHEN** un desarrollador lee `backend/README.md`
- **THEN** encuentra la tabla completa de variables de entorno incluyendo `CHIRPSTACK_MQTT_BROKER`, `CHIRPSTACK_APP_ID`, `SENSOR_K_WIND` y `SENSOR_K_RAIN` con sus defaults y descripción

---

### Requirement: GET /api/stations devuelve estaciones auto-creadas

Las estaciones creadas automáticamente por el ingestion bridge (con prefijo `dev-`) SHALL aparecer en `GET /api/stations` junto con las estaciones registradas manualmente, sin distinción en la respuesta.

#### Scenario: Estación auto-creada visible en listado

- **WHEN** el gateway-mock publica su primer uplink y luego se realiza `GET /api/stations`
- **THEN** la respuesta incluye la Station auto-creada con `id = "dev-{dev_eui[:8]}"` y `status = "online"`

---

### Requirement: GET /api/stations/{id} devuelve current reading de uplinks reales

Una vez que el ingestion bridge persiste uplinks como `Reading`, el endpoint `GET /api/stations/{id}` SHALL devolver el campo `current` con los valores de la lectura más reciente del nodo real o del gateway-mock, no datos mock.

#### Scenario: current reading reflejando uplink del gateway-mock

- **WHEN** el gateway-mock publica al menos un uplink válido y se consulta `GET /api/stations/dev-{dev_eui[:8]}`
- **THEN** el campo `current.temperature` coincide con el valor del último uplink (dentro de la precisión del field mapping) y `lastUpdatedAt` es reciente
