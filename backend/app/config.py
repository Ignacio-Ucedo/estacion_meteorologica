from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "WeatherOS Backend"
    environment: str = "development"

    # MQTT subscriber
    chirpstack_mqtt_broker: str = "localhost:1883"
    chirpstack_app_id: str = ""

    # InfluxDB
    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = "weather-station-token"
    influxdb_org: str = "weather-station"
    influxdb_bucket: str = "weather"

    station_offline_threshold_seconds: int = 600
    health_mqtt_stale_seconds: int = 600

    sensor_k_wind: float = 0.5
    sensor_k_rain: float = 0.2794

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
