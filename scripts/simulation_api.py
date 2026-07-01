"""In-memory API for the local weather-station simulation.

This is intentionally separate from the production REST backend. It lets the
React dashboard run while the hardware node is unavailable by listening to the
gateway mock MQTT uplinks and exposing the same `/api` shape used by the UI.
"""

from __future__ import annotations

import base64
import json
import math
import os
import sys
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from statistics import mean
from typing import Any

import paho.mqtt.client as mqtt
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from payload import PayloadError, WeatherReading, parse_and_validate  # noqa: E402


APP_ID = os.getenv("CHIRPSTACK_APP_ID", "1")
BROKER = os.getenv("CHIRPSTACK_MQTT_BROKER", "localhost:1883")
REFRESH_SECONDS = int(os.getenv("SIMULATION_REFRESH_SECONDS", "15"))
STATION_ID = "alpha"
STATION_NAME = "Estacion Mock"
STATION_LOCATION = "Laboratorio"
PAGE_SIZE = 7


@dataclass(frozen=True)
class StoredReading:
    id: str
    station_id: str
    station_name: str
    timestamp: datetime
    temperature: float
    humidity: float
    wind_speed: float
    precipitation: float
    wind_direction: str
    seq: int


_lock = threading.Lock()
_readings: list[StoredReading] = []
_seq = 10_000


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _to_reading_payload(reading: StoredReading) -> dict[str, Any]:
    return {
        "id": reading.id,
        "stationId": reading.station_id,
        "stationName": reading.station_name,
        "timestamp": _iso(reading.timestamp),
        "temperature": reading.temperature,
        "humidity": reading.humidity,
        "windSpeed": reading.wind_speed,
        "precipitation": reading.precipitation,
    }


def _station_summary() -> dict[str, str]:
    return {
        "id": STATION_ID,
        "name": STATION_NAME,
        "location": STATION_LOCATION,
        "status": "online",
    }


def _convert_weather_reading(reading: WeatherReading, timestamp: datetime) -> StoredReading:
    return StoredReading(
        id=f"mock-{reading.seq}",
        station_id=STATION_ID,
        station_name=STATION_NAME,
        timestamp=timestamp,
        temperature=reading.temp_c,
        humidity=reading.humidity_pct,
        wind_speed=round(reading.wind_pulses * 0.4, 1),
        precipitation=round(reading.rain_pulses * 0.2794, 2),
        wind_direction="NE",
        seq=reading.seq,
    )


def _append_reading(reading: StoredReading) -> None:
    with _lock:
        _readings.append(reading)
        _readings.sort(key=lambda item: item.timestamp, reverse=True)
        del _readings[500:]


def _latest_timestamp() -> datetime | None:
    with _lock:
        return _readings[0].timestamp if _readings else None


def _next_seq() -> int:
    global _seq
    with _lock:
        _seq += 1
        return _seq


def _seed_readings() -> None:
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    with _lock:
        if _readings:
            return

    for index in range(72):
        timestamp = now - timedelta(hours=72 - index)
        cycle = (index / 24) * math.tau
        reading = StoredReading(
            id=f"seed-{index}",
            station_id=STATION_ID,
            station_name=STATION_NAME,
            timestamp=timestamp,
            temperature=round(21.5 + math.sin(cycle) * 4.5, 2),
            humidity=round(62 - math.sin(cycle) * 12, 2),
            wind_speed=round(8 + math.cos(cycle) * 3.5, 1),
            precipitation=round(0.28 if index % 18 == 0 else 0, 2),
            wind_direction="NE",
            seq=index,
        )
        _append_reading(reading)


def _metric_value(reading: StoredReading, metric: str) -> float:
    values = {
        "temperature": reading.temperature,
        "humidity": reading.humidity,
        "windSpeed": reading.wind_speed,
        "precipitation": reading.precipitation,
    }
    if metric not in values:
        raise HTTPException(status_code=400, detail="Invalid metric")
    return values[metric]


def _metric_unit(metric: str) -> str:
    units = {
        "temperature": "C",
        "humidity": "%",
        "windSpeed": "km/h",
        "precipitation": "mm",
    }
    if metric not in units:
        raise HTTPException(status_code=400, detail="Invalid metric")
    return units[metric]


def _parse_event_time(event: dict[str, Any]) -> datetime:
    raw = event.get("time")
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(UTC)
        except ValueError:
            pass
    return datetime.now(UTC)


def _on_connect(client: mqtt.Client, userdata: Any, flags: Any, reason_code: Any, properties: Any) -> None:
    if reason_code == 0:
        client.subscribe(f"application/{APP_ID}/device/+/event/up")


def _on_message(client: mqtt.Client, userdata: Any, message: mqtt.MQTTMessage) -> None:
    try:
        event = json.loads(message.payload)
        raw = base64.b64decode(event.get("data", ""))
        parsed = parse_and_validate(raw)
    except (json.JSONDecodeError, PayloadError, ValueError):
        return

    _append_reading(_convert_weather_reading(parsed, _parse_event_time(event)))


