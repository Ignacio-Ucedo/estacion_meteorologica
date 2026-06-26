from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Reading


@dataclass(frozen=True)
class MetricConfig:
    column_name: str
    unit: str


METRICS: dict[str, MetricConfig] = {
    "temperature": MetricConfig("temperature", "C"),
    "humidity": MetricConfig("humidity", "%"),
    "windSpeed": MetricConfig("wind_speed", "km/h"),
    "precipitation": MetricConfig("precipitation", "mm"),
}


def get_metric(metric: str) -> MetricConfig | None:
    return METRICS.get(metric)


def utc_now() -> datetime:
    return datetime.now(UTC)


async def hourly_points(
    session: AsyncSession,
    station_id: str,
    metric: str,
    target_date: date | None = None,
) -> list[dict[str, float | int | None]]:
    config = METRICS[metric]
    day = target_date or utc_now().date()
    start = datetime.combine(day, time.min, tzinfo=UTC)
    end = start + timedelta(days=1)
    column = getattr(Reading, config.column_name)
    result = await session.execute(
        select(Reading.timestamp, column)
        .where(Reading.station_id == station_id)
        .where(Reading.timestamp >= start)
        .where(Reading.timestamp <= end)
        .order_by(Reading.timestamp.asc())
    )
    values: dict[int, float] = {}
    for timestamp, value in result.all():
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        values[timestamp.hour] = float(value)
    return [{"hour": hour, "value": values.get(hour)} for hour in range(25)]


async def daily_summaries(
    session: AsyncSession,
    station_id: str,
    metric: str,
    days: int,
    end_date: date | None = None,
) -> list[dict[str, object]]:
    config = METRICS[metric]
    last_day = end_date or utc_now().date()
    first_day = last_day - timedelta(days=days - 1)
    start = datetime.combine(first_day, time.min, tzinfo=UTC)
    end = datetime.combine(last_day + timedelta(days=1), time.min, tzinfo=UTC)
    column = getattr(Reading, config.column_name)
    result = await session.execute(
        select(Reading.timestamp, column)
        .where(Reading.station_id == station_id)
        .where(Reading.timestamp >= start)
        .where(Reading.timestamp < end)
    )
    rows = result.all()
    frame = pd.DataFrame(rows, columns=["timestamp", "value"])
    if not frame.empty:
        frame["date"] = pd.to_datetime(frame["timestamp"], utc=True).dt.date
        grouped = frame.groupby("date")["value"].agg(["min", "max", "mean"])
    else:
        grouped = pd.DataFrame(columns=["min", "max", "mean"])

    summaries: list[dict[str, object]] = []
    for offset in range(days):
        current = first_day + timedelta(days=offset)
        stats = grouped.loc[current] if current in grouped.index else None
        summaries.append(
            {
                "date": current,
                "day_label": current.strftime("%a"),
                "date_label": f"{current.day} {current.strftime('%b').lower()}",
                "month_label": current.strftime("%b"),
                "is_month_start": current.day == 1,
                "min": None if stats is None else float(stats["min"]),
                "max": None if stats is None else float(stats["max"]),
                "mean": None if stats is None else float(stats["mean"]),
            }
        )
    return summaries

