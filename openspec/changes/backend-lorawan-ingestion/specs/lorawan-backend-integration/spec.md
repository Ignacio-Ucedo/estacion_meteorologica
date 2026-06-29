## ADDED Requirements

### Requirement: FastAPI consume uplinks de ChirpStack vía suscripción MQTT

El backend SHALL suscribirse al topic MQTT de ChirpStack `application/{appId}/device/{devEUI}/event/up` usando un cliente paho-mqtt iniciado en el startup de FastAPI. El cliente SHALL reconectarse automáticamente ante caídas del broker MQTT.

#### Scenario: FastAPI recibe y procesa un uplink válido de ChirpStack
- **GIVEN** ChirpStack publicó un evento `up` en MQTT con el FRMPayload de 14 bytes en base64
- **WHEN** el cliente MQTT de FastAPI recibe el mensaje
- **THEN** FastAPI decodifica el base64, deserializa los 14 bytes según la estructura del payload binario definida en `lorawan-node`, valida el CRC8 y escribe la lectura en InfluxDB

#### Scenario: FastAPI descarta un uplink con CRC inválido
- **GIVEN** ChirpStack publicó un evento `up` con un FRMPayload cuyo byte 13 no coincide con el CRC-8/MAXIM de los primeros 13 bytes
- **WHEN** el cliente MQTT de FastAPI procesa el mensaje
- **THEN** FastAPI registra el error con el DevEUI y el contenido del payload y no escribe en InfluxDB

#### Scenario: FastAPI reconecta al broker MQTT si la conexión se interrumpe
- **GIVEN** el broker MQTT (Mosquitto o ChirpStack embebido) estuvo temporalmente no disponible
- **WHEN** el broker vuelve a estar disponible
- **THEN** el cliente paho-mqtt de FastAPI reconecta automáticamente y reanuda la suscripción al topic sin intervención manual

---

### Requirement: Las lecturas validadas se persisten en InfluxDB con el schema definido

El backend SHALL escribir cada lectura válida en InfluxDB usando el siguiente schema:

- **measurement**: `weather_reading`
- **tags**: `device_id` (string, valor del campo `device_id` del payload), `dev_eui` (string, DevEUI del dispositivo en ChirpStack)
- **fields**: `temp_c` (float, `temp_c_x100 / 100.0`), `humidity_pct` (float, `hum_x100 / 100.0`), `rain_pulses` (integer), `wind_pulses` (integer), `battery_mv` (integer), `seq` (integer)
- **timestamp**: valor del campo `time` del evento MQTT de ChirpStack (ISO 8601, nanosegundos en InfluxDB)

#### Scenario: Una lectura válida se persiste en InfluxDB
- **GIVEN** FastAPI procesó un uplink con CRC válido
- **WHEN** el cliente InfluxDB escribe el punto
- **THEN** el punto aparece en InfluxDB con el measurement `weather_reading`, los tags `device_id` y `dev_eui`, los campos numéricos convertidos a sus unidades reales y el timestamp del evento LoRaWAN

#### Scenario: Un error de escritura en InfluxDB no detiene el procesamiento de uplinks
- **GIVEN** InfluxDB está temporalmente no disponible
- **WHEN** FastAPI intenta escribir una lectura
- **THEN** FastAPI registra el error y continúa procesando el siguiente mensaje MQTT sin reiniciarse

---

### Requirement: ChirpStack está documentado como dependencia de infraestructura del entorno

El repositorio SHALL incluir un `docker-compose.yml` en el directorio `infra/` que levante ChirpStack v4 (configurado para EU433), Mosquitto (broker MQTT) e InfluxDB, de modo que el entorno completo pueda iniciarse con un único comando.

#### Scenario: El entorno de desarrollo se levanta con un comando
- **GIVEN** Docker y Docker Compose están instalados en la máquina de desarrollo
- **WHEN** se ejecuta `docker compose -f infra/docker-compose.yml up -d`
- **THEN** ChirpStack (EU433), Mosquitto e InfluxDB están disponibles en los puertos configurados y FastAPI puede conectarse a todos
