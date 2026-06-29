# Setup del entorno LoRaWAN EU433

## 1. Levantar el stack

```bash
cd infra/
docker compose up -d
```

Verificar que todos los servicios están corriendo:

```bash
docker compose ps
```

- ChirpStack UI: http://localhost:8080 (admin / admin)
- InfluxDB UI: http://localhost:8086 (admin / adminpassword)

---

## 2. Registrar el gateway ESP32 en ChirpStack

### 2.1 Determinar el GatewayEUI

El GatewayEUI se deriva de la dirección MAC WiFi del ESP32 gateway (formato EUI-64,
8 bytes). El firmware del gateway lo imprime por serial al iniciar:

```
gateway_eui=AA:BB:CC:FF:FE:DD:EE:FF
```

Alternativamente, derivarlo manualmente de la MAC WiFi (6 bytes):

```
MAC: AA:BB:CC:DD:EE:FF
EUI-64: AA:BB:CC:FF:FE:DD:EE:FF  (insertar FF:FE en el centro)
```

### 2.2 Registrar en ChirpStack

1. Abrir http://localhost:8080
2. Menú: **Gateways** → **Add gateway**
3. Completar:
   - **Name**: `esp32-gateway-01`
   - **Gateway ID (EUI-64)**: el EUI del paso anterior (sin colones: `AABBCCFFFEDDEFF`)
   - **Region**: EU433
4. Guardar

El gateway aparecerá como **Online** una vez que el firmware esté corriendo y enviando heartbeats UDP.

---

## 3. Registrar el nodo sensor en ChirpStack (OTAA)

### 3.1 Crear un Device Profile

1. Menú: **Device profiles** → **Add device profile**
2. Completar:
   - **Name**: `esp32-sensor-eu433`
   - **Region**: EU433
   - **MAC version**: LoRaWAN 1.0.2
   - **Regional parameters revision**: B
   - **ADR algorithm**: Default (disabled para el prototipo)
   - **Supports OTAA**: ✓
3. Guardar

### 3.2 Crear una Application

1. Menú: **Applications** → **Add application**
2. Completar:
   - **Name**: `weather-station`
3. Guardar y anotar el **Application ID** (se usa en la suscripción MQTT del backend)

### 3.3 Registrar el dispositivo

1. Abrir la application creada → **Add device**
2. Completar:
   - **Name**: `sensor-node-01`
   - **Device EUI (DevEUI)**: 8 bytes únicos, generados en ChirpStack o derivados de la MAC del ESP32
   - **Device profile**: `esp32-sensor-eu433`
3. Guardar

### 3.4 Configurar las claves OTAA

Tras guardar el dispositivo:
1. Pestaña **Keys (OTAA)**
2. ChirpStack genera una **Application Key (AppKey)** → anotar (16 bytes hex)
3. El **JoinEUI / AppEUI** para este setup es `0000000000000000` (todos ceros, convención para ChirpStack self-hosted sin roaming)

### 3.5 Escribir las claves en NVS del ESP32

Usar el script de provisioning del firmware para escribir en NVS (ver `firmware/docs/nvs-provisioning.md`):

```bash
# Desde el directorio firmware/, con el ESP32 conectado por USB:
cargo run --bin nvs-provision -- \
  --dev-eui  AABBCCDDEEFF0011 \
  --app-eui  0000000000000000 \
  --app-key  AABBCCDDEEFF00112233445566778899
```

O usar `esptool.py` con un archivo NVS CSV generado por `nvs_partition_gen.py`.

---

## 4. Registrar el sensor mock en ChirpStack (opcional, sin sensores físicos)

Si los sensores físicos no están soldados, usar `sensor-node-mock` para
validar el pipeline completo. El mock envía datos simulados plausibles con
`device_id=2`.

### 4.1 Registrar un segundo dispositivo

Repetir los pasos 3.3–3.5 con datos distintos:

- **Name**: `sensor-node-mock`
- **DevEUI**: nuevo EUI-64 (diferente al del nodo real)
- **AppKey**: nueva clave de 16 bytes (diferente)

### 4.2 Escribir las claves del mock en NVS

```bash
cargo run --bin nvs-provision -- \
  --dev-eui  <dev-eui-del-mock> \
  --app-eui  0000000000000000 \
  --app-key  <app-key-del-mock>
```

### 4.3 Flashear el firmware mock

```bash
cargo build --bin sensor-node-mock --release
espflash flash target/xtensa-esp32-espidf/release/sensor-node-mock
```

El mock aparecerá en ChirpStack como un segundo dispositivo y en InfluxDB
con `device_id=2`. Los uplinks son indistinguibles del nodo real en formato;
solo difieren en `device_id` y en que los valores varían de forma cíclica.

---

## 5. Verificar el flujo completo

### Con sensor-node-mock (sin sensores físicos)

1. Flashear `sensor-node-mock` (nodo) y `gateway-node` (gateway) en dos ESP32
2. Abrir logs seriales de ambas placas
3. Verificar en ChirpStack:
   - Gateway online (heartbeats recibidos)
   - `sensor-node-mock`: join OTAA completado, uplinks cada 10 minutos
4. Verificar en InfluxDB (`weather` bucket): puntos `weather_reading` con
   `device_id=2` y temperatura ∈ [15, 25]°C

### Con sensor-node real (sensores soldados)

1. Flashear `sensor-node` y `gateway-node` en dos ESP32
2. Verificar en ChirpStack: join OTAA completado, uplinks con `device_id=1`
3. Verificar en InfluxDB: puntos con valores reales de DHT22

---

## 6. Variables de entorno del backend

El backend FastAPI (ver `backend/`) necesita:

```bash
export CHIRPSTACK_MQTT_BROKER=localhost:1883
export CHIRPSTACK_APP_ID=<application-id-del-paso-3.2>
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=weather-station-token
export INFLUXDB_ORG=weather-station
export INFLUXDB_BUCKET=weather
```
