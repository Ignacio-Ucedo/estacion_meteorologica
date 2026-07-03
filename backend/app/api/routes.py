from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas import (
    CurrentReading,
    DailyMetricResponse,
    DailySummary,
    HourlyMetricResponse,
    HourlyPoint,
    MetricPoint,
    ReadingPage,
    ReadingResponse,
    RecentMetricResponse,
    StationCreate,
    StationDetail,
    StationPage,
    StationResponse,
)
from app.config import get_settings
from app.services.metrics import METRICS, daily_summaries, get_metric, get_recent_metric, hourly_points, utc_now
from app.services.stations import (
    create_station,
    delete_station_readings,
    get_station,
    latest_reading,
    list_stations,
    paginated_readings,
)

router = APIRouter()
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _user_id_from_request(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ")
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("user_id")
    except jwt.PyJWTError:
        return None


def effective_status(last_ts: datetime | None, threshold_seconds: int) -> str:
    if last_ts is None:
        return "offline"
    if last_ts.tzinfo is None:
        last_ts = last_ts.replace(tzinfo=UTC)
    if datetime.now(UTC) - last_ts > timedelta(seconds=threshold_seconds):
        return "offline"
    return "online"
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
    request: Request,
    session: SessionDep,
    page: PageQuery = 1,
    search: str | None = None,
) -> StationPage:
    threshold = get_settings().station_offline_threshold_seconds
    user_id = _user_id_from_request(request)
    total, rows = await list_stations(session, page, search, user_id=user_id)
    return StationPage(
        total=total,
        page=page,
        data=[
            StationResponse(
                id=s.id,
                name=s.name,
                location=s.location,
                status=effective_status(last_ts, threshold),
                batteryLevel=battery,
            )
            for s, battery, last_ts in rows
        ],
    )


@router.patch("/stations/{station_id}/owner", response_model=StationResponse)
async def patch_station_owner(
    station_id: str, body: dict, session: SessionDep
) -> StationResponse:
    station = await get_station(session, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    station.user_id = body.get("user_id")
    await session.commit()
    await session.refresh(station)
    return StationResponse.model_validate(station, from_attributes=True)


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
    battery_level = None
    if reading is not None:
        last_updated_at = reading.timestamp
        battery_level = reading.battery_level
        current = CurrentReading(
            temperature=reading.temperature,
            humidity=reading.humidity,
            windSpeed=reading.wind_speed,
            windDirection=reading.wind_direction,
            precipitation=reading.precipitation,
            batteryLevel=reading.battery_level,
        )
    threshold = get_settings().station_offline_threshold_seconds
    return StationDetail(
        id=station.id,
        name=station.name,
        location=station.location,
        status=effective_status(last_updated_at, threshold),
        batteryLevel=battery_level,
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
            batteryLevel=reading.battery_level,
        )
        for reading, station_name in rows
    ]
    return ReadingPage(total=total, page=page, data=data)


@router.delete("/stations/{station_id}/readings", status_code=status.HTTP_200_OK)
async def delete_readings(station_id: str, session: SessionDep) -> dict[str, int]:
    station = await get_station(session, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    deleted = await delete_station_readings(session, station_id)
    return {"deleted": deleted}


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


@router.get("/stations/{station_id}/metrics/{metric}/recent", response_model=RecentMetricResponse)
async def get_recent_metric_endpoint(
    station_id: str,
    metric: str,
    session: SessionDep,
    minutes: Annotated[int, Query(ge=1, le=1440)] = 60,
) -> RecentMetricResponse:
    config = get_metric(metric)
    if config is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid metric")
    station = await get_station(session, station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    points = await get_recent_metric(session, station_id, metric, minutes)
    return RecentMetricResponse(
        metric=metric,
        unit=config.unit,
        minutes=minutes,
        points=[MetricPoint(**p) for p in points],
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
