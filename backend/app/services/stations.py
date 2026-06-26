import re
from datetime import UTC

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Reading, Station
from app.schemas import StationCreate

PAGE_SIZE = 7


def slugify_station_id(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "station"


async def get_station(session: AsyncSession, station_id: str) -> Station | None:
    return await session.get(Station, station_id)


async def create_station(session: AsyncSession, payload: StationCreate) -> Station:
    station = Station(
        id=slugify_station_id(payload.name),
        name=payload.name,
        location=payload.location,
        status=payload.status,
    )
    session.add(station)
    await session.commit()
    await session.refresh(station)
    return station


async def list_stations(session: AsyncSession) -> list[Station]:
    result = await session.execute(select(Station).order_by(Station.name.asc()))
    return list(result.scalars().all())


async def latest_reading(session: AsyncSession, station_id: str) -> Reading | None:
    result = await session.execute(
        select(Reading)
        .where(Reading.station_id == station_id)
        .order_by(Reading.timestamp.desc())
        .limit(1)
    )
    reading = result.scalar_one_or_none()
    if reading and reading.timestamp.tzinfo is None:
        reading.timestamp = reading.timestamp.replace(tzinfo=UTC)
    return reading


def readings_query(station_id: str, search: str | None = None) -> Select[tuple[Reading, str]]:
    query = (
        select(Reading, Station.name)
        .join(Station, Reading.station_id == Station.id)
        .where(Reading.station_id == station_id)
    )
    if search:
        query = query.where(func.lower(Station.name).contains(search.lower()))
    return query


async def paginated_readings(
    session: AsyncSession, station_id: str, page: int, search: str | None = None
) -> tuple[int, list[tuple[Reading, str]]]:
    base = readings_query(station_id, search)
    total = await session.scalar(select(func.count()).select_from(base.subquery()))
    result = await session.execute(
        base.order_by(Reading.timestamp.desc()).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE)
    )
    return int(total or 0), list(result.all())

