## ADDED Requirements

### Requirement: FastAPI exposes station management endpoints
The backend MUST expose asynchronous station endpoints under the `/api` prefix using FastAPI, Pydantic v2 validation, camelCase JSON responses, and ISO-8601 datetime serialization.

#### Scenario: Register station successfully
- **GIVEN** a client sends `POST /api/stations` with `name`, `location`, and `status` set to one of `online`, `offline`, or `degraded`
- **WHEN** the request is valid and no station with the generated id exists
- **THEN** the API MUST return HTTP 201 with `id`, `name`, `location`, and `status`

#### Scenario: Reject invalid station registration
- **GIVEN** a client sends `POST /api/stations` with a missing required field or an unsupported `status`
- **WHEN** FastAPI validates the request body
- **THEN** the API MUST return a 400-class validation error response and MUST NOT create a station

#### Scenario: Reject duplicate station registration
- **GIVEN** a station already exists for the id generated from the submitted station name
- **WHEN** a client sends `POST /api/stations` for the same station identity
- **THEN** the API MUST return HTTP 409

#### Scenario: List registered stations
- **GIVEN** one or more stations are persisted
- **WHEN** a client sends `GET /api/stations`
- **THEN** the API MUST return HTTP 200 with an array of station objects containing `id`, `name`, `location`, and `status`

### Requirement: FastAPI exposes station detail with latest reading
The backend MUST expose `GET /api/stations/{id}` to return the station state and the latest available weather reading for dashboard metric cards.

#### Scenario: Return station detail with current values
- **GIVEN** a station exists and has at least one reading
- **WHEN** a client sends `GET /api/stations/{id}`
- **THEN** the API MUST return HTTP 200 with `id`, `name`, `location`, `status`, `lastUpdatedAt`, and `current`

#### Scenario: Current values use expected weather units
- **GIVEN** a station detail response includes `current`
- **WHEN** the response is serialized
- **THEN** `temperature` MUST be in degrees Celsius, `humidity` MUST be a percentage, `windSpeed` MUST be in km/h, `windDirection` MUST be a cardinal direction string, and `precipitation` MUST be in millimeters

#### Scenario: Station detail not found
- **GIVEN** no station exists for the path id
- **WHEN** a client sends `GET /api/stations/{id}`
- **THEN** the API MUST return HTTP 404

### Requirement: FastAPI exposes paginated reading history
The backend MUST expose `GET /api/stations/{id}/readings` to return paginated reading history with a fixed page size of 7 records ordered by timestamp descending.

#### Scenario: Return first page of readings
- **GIVEN** a station exists with historical readings
- **WHEN** a client sends `GET /api/stations/{id}/readings?page=1`
- **THEN** the API MUST return HTTP 200 with `total`, `page`, and `data`, where `data` contains at most 7 readings ordered by newest timestamp first

#### Scenario: Search readings by station name
- **GIVEN** readings exist for a station whose name matches a search term with different casing
- **WHEN** a client sends `GET /api/stations/{id}/readings?search=<term>`
- **THEN** the API MUST apply the station-name filter case-insensitively

#### Scenario: Reading history station not found
- **GIVEN** no station exists for the path id
- **WHEN** a client sends `GET /api/stations/{id}/readings`
- **THEN** the API MUST return HTTP 404

### Requirement: FastAPI exposes hourly metric series
The backend MUST expose `GET /api/stations/{id}/metrics/{metric}/hourly` for metric values over the latest 24-hour view and MUST return exactly 25 points from hour 0 through hour 24.

#### Scenario: Return hourly metric points
- **GIVEN** a station exists and the metric is one of `temperature`, `humidity`, `windSpeed`, or `precipitation`
- **WHEN** a client sends `GET /api/stations/{id}/metrics/{metric}/hourly`
- **THEN** the API MUST return HTTP 200 with `metric`, `unit`, `date`, and `points` containing exactly 25 entries

#### Scenario: Hourly response fills missing data explicitly
- **GIVEN** no reading exists for one or more hourly buckets
- **WHEN** the hourly metric response is built
- **THEN** the missing bucket values MUST be represented as `null` rather than interpolated or copied from previous readings

#### Scenario: Reject invalid hourly metric
- **GIVEN** a station exists
- **WHEN** a client sends `GET /api/stations/{id}/metrics/{metric}/hourly` with an unsupported metric
- **THEN** the API MUST return HTTP 400

#### Scenario: Hourly metric station not found
- **GIVEN** no station exists for the path id
- **WHEN** a client sends `GET /api/stations/{id}/metrics/temperature/hourly`
- **THEN** the API MUST return HTTP 404

### Requirement: FastAPI exposes daily metric summaries
The backend MUST expose `GET /api/stations/{id}/metrics/{metric}/daily` for daily metric summaries and MUST support only `days=7`, `days=30`, and `days=365`.

#### Scenario: Return daily summaries for allowed range
- **GIVEN** a station exists and the metric is one of `temperature`, `humidity`, `windSpeed`, or `precipitation`
- **WHEN** a client sends `GET /api/stations/{id}/metrics/{metric}/daily?days=30`
- **THEN** the API MUST return HTTP 200 with `metric`, `unit`, `days`, and `summaries` containing exactly 30 entries

#### Scenario: Calculate daily summary fields
- **GIVEN** readings exist for a requested metric and day
- **WHEN** the daily summary is built
- **THEN** each summary MUST include `date`, `dayLabel`, `dateLabel`, `monthLabel`, `isMonthStart`, `min`, `max`, and `mean`, with `min`, `max`, and `mean` calculated using Pandas or SQL aggregation

#### Scenario: Reject invalid days parameter
- **GIVEN** a station exists
- **WHEN** a client sends `GET /api/stations/{id}/metrics/temperature/daily?days=14`
- **THEN** the API MUST return HTTP 400

#### Scenario: Reject invalid daily metric
- **GIVEN** a station exists
- **WHEN** a client sends `GET /api/stations/{id}/metrics/pressure/daily?days=7`
- **THEN** the API MUST return HTTP 400

#### Scenario: Daily metric station not found
- **GIVEN** no station exists for the path id
- **WHEN** a client sends `GET /api/stations/{id}/metrics/temperature/daily?days=7`
- **THEN** the API MUST return HTTP 404

### Requirement: FastAPI exposes generated OpenAPI documentation
The backend MUST expose FastAPI-generated API documentation and schema endpoints.

#### Scenario: OpenAPI schema is available
- **GIVEN** the FastAPI backend is running
- **WHEN** a client sends `GET /openapi.json`
- **THEN** the API MUST return HTTP 200 with the generated OpenAPI schema

#### Scenario: Swagger documentation is available
- **GIVEN** the FastAPI backend is running
- **WHEN** a client sends `GET /docs`
- **THEN** the API MUST return HTTP 200 with the generated interactive documentation page
