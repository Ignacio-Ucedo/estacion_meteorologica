from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

StationStatus = Literal["online", "offline", "degraded"]


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# ─── Auth / Users ─────────────────────────────────────────────────────────────

class RegisterRequest(ApiModel):
    username: str
    password: str | None = None


class LoginRequest(ApiModel):
    username: str
    password: str


class TokenResponse(ApiModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(ApiModel):
    id: str
    username: str
    created_at: str


class StationResponse(ApiModel):
    id: str
    name: str
    location: str
    status: StationStatus
    battery_level: float | None = Field(default=None, alias="batteryLevel")


class CurrentReading(ApiModel):
    temperature: float
    humidity: float
    wind_speed: float = Field(alias="windSpeed")
    wind_direction: str = Field(alias="windDirection")
    precipitation: float
    battery_level: float = Field(alias="batteryLevel")


class StationDetail(StationResponse):
    last_updated_at: datetime | None = Field(alias="lastUpdatedAt")
    current: CurrentReading | None


class StationPage(ApiModel):
    total: int
    page: int
    data: list[StationResponse]


class MetricPoint(ApiModel):
    timestamp: datetime
    value: float
    seq: int | None = None


class RecentMetricResponse(ApiModel):
    metric: str
    unit: str
    minutes: int
    points: list[MetricPoint]


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
