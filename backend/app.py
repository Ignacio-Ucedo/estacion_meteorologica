"""Backend FastAPI: ingesta de uplinks LoRaWAN desde ChirpStack vía MQTT → InfluxDB.

Variables de entorno requeridas:
  CHIRPSTACK_MQTT_BROKER  host:port del broker Mosquitto  (default: localhost:1883)
  CHIRPSTACK_APP_ID       Application ID en ChirpStack   (requerido)
  INFLUXDB_URL            URL de InfluxDB                 (default: http://localhost:8086)
  INFLUXDB_TOKEN          Token de autenticación          (default: weather-station-token)
  INFLUXDB_ORG            Organización InfluxDB           (default: weather-station)
  INFLUXDB_BUCKET         Bucket destino                  (default: weather)
"""

import base64
import json
import logging
import os
import threading
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
from fastapi import FastAPI
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from payload import PayloadError, parse_and_validate

# --- Configuración desde entorno ---
MQTT_BROKER = os.getenv("CHIRPSTACK_MQTT_BROKER", "localhost:1883")
CHIRPSTACK_APP_ID = os.getenv("CHIRPSTACK_APP_ID", "")
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "weather-station-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "weather-station")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "weather")

# Topic MQTT de ChirpStack para uplinks:
# application/{appId}/device/{devEUI}/event/up
# Se usa wildcard para escuchar todos los dispositivos de la application.
MQTT_TOPIC = f"application/{CHIRPSTACK_APP_ID}/device/+/event/up"

log = logging.getLogger("weather-backend")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# --- Clientes globales ---
_influx_client: InfluxDBClient | None = None
_write_api = None


def get_write_api():
    global _influx_client, _write_api
    if _influx_client is None:
        _influx_client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        _write_api = _influx_client.write_api(write_options=SYNCHRONOUS)
    return _write_api


# --- MQTT callbacks ---

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        log.info("mqtt_connected broker=%s topic=%s", MQTT_BROKER, MQTT_TOPIC)
        client.subscribe(MQTT_TOPIC)
    else:
        log.error("mqtt_connect_failed reason=%s", reason_code)


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    log.warning("mqtt_disconnected reason=%s — reconnecting automatically", reason_code)


def on_message(client, userdata, message):
    """Procesa un evento `up` de ChirpStack."""
    try:
        event = json.loads(message.payload)
    except json.JSONDecodeError as e:
        log.error("mqtt_json_parse_error=%s", e)
        return

    dev_eui = event.get("deviceInfo", {}).get("devEui", "unknown")
    data_b64 = event.get("data", "")

    if not data_b64:
        log.warning("uplink_no_data dev_eui=%s", dev_eui)
        return

    try:
        raw = base64.b64decode(data_b64)
    except Exception as e:
        log.error("base64_decode_error dev_eui=%s error=%s", dev_eui, e)
        return

    # --- Task 4.2: validar payload binario y CRC-8 ---
    try:
        reading = parse_and_validate(raw)
    except PayloadError as e:
        log.error("payload_invalid dev_eui=%s error=%s raw_hex=%s", dev_eui, e, raw.hex())
        return  # descartar — no escribir en InfluxDB

    # Timestamp: preferir el del evento ChirpStack, fallback a now
    ts_str = event.get("time", None)
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            ts = datetime.now(tz=timezone.utc)
    else:
        ts = datetime.now(tz=timezone.utc)

    # --- Task 4.3: escribir en InfluxDB ---
    point = (
        Point("weather_reading")
        .tag("device_id", str(reading.device_id))
        .tag("dev_eui", dev_eui)
        .field("temp_c", reading.temp_c)
        .field("humidity_pct", reading.humidity_pct)
        .field("rain_pulses", reading.rain_pulses)
        .field("wind_pulses", reading.wind_pulses)
        .field("battery_mv", reading.battery_mv)
        .field("seq", reading.seq)
        .time(ts, WritePrecision.NANOSECONDS)
    )

    try:
        get_write_api().write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=point)
        log.info(
            "influx_write_ok dev_eui=%s seq=%d temp_c=%.2f hum=%.2f rain=%d wind=%d",
            dev_eui, reading.seq, reading.temp_c, reading.humidity_pct,
            reading.rain_pulses, reading.wind_pulses,
        )
    except Exception as e:
        # Task 4.4: error de escritura InfluxDB → registrar y continuar
        log.error("influx_write_error dev_eui=%s error=%s", dev_eui, e)


# --- MQTT client ---

def _build_mqtt_client() -> mqtt.Client:
    host, port_str = MQTT_BROKER.split(":", 1)
    port = int(port_str)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    # Reconexión automática (paho-mqtt v2)
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    client.connect(host, port, keepalive=60)
    return client


# --- FastAPI app ---

app = FastAPI(title="Weather Station Backend", version="1.0.0")

_mqtt_client: mqtt.Client | None = None


@app.on_event("startup")
def startup_event():
    global _mqtt_client

    if not CHIRPSTACK_APP_ID:
        log.warning("CHIRPSTACK_APP_ID no configurado — MQTT no iniciado")
        return

    log.info("mqtt_startup broker=%s topic=%s", MQTT_BROKER, MQTT_TOPIC)
    _mqtt_client = _build_mqtt_client()

    # Ejecutar el loop MQTT en un thread separado para no bloquear FastAPI
    thread = threading.Thread(target=_mqtt_client.loop_forever, daemon=True)
    thread.start()
    log.info("mqtt_loop_started")


@app.on_event("shutdown")
def shutdown_event():
    if _mqtt_client:
        _mqtt_client.disconnect()
    if _influx_client:
        _influx_client.close()


@app.get("/health")
def health():
    return {"status": "ok"}
