from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas import (
    CurrentReading,
    DailyMetricResponse,
    DailySummary,
    HourlyMetricResponse,
    HourlyPoint,
    MetricPoint,
    RecentMetricResponse,
    StationDetail,
    StationPage,
    StationResponse,
)
from app.services.metrics import METRICS, daily_summaries, get_metric, get_recent_metric, hourly_points, utc_now
from app.services.stations import effective_status, get_station, latest_reading, list_stations

router = APIRouter()

_PAGE_SIZE = 6


@router.get("/stations", response_model=StationPage)
def get_stations(
    page: Annotated[int, Query(ge=1)] = 1,
    search: str | None = None,
) -> StationPage:
    stations = list_stations()
    if search:
        stations = [s for s in stations if search.lower() in s["name"].lower()]
    total = len(stations)
    start = (page - 1) * _PAGE_SIZE
    paginated = stations[start:start + _PAGE_SIZE]
    return StationPage(
        total=total,
        page=page,
        data=[
            StationResponse(
                id=s["id"],
                name=s["name"],
                location=s["location"],
                status=s["status"],
                batteryLevel=s["battery_level"],
            )
            for s in paginated
        ],
    )


@router.get("/stations/{station_id}", response_model=StationDetail)
def get_station_detail(station_id: str) -> StationDetail:
    from app.config import get_settings  # noqa: PLC0415
    station = get_station(station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    reading = latest_reading(station["dev_eui"])
    current = None
    last_updated_at = None
    battery_level = None
    if reading is not None:
        last_updated_at = reading["timestamp"]
        battery_level = reading["battery_level"]
        current = CurrentReading(
            temperature=reading["temperature"],
            humidity=reading["humidity"],
            windSpeed=reading["wind_speed"],
            windDirection="N/A",
            precipitation=reading["precipitation"],
            batteryLevel=reading["battery_level"] or 0.0,
        )
    threshold = get_settings().station_offline_threshold_seconds
    return StationDetail(
        id=station["id"],
        name=station["name"],
        location=station["location"],
        status=effective_status(last_updated_at, threshold),
        batteryLevel=battery_level,
        lastUpdatedAt=last_updated_at,
        current=current,
    )


@router.get("/stations/{station_id}/metrics/{metric}/recent", response_model=RecentMetricResponse)
def get_recent_metric_endpoint(
    station_id: str,
    metric: str,
    minutes: Annotated[int, Query(ge=1, le=1440)] = 60,
) -> RecentMetricResponse:
    config = get_metric(metric)
    if config is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid metric")
    station = get_station(station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    points = get_recent_metric(station["dev_eui"], metric, minutes)
    return RecentMetricResponse(
        metric=metric,
        unit=config.unit,
        minutes=minutes,
        points=[MetricPoint(**p) for p in points],
    )


@router.get("/stations/{station_id}/metrics/{metric}/hourly", response_model=HourlyMetricResponse)
def get_hourly_metric(station_id: str, metric: str) -> HourlyMetricResponse:
    config = get_metric(metric)
    if config is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid metric")
    station = get_station(station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    points = hourly_points(station["dev_eui"], metric)
    return HourlyMetricResponse(
        metric=metric,
        unit=config.unit,
        date=utc_now().date(),
        points=[HourlyPoint(**p) for p in points],
    )


@router.get("/stations/{station_id}/metrics/{metric}/daily", response_model=DailyMetricResponse)
def get_daily_metric(
    station_id: str,
    metric: str,
    days: Annotated[int, Query()] = 7,
) -> DailyMetricResponse:
    config = METRICS.get(metric)
    if config is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid metric")
    if days not in {7, 30, 365}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid days parameter")
    station = get_station(station_id)
    if station is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    summaries = daily_summaries(station["dev_eui"], metric, days)
    return DailyMetricResponse(
        metric=metric,
        unit=config.unit,
        days=days,
        summaries=[DailySummary(**s) for s in summaries],
    )
