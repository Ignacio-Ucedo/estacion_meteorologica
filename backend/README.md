# WeatherOS Backend

FastAPI backend for station metadata, weather readings, metric history, and generated OpenAPI docs.

## Environment

- `DATABASE_URL`: async SQLAlchemy URL. Default: `postgresql+asyncpg://weatheros:weatheros@localhost:5432/weatheros`
- `APP_NAME`: FastAPI title. Default: `WeatherOS Backend`
- `ENVIRONMENT`: runtime label. Default: `development`

## Local Commands

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
pytest
ruff check .
```

The API is served under `/api`. FastAPI exposes generated documentation at `/docs` and `/openapi.json`.

## Data Decisions

Hourly metric responses always contain 25 points, from hour `0` through hour `24`. Missing hourly buckets are returned as `null`; the backend does not interpolate or copy previous measurements.

The migration creates regular PostgreSQL tables first. When TimescaleDB is installed, the `readings` table can be converted into a hypertable with `timestamp` as the time dimension and `station_id` as the station tag/dimension.

