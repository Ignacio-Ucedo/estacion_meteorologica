# Delta spec: lorawan-ingestion-bridge
# Change: associate-station-to-customer

## MODIFIED Requirements

### Requirement: Auto-provisioning de station_meta

`ensure_station(dev_eui)` SHALL escribir el punto en `station_meta` con el tag `owner_id=""` (string vacío) además de los tags `dev_eui` y `station_id` existentes.

El `owner_id` vacío indica que la station aún no tiene propietario asignado. El wizard del operator-app es responsable de llamar a `PUT /api/stations/{station_id}/owner` para completar la asociación.

#### Scenario: Primera uplink crea station_meta con owner_id vacío

- **WHEN** llega el primer uplink de un `dev_eui` nuevo
- **THEN** se crea un punto en `station_meta` con tag `owner_id=""` y el log incluye `station_created dev_eui=...`

#### Scenario: Station sin owner no bloquea la ingesta

- **GIVEN** una station con `owner_id=""`
- **WHEN** llegan uplinks posteriores del mismo `dev_eui`
- **THEN** los datos se escriben en `weather_reading` normalmente; `owner_id` del punto de ingesta no se modifica
