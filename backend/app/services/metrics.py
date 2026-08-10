from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from app.config import get_settings
from app.services.influx import query


@dataclass(frozen=True)
class MetricConfig:
    field: str   # campo en weather_reading (InfluxDB)
    unit: str


METRICS: dict[str, MetricConfig] = {
    "temperature": MetricConfig("temp_c", "°C"),
    "humidity": MetricConfig("humidity_pct", "%"),
    "windSpeed": MetricConfig("wind_pulses", "m/s"),
    "precipitation": MetricConfig("rain_pulses", "mm"),
}


def get_metric(metric: str) -> MetricConfig | None:
    return METRICS.get(metric)


def _scale_for(metric: str) -> float:
    s = get_settings()
    if metric == "windSpeed":
        return s.sensor_k_wind
    if metric == "precipitation":
        return s.sensor_k_rain
    return 1.0


def utc_now() -> datetime:
    return datetime.now(UTC)


def get_recent_metric(dev_eui: str, metric: str, minutes: int) -> list[dict]:
    config = METRICS[metric]
    s = get_settings()
    flux = f'''from(bucket: "{s.influxdb_bucket}")
  |> range(start: -{minutes}m)
  |> filter(fn: (r) => r._measurement == "weather_reading" and r.dev_eui == "{dev_eui}"
      and (r._field == "{config.field}" or r._field == "seq"))
  |> pivot(rowKey: ["_time", "dev_eui"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])'''
    rows = query(flux)
    scale = _scale_for(metric)
    result = []
    for row in rows:
        raw_val = row.get(config.field)
        if raw_val is None:
            continue
        seq_raw = row.get("seq")
        result.append({
            "timestamp": row.get("_time"),
            "value": float(raw_val) * scale,
            "seq": int(seq_raw) if seq_raw is not None else None,
        })
    return result


def hourly_points(dev_eui: str, metric: str, target_date: date | None = None) -> list[dict]:
    config = METRICS[metric]
    s = get_settings()
    day = target_date or utc_now().date()
    start = datetime.combine(day, time.min, tzinfo=UTC).isoformat()
    stop = datetime.combine(day + timedelta(days=1), time.min, tzinfo=UTC).isoformat()
    flux = f'''from(bucket: "{s.influxdb_bucket}")
  |> range(start: {start}, stop: {stop})
  |> filter(fn: (r) => r._measurement == "weather_reading" and r.dev_eui == "{dev_eui}"
      and r._field == "{config.field}")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: true)'''
    rows = query(flux)
    scale = _scale_for(metric)
    by_hour: dict[int, float | None] = {}
    for row in rows:
        ts = row.get("_time")
        val = row.get("_value")
        if isinstance(ts, datetime):
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
            by_hour[ts.hour] = float(val) * scale if val is not None else None
    return [{"hour": h, "value": by_hour.get(h)} for h in range(25)]


def daily_summaries(dev_eui: str, metric: str, days: int) -> list[dict]:
    config = METRICS[metric]
    s = get_settings()
    flux = f'''
data = from(bucket: "{s.influxdb_bucket}")
  |> range(start: -{days}d)
  |> filter(fn: (r) => r._measurement == "weather_reading" and r.dev_eui == "{dev_eui}"
      and r._field == "{config.field}")

data |> aggregateWindow(every: 1d, fn: mean, createEmpty: false) |> yield(name: "mean")
data |> aggregateWindow(every: 1d, fn: min, createEmpty: false) |> yield(name: "min")
data |> aggregateWindow(every: 1d, fn: max, createEmpty: false) |> yield(name: "max")
'''
    rows = query(flux)
    scale = _scale_for(metric)

    by_date: dict[date, dict] = {}
    for row in rows:
        ts = row.get("_time")
        val = row.get("_value")
        agg = row.get("result", "mean")
        if not isinstance(ts, datetime):
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        d = ts.date()
        if d not in by_date:
            by_date[d] = {}
        if val is not None:
            by_date[d][agg] = float(val) * scale

    last_day = utc_now().date()
    first_day = last_day - timedelta(days=days - 1)
    result = []
    for offset in range(days):
        current = first_day + timedelta(days=offset)
        stats = by_date.get(current, {})
        result.append({
            "date": current,
            "day_label": current.strftime("%a"),
            "date_label": f"{current.day} {current.strftime('%b').lower()}",
            "month_label": current.strftime("%b"),
            "is_month_start": current.day == 1,
            "min": stats.get("min"),
            "max": stats.get("max"),
            "mean": stats.get("mean"),
        })
    return result
