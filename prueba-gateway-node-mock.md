# Guía de prueba: gateway-node-mock

Valida la cadena completa **ESP32 → WiFi → UDP → ChirpStack → MQTT → Backend → PostgreSQL**
con un único ESP32 y sin módulo de radio SX1278.

---

## Requisitos previos

### Hardware
- 1× ESP32 DevKitC V1 (o equivalente) conectado por USB

### Software en la máquina host

```bash
# Cadena de compilación Rust + ESP32
cargo install espup ldproxy espflash cargo-espflash
espup install

# Herramienta para flashear y leer MAC
pip install esptool

# Herramienta para generar la partición NVS
pip install esp-idf-nvs-partition-gen
```

Docker corriendo con Compose v2 (`docker compose version`).

---

## Paso 1 — Obtener la MAC WiFi del ESP32

La MAC determina el **Gateway EUI**, que necesitás registrar en ChirpStack
**antes** de flashear el firmware. Hacelo con el ESP32 conectado y sin ningún
firmware particular:

```bash
esptool.py --port /dev/ttyUSB0 read_mac
```

Salida de ejemplo:
```
MAC: aa:bb:cc:dd:ee:ff
```

**Calculá el Gateway EUI** insertando `FF:FE` después del tercer byte:

```
MAC:       AA:BB:CC:DD:EE:FF
EUI-64:    AA:BB:CC:FF:FE:DD:EE:FF
Sin colons: AABBCCFFFEDFEE FF  ← esto va a ChirpStack (16 chars hex)
```

> En Linux el puerto suele ser `/dev/ttyUSB0` o `/dev/ttyACM0`.
> En macOS es `/dev/cu.usbserial-*` o `/dev/cu.SLAB_USBtoUART`.

---

## Paso 2 — Levantar el stack Docker

```bash
cd infra/
docker compose up -d
```

Verificar que todos los servicios estén corriendo:

```bash
docker compose ps
```

Deberías ver: `chirpstack`, `chirpstack-gateway-bridge`, `mosquitto`,
`postgres`, `redis`, `influxdb`, `backend`.

> El `backend` va a arrancar pero quedará con MQTT sin suscribir hasta que
> le des el `CHIRPSTACK_APP_ID` (Paso 3.4).

---

## Paso 3 — Configurar ChirpStack

Abrí **http://localhost:8080** → login: `admin` / `admin`.

### 3.1 Registrar el gateway

1. Menú izquierdo: **Gateways** → **Add gateway**
2. Campos:
   - **Name**: `esp32-gateway-node-mock`
   - **Gateway ID**: el EUI-64 del Paso 1 sin colons, en minúsculas.  
     Ejemplo: `aabbccfffeddeeff`
   - **Description**: opcional
3. **Submit**

El gateway aparece como **Never seen** hasta que el firmware envíe el primer
PULL_DATA. Eso está bien por ahora.

### 3.2 Crear el Device Profile

1. **Device profiles** → **Add device profile**
2. Pestaña **General**:
   - **Name**: `esp32-sensor-eu433`
   - **Region**: EU433
   - **MAC version**: LoRaWAN 1.0.2
   - **Regional parameters revision**: B
   - **ADR algorithm**: None
   - **Supports OTAA**: ✓ activado
3. **Submit**

> Si ya existe un profile con esas características de un setup anterior,
> podés reutilizarlo.

### 3.3 Crear la Application

1. **Applications** → **Add application**
2. **Name**: `weather-station`
3. **Submit**

Después de crear la application, la URL del navegador es:
```
http://localhost:8080/tenants/52f14cd4-.../applications/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
```

**El UUID al final es el Application ID.** Copialo — lo necesitás en el
Paso 4.

### 3.4 Reiniciar el backend con el Application ID

```bash
cd infra/
CHIRPSTACK_APP_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" docker compose up -d backend
```

Verificar que el backend se suscribió:

```bash
docker compose logs backend --tail=20
```

Debería aparecer:
```
mqtt_startup broker=mosquitto:1883
mqtt_connected broker=mosquitto:1883 topic=application/xxxxxxxx-.../device/+/event/up
```

### 3.5 Registrar el dispositivo gateway-node-mock

1. Abrí la application `weather-station` → **Add device**
2. Pestaña **General**:
   - **Name**: `gateway-node-mock`
   - **Device EUI (DevEUI)**: hacé click en el ícono de generar (🔀) para que
     ChirpStack genere un DevEUI único de 8 bytes.  
     **Anotalo** — lo necesitás para el NVS.
   - **Device profile**: `esp32-sensor-eu433`
