import logging
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.models import Reading, Station
from payload import WeatherReading

log = logging.getLogger("weather-backend.ingestion")


def map_reading(raw: WeatherReading, settings: Settings) -> dict:
    # battery_mv → % using linear curve: 3300 mV = 0%, 4200 mV = 100%
    battery_level = round(max(0.0, min(100.0, (raw.battery_mv - 3300) / 9.0)), 1)
    return {
        "temperature": raw.temp_c,
        "humidity": raw.humidity_pct,
        "wind_speed": round(raw.wind_pulses * settings.sensor_k_wind, 2),
        "wind_direction": "N/A",
        "precipitation": round(raw.rain_pulses * settings.sensor_k_rain, 4),
        "battery_level": battery_level,
    }


async def ensure_station(session: AsyncSession, dev_eui: str) -> Station:
    short = dev_eui[:8].lower()
    station_id = f"dev-{short}"
    station = await session.get(Station, station_id)
    if station is not None:
        return station
    station = Station(
        id=station_id,
        name=f"Auto {short}",
        location="Unknown",
        status="online",
    )
    session.add(station)
    try:
        await session.flush()
        log.info("station_auto_created dev_eui=%s id=%s", dev_eui, station_id)
    except IntegrityError:
        await session.rollback()
        station = await session.get(Station, station_id)
    return station


async def persist_uplink(
    session: AsyncSession,
    dev_eui: str,
    fields: dict,
    timestamp: datetime,
) -> None:
    station = await ensure_station(session, dev_eui)
    reading = Reading(
        station_id=station.id,
        timestamp=timestamp,
        **fields,
    )
    session.add(reading)
    await session.commit()
    log.info(
        "reading_persisted dev_eui=%s temp=%.2f hum=%.2f wind=%.2f rain=%.4f",
        dev_eui,
        fields["temperature"],
        fields["humidity"],
        fields["wind_speed"],
        fields["precipitation"],
    )
