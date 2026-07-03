from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "WeatherOS Backend"
    environment: str = "development"
    database_url: str

    chirpstack_mqtt_broker: str = "localhost:1883"
    chirpstack_app_id: str = ""

    # Seconds without a reading before a station is considered offline
    station_offline_threshold_seconds: int = 300

    # Calibration constants (provisional — calibrate with real hardware)
    # K_WIND: m/s per wind pulse; K_RAIN: mm per rain pulse
    sensor_k_wind: float = 0.5
    sensor_k_rain: float = 0.2794

    jwt_secret: str = "changeme-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 1 week

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