3. **Submit**

### 3.6 Configurar las claves OTAA

Después de crear el device:
1. Pestaña **Keys (OTAA)**
2. El campo **Application key** viene vacío → hacé click en 🔀 para generar.
3. El **Join EUI (AppEUI)**: dejalo en `0000000000000000`.
4. **Submit**

**Anotá la AppKey** (16 bytes hex) — la necesitás para el NVS.

---

## Paso 4 — Provisionar NVS en el ESP32

El firmware carga DevEUI, AppEUI y AppKey desde la partición NVS del ESP32.
Como el binario `nvs-provision` no está implementado aún, lo hacemos con las
herramientas estándar del ESP-IDF.

### 4.1 Crear el archivo CSV

Creá `firmware/nvs_mock.csv` con los valores del Paso 3 (reemplazá los hex):

```csv
key,type,encoding,value
lorawan,namespace,,
dev_eui,data,hex2bin,AABBCCDDEEFF0011
app_eui,data,hex2bin,0000000000000000
app_key,data,hex2bin,AABBCCDDEEFF00112233445566778899
```

> - `dev_eui`: el DevEUI generado en el Paso 3.5 (sin colons, mayúsculas o minúsculas).
> - `app_eui`: siempre `0000000000000000` (ChirpStack self-hosted).
> - `app_key`: la AppKey del Paso 3.6 (sin espacios).

### 4.2 Generar la partición NVS binaria

```bash
cd firmware/
esp-idf-nvs-partition-gen generate nvs_mock.csv nvs_mock.bin 0x6000
```

Esto genera `nvs_mock.bin` de 24 KB (tamaño de la partición NVS por defecto del ESP32).

### 4.3 Flashear solo la partición NVS

Con el ESP32 conectado (en modo boot normal, no es necesario el modo flashing
manual):

```bash
esptool.py --port /dev/ttyUSB0 write_flash 0x9000 nvs_mock.bin
```

> `0x9000` es la dirección de la partición NVS en la tabla de particiones por
> defecto del ESP32 (sin tabla de particiones personalizada).

Verificar que no haya errores en la salida:
```
Writing at 0x00009000... (100 %)
Wrote 24576 bytes (655 compressed) at 0x00009000 in 0.2 seconds
Hash of data verified.
```

---

## Paso 5 — Compilar y flashear el firmware

### 5.1 Definir variables de entorno

```bash
export WIFI_SSID="nombre-de-tu-red"
export WIFI_PASS="contraseña-wifi"
export CHIRPSTACK_HOST="192.168.x.x"   # IP de la máquina donde corre Docker
                                        # NO usar "localhost" ni "127.0.0.1"
```

Para encontrar la IP de la máquina:
```bash
ip route get 8.8.8.8 | awk '{print $7; exit}'   # Linux
ipconfig getifaddr en0                             # macOS (WiFi)
```

> El ESP32 debe poder alcanzar esa IP por WiFi. Si el ESP32 y la máquina
> están en la misma red local, la IP privada funciona directamente.

### 5.2 Compilar y flashear (en un solo paso)

```bash
cd firmware/
cargo espflash flash --bin gateway-node-mock --monitor
```

`cargo espflash` compila el binario, lo flashea y abre el monitor serial
automáticamente. Si pregunta el puerto, seleccioná el del ESP32.

---

## Paso 6 — Verificar el flujo completo

### 6.1 Log serial del ESP32

Con el monitor abierto del paso anterior (o `espflash monitor` en otra terminal),
deberías ver la secuencia completa:

```
I (xxx) gateway-node-mock: gateway-node-mock starting — WiFi+UDP synthetic gateway, no SX1278
I (xxx) gateway-node-mock: channel=433.175MHz sf=7 bw=125kHz (EU433) device_id=3
I (xxx) gateway-node-mock: dev_eui=[AA, BB, CC, DD, EE, FF, 00, 11]
I (xxx) gateway-node-mock: app_eui=[00, 00, 00, 00, 00, 00, 00, 00]
I (xxx) gateway-node-mock: seq_restored=0
I (xxx) gateway-node-mock: wifi_connected ip=192.168.x.y
I (xxx) gateway-node-mock: gateway_eui=AA:BB:CC:FF:FE:DD:EE:FF
I (xxx) gateway-node-mock: no_session_in_nvs — starting OTAA join
I (xxx) gateway-node-mock: lorawan_join attempt=1 dev_nonce=0x1a2b
I (xxx) gateway-node-mock: lorawan_join_ok dev_addr=[01, 23, 45, 67] attempt=1
I (xxx) gateway-node-mock: mock_sensor temp_c=15.07 hum_rh=74.89
I (xxx) gateway-node-mock: uplink_sent seq=1 fcnt=1 frame_len=26
```

