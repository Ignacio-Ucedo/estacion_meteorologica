## Context

The repository currently contains a frontend and an OpenSpec backend API contract, but no executable FastAPI backend. The backend must serve the React dashboard and later receive data from the LoRa gateway, while keeping generated OpenAPI documentation available through FastAPI.

The implementation should prefer PostgreSQL + TimescaleDB because the existing backend spec selects it for the concrete REST implementation. The project-level config still mentions InfluxDB as the default recommendation with TimescaleDB as an acceptable alternative, so the backend design will document the TimescaleDB schema explicitly.

End-to-end data flow:

```text
sensor -> ESP32 sensor node -> LoRa P2P -> ESP32 gateway -> backend FastAPI -> PostgreSQL/TimescaleDB -> frontend React
```

## Goals / Non-Goals

**Goals:**

- Implement the REST API described in `openspec/specs/backend-API/spec.md` with FastAPI.
- Provide async database access through SQLAlchemy 2.x.
- Persist stations and weather readings in tables that can run on PostgreSQL and be converted to TimescaleDB hypertables.
- Return camelCase JSON payloads and ISO-8601 datetimes.
- Generate `/docs` and `/openapi.json` automatically.
- Add tests for success paths, validation failures, not-found handling, pagination, and metric summaries.

**Non-Goals:**

- Implement gateway authentication or ingestion endpoints beyond the documented station/readings API.
- Change firmware payload format, LoRa frequency, or gateway behavior.
- Build frontend screens or wire the frontend to the API in this change.
- Require physical weather hardware to validate the backend.

## Decisions

1. Use a `backend/` Python package with an app factory.

   Rationale: an app factory keeps tests isolated, allows dependency overrides for database sessions, and avoids import-time database connections. Alternative considered: a single `main.py`; simpler initially, but harder to test and configure.

2. Use SQLAlchemy async ORM models for `stations` and `readings`.

   Rationale: the API needs relational joins for station names, latest reading lookup, pagination, and historical filtering. SQLAlchemy 2.x async matches the spec and keeps the code portable across PostgreSQL and test databases. Alternative considered: direct SQL only; efficient, but less consistent for validation and migrations.

3. Store readings in a TimescaleDB-compatible table.

   Rationale: readings are time-series data and will grow over time. The migration should create a normal PostgreSQL table first, then use `create_hypertable` when TimescaleDB is enabled. Schema:

   - Table `stations`: `id`, `name`, `location`, `status`, `created_at`, `updated_at`.
   - Table `readings`: `id`, `station_id`, `timestamp`, `temperature`, `humidity`, `wind_speed`, `wind_direction`, `precipitation`.
   - Tags/dimensions: `station_id`.
   - Fields: temperature in °C, humidity in %, wind speed in km/h, wind direction as cardinal text, precipitation in mm.

   Alternative considered: InfluxDB measurement storage. The existing backend API spec chooses PostgreSQL + TimescaleDB, and SQLAlchemy/Alembic integration is more direct for this implementation.

4. Keep response schemas separate from database models.

   Rationale: API responses require camelCase names such as `stationId`, `windSpeed`, `lastUpdatedAt`, and `current`. Separate Pydantic v2 schemas avoid leaking snake_case database names. Alternative considered: serializing ORM models directly; faster to write, but it couples persistence naming to the public API.

5. Implement metric aggregation in a service layer.

   Rationale: hourly and daily endpoints share metric validation and unit mapping. The service can query raw rows, normalize missing time buckets, and use Pandas for `min`, `max`, and `mean` daily summaries as required. Alternative considered: putting aggregation logic inside route handlers; easier at first, but makes tests and reuse worse.

6. Use deterministic gap handling for hourly responses.

   Rationale: the spec requires exactly 25 points and leaves the missing-data strategy to implementation. This change will return `null` for missing hourly values because it preserves data gaps honestly and lets the frontend render missing data without inventing measurements.

## Risks / Trade-offs

- [Risk] TimescaleDB extension may be unavailable in local development or CI -> Migration should keep the base PostgreSQL table valid and make hypertable creation conditional or clearly documented.
- [Risk] Pandas aggregation can become expensive for large historical ranges -> Query only the needed station/metric/date window and revisit SQL aggregation if production data volume requires it.
- [Risk] The public API uses camelCase while Python internals use snake_case -> Centralize aliases in Pydantic schemas and cover representative responses in tests.
- [Risk] The station ID derivation for `POST /api/stations` can collide for similar names -> Generate a slug from the station name and return `409` if the slug already exists; keep explicit custom IDs out of scope unless the spec changes.
- [Risk] Time zones can produce inconsistent daily buckets -> Normalize persisted timestamps to timezone-aware UTC and serialize ISO-8601 values; derive labels from the requested/current local date only where the endpoint requires presentation labels.

## Migration Plan

1. Add backend dependency metadata, environment configuration, app factory, routes, schemas, services, database session setup, and tests.
2. Add Alembic configuration and an initial migration for `stations` and `readings`.
3. Run tests against an isolated test database or SQLite-compatible async test setup where possible, with PostgreSQL-specific migration behavior documented.
4. Deploy by running migrations before starting the FastAPI app.
5. Roll back by stopping the new backend deployment and reverting the migration/application commit; no field firmware rollback is required because this change does not alter deployed firmware behavior or LoRa payloads.

## Open Questions

- Whether the first implementation should include a gateway ingestion endpoint for incoming measurements, since the current backend spec documents reads and station creation but no measurement-create endpoint.
- Whether production should require PostgreSQL + TimescaleDB in every environment or allow SQLite only for local tests.
