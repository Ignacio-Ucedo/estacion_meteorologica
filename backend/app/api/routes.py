from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas import (
    CurrentReading,
    DailyMetricResponse,
    DailySummary,
    HourlyMetricResponse,
    HourlyPoint,
    ReadingPage,
    ReadingResponse,
    StationCreate,
    StationDetail,
    StationPage,
    StationResponse,
)
from app.services.metrics import METRICS, daily_summaries, get_metric, hourly_points, utc_now
from app.services.stations import (
    create_station,
    get_station,
    latest_reading,
    list_stations,
    paginated_readings,
)

router = APIRouter()
SessionDep = Annotated[AsyncSession, Depends(get_session)]
PageQuery = Annotated[int, Query(ge=1)]
DaysQuery = Annotated[int, Query()]


@router.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/stations", response_model=StationResponse, status_code=status.HTTP_201_CREATED)
async def post_station(
    payload: StationCreate, session: SessionDep
) -> StationResponse:
    try:
        station = await create_station(session, payload)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Station already exists"
        ) from exc
    return StationResponse.model_validate(station, from_attributes=True)


@router.get("/stations", response_model=StationPage)
async def get_stations(
    session: SessionDep,
    page: PageQuery = 1,
    search: str | None = None,
) -> StationPage:
    total, stations = await list_stations(session, page, search)
    return StationPage(
        total=total,
        page=page,
        data=[StationResponse.model_validate(s, from_attributes=True) for s in stations],
    )


@router.get("/stations/{station_id}", response_model=StationDetail)
async def get_station_detail(
    station_id: str, session: SessionDep
) -> StationDetail:
    station = await get_station(session, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    reading = await latest_reading(session, station_id)
    current = None
    last_updated_at = None
    if reading is not None:
        last_updated_at = reading.timestamp
        current = CurrentReading(
            temperature=reading.temperature,
            humidity=reading.humidity,
            windSpeed=reading.wind_speed,
            windDirection=reading.wind_direction,
            precipitation=reading.precipitation,
        )
    return StationDetail(
        id=station.id,
        name=station.name,
        location=station.location,
        status=station.status,
        lastUpdatedAt=last_updated_at,
        current=current,
    )


@router.get("/stations/{station_id}/readings", response_model=ReadingPage)
async def get_readings(
    station_id: str,
    session: SessionDep,
    page: PageQuery = 1,
    search: str | None = None,
) -> ReadingPage:
    station = await get_station(session, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    total, rows = await paginated_readings(session, station_id, page, search)
    data = [
        ReadingResponse(
            id=reading.id,
            stationId=reading.station_id,
            stationName=station_name,
            timestamp=reading.timestamp,
            temperature=reading.temperature,
            humidity=reading.humidity,
            windSpeed=reading.wind_speed,
            precipitation=reading.precipitation,
        )
        for reading, station_name in rows
    ]
    return ReadingPage(total=total, page=page, data=data)


@router.get("/stations/{station_id}/metrics/{metric}/hourly", response_model=HourlyMetricResponse)
async def get_hourly_metric(
    station_id: str, metric: str, session: SessionDep
) -> HourlyMetricResponse:
    config = get_metric(metric)
    if config is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid metric")
    station = await get_station(session, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    points = await hourly_points(session, station_id, metric)
    return HourlyMetricResponse(
        metric=metric,
        unit=config.unit,
        date=utc_now().date(),
        points=[HourlyPoint(**point) for point in points],
    )


@router.get("/stations/{station_id}/metrics/{metric}/daily", response_model=DailyMetricResponse)
async def get_daily_metric(
    station_id: str,
    metric: str,
    session: SessionDep,
    days: DaysQuery = 7,
) -> DailyMetricResponse:
    config = METRICS.get(metric)
    if config is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid metric")
    if days not in {7, 30, 365}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid days parameter"
        )
    station = await get_station(session, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    summaries = await daily_summaries(session, station_id, metric, days)
    return DailyMetricResponse(
        metric=metric,
        unit=config.unit,
        days=days,
        summaries=[DailySummary(**summary) for summary in summaries],
    )
