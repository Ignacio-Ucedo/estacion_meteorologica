import logging
from datetime import UTC, datetime, timedelta

from influxdb_client import Point, WritePrecision

from app.config import get_settings
from app.services.influx import query, write

log = logging.getLogger("weather-backend.stations")


def _station_id_for_eui(dev_eui: str) -> str:
    return f"dev-{dev_eui[:8].lower()}"


def _battery_pct(mv: float | None) -> float | None:
    if mv is None:
        return None
    pct = (float(mv) - 3300.0) / 900.0 * 100.0
    return round(max(0.0, min(100.0, pct)), 1)


def effective_status(ts: datetime | None, threshold_s: int) -> str:
    if ts is None:
        return "offline"
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return "online" if datetime.now(UTC) - ts <= timedelta(seconds=threshold_s) else "offline"


def ensure_station(dev_eui: str) -> None:
    """Write station_meta for dev_eui if none exists. Idempotente."""
    s = get_settings()
    existing = query(f'''from(bucket: "{s.influxdb_bucket}")
  |> range(start: -3650d)
  |> filter(fn: (r) => r._measurement == "station_meta" and r.dev_eui == "{dev_eui}")
  |> first()
  |> limit(n: 1)''')
    if existing:
        return

    station_id = _station_id_for_eui(dev_eui)
    point = (
        Point("station_meta")
        .tag("dev_eui", dev_eui)
        .tag("station_id", station_id)
        .field("name", f"Auto {dev_eui[:8]}")
        .field("location", "Unknown")
        .time(datetime.now(UTC), WritePrecision.NS)
    )
    try:
        write(point)
        log.info("station_created dev_eui=%s station_id=%s", dev_eui, station_id)
    except Exception as e:
        log.error("station_create_error dev_eui=%s error=%s", dev_eui, e)


def list_stations() -> list[dict]:
    s = get_settings()
    meta_rows = query(f'''from(bucket: "{s.influxdb_bucket}")
  |> range(start: -3650d)
  |> filter(fn: (r) => r._measurement == "station_meta")
  |> last()''')

    # Last battery_mv per dev_eui for status + battery level
    reading_rows = query(f'''from(bucket: "{s.influxdb_bucket}")
  |> range(start: -3650d)
  |> filter(fn: (r) => r._measurement == "weather_reading" and r._field == "battery_mv")
  |> last()''')

    last_readings: dict[str, dict] = {}
    for row in reading_rows:
        eui = row.get("dev_eui", "")
        if eui:
            last_readings[eui] = {"battery_mv": row.get("_value"), "ts": row.get("_time")}

    by_eui: dict[str, dict] = {}
    for row in meta_rows:
        eui = row.get("dev_eui", "")
        if not eui:
            continue
        if eui not in by_eui:
            by_eui[eui] = {
                "id": row.get("station_id", _station_id_for_eui(eui)),
                "dev_eui": eui,
                "name": f"Auto {eui[:8]}",
                "location": "Unknown",
            }
        field = row.get("_field")
        if field in ("name", "location"):
            by_eui[eui][field] = str(row.get("_value", ""))

    threshold = s.station_offline_threshold_seconds
    result = []
    for eui, meta in by_eui.items():
        lr = last_readings.get(eui, {})
        meta["battery_level"] = _battery_pct(lr.get("battery_mv"))
        meta["status"] = effective_status(lr.get("ts"), threshold)
        result.append(meta)
    return result


def get_station(station_id: str) -> dict | None:
    s = get_settings()
    rows = query(f'''from(bucket: "{s.influxdb_bucket}")
  |> range(start: -3650d)
  |> filter(fn: (r) => r._measurement == "station_meta" and r.station_id == "{station_id}")
  |> last()''')
    if not rows:
        return None
    dev_eui = rows[0].get("dev_eui", "")
    meta: dict = {
        "id": station_id,
        "dev_eui": dev_eui,
        "name": f"Auto {dev_eui[:8]}",
        "location": "Unknown",
    }
    for row in rows:
        field = row.get("_field")
        if field in ("name", "location"):
            meta[field] = str(row.get("_value", ""))
    return meta


def latest_reading(dev_eui: str) -> dict | None:
    s = get_settings()
    rows = query(f'''from(bucket: "{s.influxdb_bucket}")
  |> range(start: -3650d)
  |> filter(fn: (r) => r._measurement == "weather_reading" and r.dev_eui == "{dev_eui}")
  |> last()''')
    if not rows:
        return None

    ts = rows[0].get("_time")
    raw: dict = {}
    for row in rows:
        field = row.get("_field")
        if field:
            raw[field] = row.get("_value")

    k_wind = s.sensor_k_wind
    k_rain = s.sensor_k_rain
    return {
        "timestamp": ts,
        "temperature": float(raw.get("temp_c", 0)),
        "humidity": float(raw.get("humidity_pct", 0)),
        "wind_speed": float(raw.get("wind_pulses", 0)) * k_wind,
        "precipitation": float(raw.get("rain_pulses", 0)) * k_rain,
        "battery_mv": int(raw.get("battery_mv") or 0),
        "battery_level": _battery_pct(raw.get("battery_mv")),
        "seq": int(raw.get("seq") or 0),
    }
