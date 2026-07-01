# Gateway mock

Publica lecturas meteorologicas sinteticas en el broker MQTT usando el mismo
evento `up` que ChirpStack entrega al backend:

```text
application/{appId}/device/{devEUI}/event/up
```

El campo `data` contiene el FRMPayload binario de 14 bytes en base64, compatible
con `backend/payload.py`: `device_id`, `seq`, temperatura, humedad, pulsos de
lluvia, pulsos de viento, bateria y CRC-8/MAXIM.

## Uso

Levantar primero la infraestructura y el backend de ingesta:

```bash
cd infra
docker compose up -d
```

En otra terminal, ejecutar el backend con el mismo Application ID:

```bash
cd backend
set CHIRPSTACK_MQTT_BROKER=localhost:1883
set CHIRPSTACK_APP_ID=1
set INFLUXDB_URL=http://localhost:8086
set INFLUXDB_TOKEN=weather-station-token
set INFLUXDB_ORG=weather-station
set INFLUXDB_BUCKET=weather
uvicorn app:app --reload
```

Luego correr el mock:

```bash
cd firmware/gateway-mock
cargo run -- --app-id 1 --interval-seconds 15
```

Variables/flags utiles:

- `--broker localhost:1883` o `GATEWAY_MOCK_MQTT_BROKER`
- `--app-id 1` o `GATEWAY_MOCK_APP_ID` / `CHIRPSTACK_APP_ID`
- `--dev-eui 0000000000000002` o `GATEWAY_MOCK_DEV_EUI`
- `--device-id 2` o `GATEWAY_MOCK_DEVICE_ID`
- `--interval-seconds 15` o `GATEWAY_MOCK_INTERVAL_SECONDS`
- `--once` o `GATEWAY_MOCK_ONCE=true`

`--once` publica una sola lectura y termina; es util para pruebas rapidas.