**Si el join falla** con `lorawan_join_timeout`, ver la sección de
troubleshooting al final.

### 6.2 ChirpStack UI

1. **Gateways** → `esp32-gateway-node-mock`: el estado debe cambiar a **Online**
   (puede tardar hasta 30 segundos — el STAT heartbeat se envía cada 30s).

2. **Applications** → `weather-station` → `gateway-node-mock`:
   - Pestaña **Events**: debe mostrar el evento `up` con el uplink recibido.
   - Pestaña **Activation**: debe mostrar `DevAddr`, `NwkSKey`, `AppSKey`
     (indica que el join OTAA fue exitoso).

### 6.3 Logs del backend

```bash
cd infra/
docker compose logs backend -f --tail=50
```

Deberías ver por cada uplink:
```
reading_persisted dev_eui=aabbccddeeff0011 seq=1
```

Si ves `payload_invalid`, el payload no pasó la verificación CRC — probablemente
un problema de claves (ver troubleshooting).

### 6.4 REST API del backend

```bash
# Listar estaciones (la estación se auto-crea al primer uplink)
curl -s http://localhost:8000/api/stations | python3 -m json.tool

# Detalle de la estación (usar el ID devuelto, eg: "dev-aabbccdd")
curl -s http://localhost:8000/api/stations/dev-aabbccdd | python3 -m json.tool
```

Respuesta esperada para el detalle:
```json
{
  "id": "dev-aabbccdd",
  "name": "Auto aabbccdd",
  "location": "Unknown",
  "status": "online",
  "current": {
    "temperature": 15.07,
    "humidity": 74.89,
    "windSpeed": 0.0,
    "precipitation": 0.0,
    "batteryLevel": 73.53,
    ...
  }
}
```

> `batteryLevel` se calcula como `(3700 / 4200) * 100 ≈ 88%` — el mock envía
> siempre `bateria_mv = 3700`.

### 6.5 Frontend (opcional)

Si el frontend está corriendo en desarrollo:

```bash
cd frontend/
pnpm dev
```

Abrir http://localhost:5173 — la estación `Auto aabbccdd` debería aparecer en
la lista con temperatura y humedad del mock.

> **Nota**: el frontend aún puede estar configurado con datos mock estáticos
> dependiendo del estado de integración con el backend. Si no muestra datos
> reales, verificar que el `stationId` en el frontend apunte a la estación
> auto-creada.

---

## Paso 7 — Verificar la reconexión WiFi

Para validar que el firmware reconecta sin reinicio:

1. Apagá el router o punto de acceso (o cambiá temporalmente la contraseña).
2. En el serial deberías ver:
   ```
   W (xxx) gateway-node-mock: wifi_disconnected — reconectando
   E (xxx) gateway-node-mock: wifi_reconnect_failed=... — reintentando en 5s
   ```
3. Volvé a habilitar el WiFi con las mismas credenciales.
4. El firmware reconecta automáticamente y envía PULL_DATA para re-registrar
   el endpoint UDP con ChirpStack.
5. El siguiente ciclo de `SEND_INTERVAL_MS` (10 minutos) debería producir un
   uplink exitoso.

---

## Troubleshooting

### `lorawan_join_timeout` — el join no completa

Causas más frecuentes y verificaciones:

**1. El puerto UDP 1700 no llega al host Docker**

```bash
# Desde el ESP32 no podemos hacer ping, pero podemos verificar desde la máquina:
ss -ulnp | grep 1700          # Linux: debe mostrar 0.0.0.0:1700
nc -u -l 1700 &               # escuchar UDP en la máquina
# Si el Gateway Bridge está corriendo, nc no puede abrirlo (puerto ocupado = OK)
```

Verificar que el firewall no bloquee el puerto:
```bash
sudo ufw allow 1700/udp       # Linux UFW
```

**2. El CHIRPSTACK_HOST es `localhost` o `127.0.0.1`**

El ESP32 no puede alcanzar `localhost` de otra máquina. Debe ser la IP LAN:
```bash
ip route get 8.8.8.8 | awk '{print $7; exit}'
```

