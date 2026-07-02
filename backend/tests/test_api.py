from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.api import routes


def station(station_id: str = "alpha") -> SimpleNamespace:
    return SimpleNamespace(
        id=station_id,
        name="Alpha Base Station",
        location="Mendoza, Argentina",
        status="online",
    )


def reading(**overrides) -> SimpleNamespace:
    values = {
        "id": uuid4(),
        "station_id": "alpha",
        "timestamp": datetime.now(UTC).replace(hour=3, minute=0, second=0, microsecond=0),
        "temperature": 24.8,
        "humidity": 61.0,
        "wind_speed": 18.4,
        "wind_direction": "NE",
        "precipitation": 0.0,
        "battery_level": 62.0,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_station_create_duplicate_list_and_validation(client, monkeypatch):
    async def fake_create_station(_session, payload):
        return SimpleNamespace(
            id="alpha-base-station",
            name=payload.name,
            location=payload.location,
            status=payload.status,
        )

    async def duplicate_station(_session, _payload):
        raise IntegrityError("insert", {}, Exception("duplicate"))

    async def fake_list_stations(_session, _page, _search):
        return 1, [(station("alpha-base-station"), 88.0)]

    monkeypatch.setattr(routes, "create_station", fake_create_station)
    monkeypatch.setattr(routes, "list_stations", fake_list_stations)

    payload = {
        "name": "Alpha Base Station",
        "location": "Mendoza, Argentina",
        "status": "online",
    }
    created = await client.post("/api/stations", json=payload)
    assert created.status_code == 201
    assert created.json()["id"] == "alpha-base-station"

    monkeypatch.setattr(routes, "create_station", duplicate_station)
    duplicate = await client.post("/api/stations", json=payload)
    assert duplicate.status_code == 409

    invalid = await client.post("/api/stations", json={"name": "Broken"})
    assert 400 <= invalid.status_code < 500

    listed = await client.get("/api/stations")
    assert listed.status_code == 200
    listed_body = listed.json()
    assert listed_body["data"][0]["name"] == "Alpha Base Station"
    assert listed_body["data"][0]["batteryLevel"] == 88.0


@pytest.mark.asyncio
async def test_station_detail_and_not_found(client, monkeypatch):
    async def fake_get_station(_session, station_id):
        return station(station_id) if station_id == "alpha" else None

    async def fake_latest_reading(_session, _station_id):
        return reading()

    monkeypatch.setattr(routes, "get_station", fake_get_station)
    monkeypatch.setattr(routes, "latest_reading", fake_latest_reading)

    response = await client.get("/api/stations/alpha")
    assert response.status_code == 200
    body = response.json()
    assert body["lastUpdatedAt"] is not None
    assert body["current"]["windSpeed"] == 18.4
    assert body["current"]["windDirection"] == "NE"
    assert body["current"]["batteryLevel"] == 62.0
    assert body["batteryLevel"] == 62.0

    missing = await client.get("/api/stations/missing")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_station_detail_battery_defaults_to_zero_not_null(client, monkeypatch):
    async def fake_get_station(_session, station_id):
        return station(station_id) if station_id == "alpha" else None

    async def fake_latest_reading(_session, _station_id):
        return reading(battery_level=0.0)

    monkeypatch.setattr(routes, "get_station", fake_get_station)
    monkeypatch.setattr(routes, "latest_reading", fake_latest_reading)

    response = await client.get("/api/stations/alpha")
    assert response.status_code == 200
    body = response.json()
    assert body["current"]["batteryLevel"] == 0
    assert body["current"]["batteryLevel"] is not None


@pytest.mark.asyncio
async def test_station_detail_without_readings_has_null_battery(client, monkeypatch):
    async def fake_get_station(_session, station_id):
        return station(station_id) if station_id == "alpha" else None

    async def fake_latest_reading(_session, _station_id):
        return None

    monkeypatch.setattr(routes, "get_station", fake_get_station)
    monkeypatch.setattr(routes, "latest_reading", fake_latest_reading)

    response = await client.get("/api/stations/alpha")
    assert response.status_code == 200
    body = response.json()
    assert body["current"] is None
    assert body["batteryLevel"] is None


@pytest.mark.asyncio
async def test_readings_are_paginated_ordered_and_searchable(client, monkeypatch):
    rows = [(reading(temperature=index), "Alpha Base Station") for index in range(7)]

    async def fake_get_station(_session, station_id):
        return station(station_id) if station_id == "alpha" else None

    async def fake_paginated_readings(_session, _station_id, page, search):
        if search == "bravo":
            return 0, []
        assert page == 1
        return 9, rows

    monkeypatch.setattr(routes, "get_station", fake_get_station)
    monkeypatch.setattr(routes, "paginated_readings", fake_paginated_readings)

    response = await client.get("/api/stations/alpha/readings?page=1&search=alpha")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 9
    assert body["page"] == 1
    assert len(body["data"]) == 7
    assert body["data"][0]["temperature"] == 0
    assert body["data"][0]["stationName"] == "Alpha Base Station"
    assert body["data"][0]["batteryLevel"] == 62.0

    no_match = await client.get("/api/stations/alpha/readings?search=bravo")
    assert no_match.status_code == 200
    assert no_match.json()["total"] == 0

    missing = await client.get("/api/stations/missing/readings")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_hourly_metric_shape_and_validation(client, monkeypatch):
    async def fake_get_station(_session, station_id):
        return station(station_id) if station_id == "alpha" else None

    async def fake_hourly_points(_session, _station_id, _metric):
        return [{"hour": hour, "value": 12.5 if hour == 3 else None} for hour in range(25)]

    monkeypatch.setattr(routes, "get_station", fake_get_station)
    monkeypatch.setattr(routes, "hourly_points", fake_hourly_points)

    response = await client.get("/api/stations/alpha/metrics/temperature/hourly")
    assert response.status_code == 200
    body = response.json()
    assert body["metric"] == "temperature"
    assert len(body["points"]) == 25
    assert body["points"][3]["value"] == 12.5
    assert body["points"][4]["value"] is None

    invalid = await client.get("/api/stations/alpha/metrics/pressure/hourly")
    assert invalid.status_code == 400

    missing = await client.get("/api/stations/missing/metrics/temperature/hourly")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_daily_metric_summary_and_validation(client, monkeypatch):
    async def fake_get_station(_session, station_id):
        return station(station_id) if station_id == "alpha" else None

    async def fake_daily_summaries(_session, _station_id, _metric, days):
        today = date.today()
        return [
            {
                "date": today,
                "day_label": "Fri",
                "date_label": "26 jun",
                "month_label": "Jun",
                "is_month_start": False,
                "min": 10.0,
                "max": 20.0,
                "mean": 15.0,
            }
            for _ in range(days)
        ]

    monkeypatch.setattr(routes, "get_station", fake_get_station)
    monkeypatch.setattr(routes, "daily_summaries", fake_daily_summaries)

    response = await client.get("/api/stations/alpha/metrics/temperature/daily?days=7")
    assert response.status_code == 200
    body = response.json()
    assert body["days"] == 7
    assert len(body["summaries"]) == 7
    assert body["summaries"][-1]["min"] == 10.0
    assert body["summaries"][-1]["max"] == 20.0
    assert body["summaries"][-1]["mean"] == 15.0

    invalid_days = await client.get("/api/stations/alpha/metrics/temperature/daily?days=14")
    assert invalid_days.status_code == 400

    invalid_metric = await client.get("/api/stations/alpha/metrics/pressure/daily?days=7")
    assert invalid_metric.status_code == 400


@pytest.mark.asyncio
async def test_docs_and_openapi_are_available(client):
    openapi = await client.get("/openapi.json")
    assert openapi.status_code == 200
    assert "/api/stations" in openapi.json()["paths"]

    docs = await client.get("/docs")
    assert docs.status_code == 200
