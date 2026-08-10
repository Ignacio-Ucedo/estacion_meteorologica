import logging

from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

from app.config import get_settings

log = logging.getLogger("weather-backend.influx")

_client: InfluxDBClient | None = None
_write_api = None
_query_api = None


def _get_client() -> InfluxDBClient:
    global _client
    if _client is None:
        s = get_settings()
        _client = InfluxDBClient(url=s.influxdb_url, token=s.influxdb_token, org=s.influxdb_org)
    return _client


def get_write_api():
    global _write_api
    if _write_api is None:
        _write_api = _get_client().write_api(write_options=SYNCHRONOUS)
    return _write_api


def get_query_api():
    global _query_api
    if _query_api is None:
        _query_api = _get_client().query_api()
    return _query_api


def write(point: Point) -> None:
    s = get_settings()
    try:
        get_write_api().write(bucket=s.influxdb_bucket, org=s.influxdb_org, record=point)
    except Exception as e:
        log.error("influx_write_error error=%s", e)
        raise


def query(flux: str) -> list[dict]:
    """Execute a Flux query and return list of record value dicts."""
    try:
        tables = get_query_api().query(flux)
        results: list[dict] = []
        for table in tables:
            for record in table.records:
                results.append(dict(record.values))
        return results
    except Exception as e:
        log.error("influx_query_error error=%s", e)
        return []
