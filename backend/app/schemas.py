from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

StationStatus = Literal["online", "offline", "degraded"]


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class StationCreate(ApiModel):
    name: str = Field(min_length=1)
    location: str = Field(min_length=1)
    status: StationStatus


class StationResponse(ApiModel):
    id: str
    name: str
    location: str
    status: StationStatus


class CurrentReading(ApiModel):
    temperature: float
    humidity: float
    wind_speed: float = Field(alias="windSpeed")
    wind_direction: str = Field(alias="windDirection")
    precipitation: float


class StationDetail(StationResponse):
    last_updated_at: datetime | None = Field(alias="lastUpdatedAt")
    current: CurrentReading | None


class ReadingResponse(ApiModel):
    id: UUID
    station_id: str = Field(alias="stationId")
    station_name: str = Field(alias="stationName")
    timestamp: datetime
    temperature: float
    humidity: float
    wind_speed: float = Field(alias="windSpeed")
    precipitation: float


class StationPage(ApiModel):
    total: int
    page: int
    data: list[StationResponse]


class ReadingPage(ApiModel):
    total: int
    page: int
    data: list[ReadingResponse]


class HourlyPoint(ApiModel):
    hour: int
    value: float | None


class HourlyMetricResponse(ApiModel):
    metric: str
    unit: str
    date: date
    points: list[HourlyPoint]


class DailySummary(ApiModel):
    date: date
    day_label: str = Field(alias="dayLabel")
    date_label: str = Field(alias="dateLabel")
    month_label: str = Field(alias="monthLabel")
    is_month_start: bool = Field(alias="isMonthStart")
    min: float | None
    max: float | None
    mean: float | None


class DailyMetricResponse(ApiModel):
    metric: str
    unit: str
    days: int
    summaries: list[DailySummary]
