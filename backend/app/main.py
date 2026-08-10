import base64
import json
import logging
import threading
from datetime import UTC, datetime

import paho.mqtt.client as mqtt
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from influxdb_client import Point, WritePrecision

from app.config import get_settings
from app.services.influx import get_write_api

log = logging.getLogger("weather-backend")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# --- MQTT state ---
_mqtt_client: mqtt.Client | None = None
_mqtt_connected: bool = False
_last_msg_at: datetime | None = None


# --- MQTT callbacks ---

def on_connect(client, userdata, flags, reason_code, properties):
    global _mqtt_connected
    s = get_settings()
    topic = f"application/{s.chirpstack_app_id}/device/+/event/up"
    if reason_code == 0:
        _mqtt_connected = True
        client.subscribe(topic, qos=1)
        log.info("mqtt_connected broker=%s topic=%s", s.chirpstack_mqtt_broker, topic)
    else:
        log.error("mqtt_connect_failed reason=%s", reason_code)


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    global _mqtt_connected
    _mqtt_connected = False
    log.warning("mqtt_disconnected reason=%s — reconnecting automatically", reason_code)


def on_message(client, userdata, message):
    """Procesa un evento `up` de ChirpStack, escribe en InfluxDB."""
    global _last_msg_at

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

    from payload import PayloadError, parse_and_validate  # noqa: PLC0415
    try:
        reading = parse_and_validate(raw)
    except PayloadError as e:
        log.error("payload_invalid dev_eui=%s error=%s raw_hex=%s", dev_eui, e, raw.hex())
        return

    ts_str = event.get("time")
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            ts = datetime.now(tz=UTC)
    else:
        ts = datetime.now(tz=UTC)

    s = get_settings()
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
        .time(ts, WritePrecision.NS)
    )
    try:
        get_write_api().write(bucket=s.influxdb_bucket, org=s.influxdb_org, record=point)
        _last_msg_at = datetime.now(tz=UTC)
        log.info(
            "influx_write_ok dev_eui=%s seq=%d temp_c=%.2f hum=%.2f rain=%d wind=%d",
            dev_eui, reading.seq, reading.temp_c, reading.humidity_pct,
            reading.rain_pulses, reading.wind_pulses,
        )
    except Exception as e:
        log.error("influx_write_error dev_eui=%s error=%s", dev_eui, e)

    # Crear registro de estación en InfluxDB si aún no existe
    try:
        from app.services.stations import ensure_station  # noqa: PLC0415
        ensure_station(dev_eui)
    except Exception as e:
        log.error("ensure_station_error dev_eui=%s error=%s", dev_eui, e)


def _build_mqtt_client() -> mqtt.Client:
    s = get_settings()
    host, port_str = s.chirpstack_mqtt_broker.split(":", 1)
    port = int(port_str)

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="weather-backend",
        clean_session=False,
    )
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    client.reconnect_delay_set(min_delay=1, max_delay=30)
    client.connect(host, port, keepalive=60)
    return client


# --- FastAPI app ---

def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "https://ignacio-ucedo.github.io",
            "http://localhost:1420",
            "tauri://localhost",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.api.routes import router as api_router  # noqa: PLC0415
    app.include_router(api_router, prefix="/api")

    @app.on_event("startup")
    def startup_mqtt():
        global _mqtt_client
        s = get_settings()
        if not s.chirpstack_app_id:
            log.warning("CHIRPSTACK_APP_ID no configurado — MQTT no iniciado")
            return
        log.info("mqtt_startup broker=%s", s.chirpstack_mqtt_broker)
        _mqtt_client = _build_mqtt_client()
        thread = threading.Thread(target=_mqtt_client.loop_forever, daemon=True)
        thread.start()
        log.info("mqtt_loop_started client_id=weather-backend clean_session=False")

    @app.on_event("shutdown")
    def shutdown_mqtt():
        if _mqtt_client:
            _mqtt_client.disconnect()

    @app.get("/health")
    def health():
        s = get_settings()
        now = datetime.now(tz=UTC)
        last_ago: float | None = None
        if _last_msg_at is not None:
            last_ago = (now - _last_msg_at).total_seconds()

        mqtt_status = "connected" if _mqtt_connected else "disconnected"
        degraded = (
            not _mqtt_connected
            or (last_ago is not None and last_ago > s.health_mqtt_stale_seconds)
        )
        return {
            "status": "degraded" if degraded else "ok",
            "mqtt": mqtt_status,
            "last_msg_ago_s": last_ago,
        }

    return app


app = create_app()
