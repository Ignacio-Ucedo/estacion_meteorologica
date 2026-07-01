## 1. Backend Project Setup

- [x] 1.1 Create the `backend/` Python package structure with FastAPI app factory, settings module, route registration, and health/import sanity checks. Commit sugerido `chore(backend): crear scaffold de FastAPI`.
- [x] 1.2 Add backend dependency metadata for Python 3.13+, FastAPI, Pydantic v2, SQLAlchemy 2.x async, Alembic, async PostgreSQL driver, Pandas, pytest, and async test tooling. Commit sugerido `build(backend): agregar dependencias de API`.
- [x] 1.3 Configure formatting, linting, and test commands for the backend without affecting the existing frontend workflow. Commit sugerido `chore(backend): configurar herramientas de desarrollo`.

## 2. Persistence And Migrations

- [x] 2.1 Implement async database engine/session wiring with environment-based configuration and test dependency overrides. Commit sugerido `feat(backend): configurar sesion async de base de datos`.
- [x] 2.2 Define SQLAlchemy models for `stations` and `readings` with the fields required by the backend API spec. Commit sugerido `feat(backend): modelar estaciones y lecturas`.
- [x] 2.3 Add Alembic configuration and an initial migration for stations/readings, documenting conditional TimescaleDB hypertable setup. Commit sugerido `feat(backend): agregar migracion inicial`.

## 3. Station API

- [x] 3.1 Implement Pydantic v2 schemas with camelCase response aliases and ISO-8601 datetime serialization. Commit sugerido `feat(backend): agregar esquemas de API`.
- [x] 3.2 Implement `POST /api/stations` with required field validation, status validation, generated station id, and duplicate handling with HTTP 409. Commit sugerido `feat(backend): registrar estaciones`.
- [x] 3.3 Implement `GET /api/stations` returning all registered stations. Commit sugerido `feat(backend): listar estaciones`.
- [x] 3.4 Implement `GET /api/stations/{id}` returning station metadata, `lastUpdatedAt`, and current metric values from the latest reading, with HTTP 404 for unknown stations. Commit sugerido `feat(backend): consultar estado actual de estacion`.

## 4. Reading History API

- [x] 4.1 Implement repository/service queries for station readings ordered by timestamp descending. Commit sugerido `feat(backend): consultar lecturas historicas`.
- [x] 4.2 Implement `GET /api/stations/{id}/readings` with fixed page size 7, `page` query support, total count, and case-insensitive station-name `search`. Commit sugerido `feat(backend): paginar historial de lecturas`.
- [x] 4.3 Return HTTP 404 for reading history requests against missing stations. Commit sugerido `fix(backend): validar estacion en historial`.

## 5. Metric Aggregation API

- [x] 5.1 Implement shared metric validation and unit mapping for `temperature`, `humidity`, `windSpeed`, and `precipitation`. Commit sugerido `feat(backend): validar metricas meteorologicas`.
- [x] 5.2 Implement `GET /api/stations/{id}/metrics/{metric}/hourly` returning exactly 25 hourly points with `null` for missing buckets. Commit sugerido `feat(backend): exponer serie horaria de metricas`.
- [x] 5.3 Implement `GET /api/stations/{id}/metrics/{metric}/daily` for `days=7`, `days=30`, and `days=365`, including Pandas-based `min`, `max`, and `mean` summaries. Commit sugerido `feat(backend): exponer resumen diario de metricas`.
- [x] 5.4 Return HTTP 400 for invalid metrics or invalid `days`, and HTTP 404 for missing stations. Commit sugerido `fix(backend): validar consultas de metricas`.

## 6. Tests And Verification

- [x] 6.1 Add API tests for station creation, duplicate creation, list, detail, validation failures, and not-found responses. Commit sugerido `test(backend): cubrir endpoints de estaciones`.
- [x] 6.2 Add API tests for reading history pagination, fixed page size, ordering, and case-insensitive search. Commit sugerido `test(backend): cubrir historial paginado`.
- [x] 6.3 Add API tests for hourly metric shape, missing-bucket `null` behavior, daily summary size, aggregation fields, and invalid parameter errors. Commit sugerido `test(backend): cubrir endpoints de metricas`.
- [x] 6.4 Verify `/docs` and `/openapi.json` are served by the FastAPI app. Commit sugerido `test(backend): validar documentacion OpenAPI`.

## 7. Documentation

- [x] 7.1 Document backend environment variables, local run command, migration command, and test command. Commit sugerido `docs(backend): documentar ejecucion local`.
- [x] 7.2 Document the chosen hourly missing-data strategy (`null`) and TimescaleDB setup notes. Commit sugerido `docs(backend): documentar decisiones de datos`.