def _mqtt_worker() -> None:
    host, port_raw = BROKER.rsplit(":", 1)
    printed_unavailable = False
    while True:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = _on_connect
        client.on_message = _on_message
        client.reconnect_delay_set(min_delay=1, max_delay=30)
        try:
            client.connect(host, int(port_raw), keepalive=60)
            client.loop_forever()
        except OSError as exc:
            if not printed_unavailable:
                print(f"simulation_api_mqtt_unavailable broker={BROKER} error={exc}")
                printed_unavailable = True
            time.sleep(3)


def _start_mqtt_listener() -> None:
    thread = threading.Thread(target=_mqtt_worker, daemon=True)
    thread.start()


def _fallback_generator() -> None:
    while True:
        time.sleep(REFRESH_SECONDS)
        latest = _latest_timestamp()
        if latest and datetime.now(UTC) - latest < timedelta(seconds=REFRESH_SECONDS + 3):
            continue

        seq = _next_seq()
        now = datetime.now(UTC)
        cycle = (seq / 24) * math.tau
        reading = StoredReading(
            id=f"live-{seq}",
            station_id=STATION_ID,
            station_name=STATION_NAME,
            timestamp=now,
            temperature=round(21.5 + math.sin(cycle) * 4.5, 2),
            humidity=round(62 - math.sin(cycle) * 12, 2),
            wind_speed=round(8 + math.cos(cycle) * 3.5, 1),
            precipitation=round(0.28 if seq % 18 == 0 else 0, 2),
            wind_direction="NE",
            seq=seq,
        )
        _append_reading(reading)


def _start_fallback_generator() -> None:
    thread = threading.Thread(target=_fallback_generator, daemon=True)
    thread.start()


_seed_readings()
_start_mqtt_listener()
_start_fallback_generator()

app = FastAPI(title="WeatherOS Simulation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/stations")
async def stations(page: int = Query(1, ge=1), search: str | None = None) -> dict[str, Any]:
    station = _station_summary()
    if search and search.lower() not in station["name"].lower():
        return {"total": 0, "page": page, "data": []}
    return {"total": 1, "page": page, "data": [station] if page == 1 else []}


@app.get("/api/stations/{station_id}")
async def station_detail(station_id: str) -> dict[str, Any]:
    if station_id != STATION_ID:
        raise HTTPException(status_code=404, detail="Station not found")
    with _lock:
        latest = _readings[0] if _readings else None

    station = _station_summary()
    station["lastUpdatedAt"] = _iso(latest.timestamp) if latest else None
    station["current"] = (
        {
            "temperature": latest.temperature,
            "humidity": latest.humidity,
            "windSpeed": latest.wind_speed,
            "windDirection": latest.wind_direction,
            "precipitation": latest.precipitation,
        }
        if latest
        else None
    )
    return station


@app.get("/api/stations/{station_id}/readings")
async def readings(station_id: str, page: int = Query(1, ge=1), search: str | None = None) -> dict[str, Any]:
    if station_id != STATION_ID:
        raise HTTPException(status_code=404, detail="Station not found")

    with _lock:
        rows = list(_readings)
    if search:
        rows = [row for row in rows if search.lower() in row.station_name.lower()]

    start = (page - 1) * PAGE_SIZE
    data = rows[start : start + PAGE_SIZE]
    return {"total": len(rows), "page": page, "data": [_to_reading_payload(row) for row in data]}


@app.get("/api/stations/{station_id}/metrics/{metric}/hourly")
async def hourly_metric(station_id: str, metric: str) -> dict[str, Any]:
    if station_id != STATION_ID:
        raise HTTPException(status_code=404, detail="Station not found")
    unit = _metric_unit(metric)
    today = datetime.now(UTC).date()

    with _lock:
        rows = [row for row in _readings if row.timestamp.date() == today]

    points = []
    for hour in range(25):
        values = [_metric_value(row, metric) for row in rows if row.timestamp.hour == hour]
        points.append({"hour": hour, "value": round(mean(values), 2) if values else None})

    return {"metric": metric, "unit": unit, "date": today.isoformat(), "points": points}


@app.get("/api/stations/{station_id}/metrics/{metric}/daily")
async def daily_metric(station_id: str, metric: str, days: int = 7) -> dict[str, Any]:
    if station_id != STATION_ID:
        raise HTTPException(status_code=404, detail="Station not found")
    if days not in {7, 30, 365}:
        raise HTTPException(status_code=400, detail="Invalid days parameter")
    unit = _metric_unit(metric)
    today = datetime.now(UTC).date()

    with _lock:
        rows = list(_readings)

    summaries = []
    for offset in range(days - 1, -1, -1):
        date = today - timedelta(days=offset)
        values = [_metric_value(row, metric) for row in rows if row.timestamp.date() == date]
        value = round(mean(values), 2) if values else 0
        summaries.append(
            {
                "date": date.isoformat(),
                "dayLabel": date.strftime("%d"),
                "dateLabel": date.strftime("%d/%m"),
                "monthLabel": date.strftime("%b"),
                "isMonthStart": date.day == 1,
                "min": round(min(values), 2) if values else value,
                "max": round(max(values), 2) if values else value,
                "mean": value,
            }
        )

    return {"metric": metric, "unit": unit, "days": days, "summaries": summaries}
