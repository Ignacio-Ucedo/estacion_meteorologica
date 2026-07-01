import asyncio
import base64
import json
import logging
import threading
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from app.config import get_settings
from app.db.session import SessionLocal
from app.services.ingestion import map_reading, persist_uplink
from payload import PayloadError, parse_and_validate

log = logging.getLogger("weather-backend.mqtt")

_loop: asyncio.AbstractEventLoop | None = None
_client: mqtt.Client | None = None


def on_connect(client, userdata, flags, reason_code, properties):
    settings = get_settings()
    topic = f"application/{settings.chirpstack_app_id}/device/+/event/up"
    if reason_code == 0:
        log.info("mqtt_connected broker=%s topic=%s", settings.chirpstack_mqtt_broker, topic)
        client.subscribe(topic)
    else:
        log.error("mqtt_connect_failed reason=%s", reason_code)


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    log.warning("mqtt_disconnected reason=%s — reconnecting automatically", reason_code)


def on_message(client, userdata, message):
    try:
        event = json.loads(message.payload)
    except json.JSONDecodeError as exc:
        log.error("mqtt_json_parse_error=%s", exc)
        return

    dev_eui = event.get("deviceInfo", {}).get("devEui", "unknown")
    data_b64 = event.get("data", "")
    if not data_b64:
        log.warning("uplink_no_data dev_eui=%s", dev_eui)
        return

    try:
        raw = base64.b64decode(data_b64)
    except Exception as exc:
        log.error("base64_decode_error dev_eui=%s error=%s", dev_eui, exc)
        return

    try:
        reading = parse_and_validate(raw)
    except PayloadError as exc:
        log.error("payload_invalid dev_eui=%s error=%s raw_hex=%s", dev_eui, exc, raw.hex())
        return

    ts_str = event.get("time")
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            ts = datetime.now(tz=timezone.utc)
    else:
        ts = datetime.now(tz=timezone.utc)

    settings = get_settings()
    fields = map_reading(reading, settings)

    if _loop is None:
        log.warning("event_loop_not_available dev_eui=%s — dropping uplink", dev_eui)
        return

    future = asyncio.run_coroutine_threadsafe(_write(dev_eui, fields, ts), _loop)
    try:
        future.result(timeout=10)
    except Exception as exc:
        log.error("persist_error dev_eui=%s error=%s", dev_eui, exc)


async def _write(dev_eui: str, fields: dict, ts: datetime) -> None:
    async with SessionLocal() as session:
        await persist_uplink(session, dev_eui, fields, ts)


def start(loop: asyncio.AbstractEventLoop) -> mqtt.Client:
    global _loop, _client
    _loop = loop
    settings = get_settings()
    log.info("mqtt_startup broker=%s", settings.chirpstack_mqtt_broker)
    host, port_str = settings.chirpstack_mqtt_broker.split(":", 1)
    _client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    _client.on_connect = on_connect
    _client.on_disconnect = on_disconnect
    _client.on_message = on_message
    _client.reconnect_delay_set(min_delay=1, max_delay=30)
    _client.connect(host, int(port_str), keepalive=60)
    thread = threading.Thread(target=_client.loop_forever, daemon=True)
    thread.start()
    log.info("mqtt_loop_started")
    return _client


def stop() -> None:
    if _client:
        _client.disconnect()
