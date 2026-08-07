# Setup del entorno LoRaWAN AU915

## 0. Flujo rápido sin ESP32 (Operator App)

Si no tenés hardware disponible, podés validar el pipeline completo con la app de escritorio:

```bash
cd infra && docker compose up -d          # levantar ChirpStack + backend
cd operator-app && npm install && cargo tauri dev  # abrir la app
```

En la app: **Cargar desde nvs_mock.csv** (archivo en `firmware/nvs_mock.csv`) → **▶ Iniciar**.
El dispositivo con `device_id=3` aparece en ChirpStack y los datos llegan al dashboard.

Ver `operator-app/README.md` para prerequisitos del sistema.

---

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
   - **Region**: AU915 (sub-band 2)
4. Guardar

El gateway aparecerá como **Online** una vez que el firmware esté corriendo y enviando heartbeats UDP.

---

## 3. Registrar el nodo sensor en ChirpStack (OTAA)

### 3.1 Crear un Device Profile

1. Menú: **Device profiles** → **Add device profile**
2. Completar:
   - **Name**: `esp32-sensor-au915`
   - **Region**: AU915 (sub-band 2)
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
   - **Device profile**: `esp32-sensor-au915`
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

## 5. Gateway-node-mock: validar la cadena con un solo ESP32 (sin radio LoRa)

`gateway-node-mock` actúa simultáneamente como gateway sintético y como
nodo sensor simulado. No requiere módulo LR1121. Valida la cadena completa
**ESP32 → WiFi → UDP → ChirpStack → MQTT → Backend → PostgreSQL → Frontend**
con un solo ESP32 y sin hardware de radio.

Diferencia clave con los otros mocks:

| Binary | device_id | Radio LoRa (LR1121) | ChirpStack flow |
|---|---|---|---|
| `sensor-node-mock` | 2 | Sí (TX) | Completa via LoRa RF |
| `gateway-mock` (Docker) | N/A | No | Bypasea ChirpStack (publica directo a MQTT) |
| `gateway-node-mock` | 3 | No | **Completa via UDP** (ejercita ChirpStack OTAA) |

### 5.1 Registrar el gateway en ChirpStack

Obtener el GatewayEUI del ESP32 (ver sección 2.1 — se imprime por serial al arrancar
por primera vez con el binario). Registrarlo en ChirpStack siguiendo la sección 2.2.

### 5.2 Crear el Device Profile AU915

Si no existe ya (ver sección 3.1), crear el profile `esp32-sensor-au915` con
LoRaWAN 1.0.2, AU915 sub-band 2, OTAA habilitado.

### 5.3 Registrar el dispositivo gateway-node-mock

En la application `weather-station` → **Add device**:

- **Name**: `gateway-node-mock`
- **DevEUI**: nuevo EUI-64 (diferente al del nodo real y al sensor-node-mock)
- **Device profile**: `esp32-sensor-au915`

Tras guardar, pestaña **Keys (OTAA)**:
- **AppKey**: generar nueva (diferente a todos los demás dispositivos)
- **JoinEUI / AppEUI**: `0000000000000000`

Anotar DevEUI y AppKey.

### 5.4 Escribir las claves en NVS

```bash
cargo run --bin nvs-provision -- \
  --dev-eui  <dev-eui-gateway-node-mock> \
  --app-eui  0000000000000000 \
  --app-key  <app-key-gateway-node-mock>
```

### 5.5 Compilar y flashear

```bash
WIFI_SSID="<tu-ssid>" \
WIFI_PASS="<tu-password>" \
CHIRPSTACK_HOST="<ip-del-host-docker>" \
cargo build --bin gateway-node-mock --release

espflash flash target/xtensa-esp32-espidf/release/gateway-node-mock
```

> `CHIRPSTACK_HOST` es la IP de la máquina donde corre `docker compose up`
> (p.ej. `192.168.1.100`). El puerto UDP 1700 debe ser accesible desde el ESP32.

### 5.6 Verificar el flujo

1. Abrir monitor serial: `espflash monitor`
2. Buscar en el log:
   - `wifi_connected` — WiFi ok
   - `gateway_eui=…` — EUI a registrar si no se hizo antes
   - `lorawan_join attempt=1` — JoinRequest enviado via UDP
   - `lorawan_join_ok dev_addr=…` — JoinAccept recibido y procesado
   - `uplink_sent seq=1` — primer uplink inyectado
3. En ChirpStack UI (http://localhost:8080): la application debe mostrar
   el dispositivo `gateway-node-mock` con la última actividad.
4. En el backend: `GET /api/stations` debe listar la estación auto-provisionada
   con id `dev-<primeros-8-chars-del-devEUI>`.

### 5.7 Notas de troubleshooting

- **join_timeout**: verificar que el gateway esté registrado en ChirpStack con el EUI
  correcto y que el puerto UDP 1700 no esté bloqueado por firewall.
- **mic_invalid**: verificar que las claves en NVS coincidan con las registradas
  en ChirpStack (DevEUI, AppEUI=todos-ceros, AppKey).
- **nvs_load_failed**: ejecutar `nvs-provision` antes de flashear el mock.
- **wifi_reconnect**: el firmware reconecta automáticamente y reenvía PULL_DATA.

---

## 6. Verificar el flujo completo

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

## 7. Variables de entorno del módulo de ingesta LoRaWAN

> **Nota:** estas variables corresponden al módulo de ingesta MQTT + InfluxDB del
> change `backend-lorawan-ingestion`, que aún no está implementado. El backend
> REST API actual (`backend/`) usa PostgreSQL y no requiere estas variables.
> Configurar aquí como referencia para cuando se implemente ese change.

```bash
export CHIRPSTACK_MQTT_BROKER=localhost:1883
export CHIRPSTACK_APP_ID=<application-id-del-paso-3.2>
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=weather-station-token
export INFLUXDB_ORG=weather-station
export INFLUXDB_BUCKET=weather
```

El backend REST API actual necesita su propio PostgreSQL (distinto al de ChirpStack).
Ver `backend/.env.example` para las variables requeridas (`DATABASE_URL`, etc.).