**3. El gateway no está registrado en ChirpStack con el EUI correcto**

El Gateway Bridge rechaza paquetes de gateways no registrados.  
Verificar en **Gateways** que el EUI coincida exactamente con el que imprime
el firmware:
```
I (xxx) gateway-node-mock: gateway_eui=AA:BB:CC:FF:FE:DD:EE:FF
```
ChirpStack lo espera sin colons: `AABBCCFFFEDDEEFF`.

**4. El dispositivo no tiene claves OTAA configuradas en ChirpStack**

Ir al device → pestaña **Keys (OTAA)** → verificar que `Application key` no
esté vacía. Si está vacía, generarla, anotarla y reprovisionar el NVS (Paso 4).

**5. Diferencia de claves entre NVS y ChirpStack**

Si el NVS tiene una AppKey distinta a la que está en ChirpStack, el MIC del
JoinRequest no va a verificar y ChirpStack lo descartará silenciosamente.

Para re-provisionar el NVS con las claves correctas: repetir el Paso 4 y
re-flashear la partición. No es necesario recompilar el firmware.

---

### `nvs_load_failed` — error al arrancar

El firmware no encontró las claves en NVS. Verificar:
- Que el CSV tenga el namespace correcto: la primera fila con `type=namespace`
  debe tener `key=lorawan` (exactamente, sin mayúsculas).
- Que `write_flash 0x9000` haya completado sin errores.
- Que el `esp-idf-nvs-partition-gen generate` haya generado el `.bin` sin
  warnings de encoding.

### `join_accept_mic_invalid`

El JoinAccept llegó pero el MIC no verificó. Causas:
- La AppKey en NVS no coincide con la de ChirpStack.
- El DevNonce fue reutilizado (ChirpStack rechaza joins con DevNonce repetido
  en la misma sesión). Esto puede pasar si se reinicia el ESP32 muy seguido.
  Solucionarlo reseteando el contador en ChirpStack: en el device → **Keys (OTAA)**
  → eliminar el device y recrearlo con las mismas claves.

### El gateway está `Online` pero no llegan uplinks al backend

Verificar:
1. Que `CHIRPSTACK_APP_ID` esté correctamente seteado (UUID completo, no `1`).
2. Que el backend se haya reiniciado **después** de setear la variable:
   ```bash
   docker compose logs backend --tail=5 | grep mqtt_connected
   ```
3. Que el topic en el log del backend coincida con el Application ID de ChirpStack:
   ```
   topic=application/xxxxxxxx-xxxx.../device/+/event/up
   ```

### `payload_invalid` en el log del backend

El payload de 14 bytes no pasó la verificación CRC-8. Esto indica que el
descifrado del FRMPayload no fue correcto, que a su vez indica que las session
keys (AppSKey, NwkSKey) derivadas por el firmware no coinciden con las que
ChirpStack usó para descifrar/cifrar.

Causa más probable: DevNonce fue reutilizado (ver arriba) y ChirpStack derivó
claves de sesión distintas. Solución: resetear el device en ChirpStack (Paso 3.5
de nuevo) y borrar la sesión en NVS del ESP32:

```bash
# Re-flashear la partición NVS (borra dev_addr/nwk_skey/app_skey/fcnt_up)
esptool.py --port /dev/ttyUSB0 erase_region 0x9000 0x6000
# Luego re-flashear el CSV con las nuevas claves
esptool.py --port /dev/ttyUSB0 write_flash 0x9000 nvs_mock.bin
```

---

## Checklist de validación end-to-end

- [ ] Stack Docker levantado (`docker compose ps` — todos `Up`)
- [ ] Gateway registrado en ChirpStack (`Gateways` → `Online`)
- [ ] Device `gateway-node-mock` creado con DevEUI + AppKey
- [ ] Backend con `CHIRPSTACK_APP_ID` correcto (UUID, no `1`)
- [ ] NVS provisionado con CSV correcto y flasheado en `0x9000`
- [ ] Firmware compilado con `CHIRPSTACK_HOST` = IP LAN (no `localhost`)
- [ ] Log serial: `lorawan_join_ok` visible
- [ ] Log serial: `uplink_sent seq=1` visible
- [ ] ChirpStack UI → device → Events: muestra evento `up`
- [ ] `docker compose logs backend` muestra `reading_persisted`
- [ ] `GET /api/stations` devuelve estación `dev-{devEUI[:8]}`
- [ ] `GET /api/stations/{id}` devuelve `current.temperature` y `current.humidity`
