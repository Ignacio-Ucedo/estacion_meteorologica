# backend-api/spec.md

# Backend API Specification

## Overview

El backend expone una API REST desarrollada con **Python + FastAPI** para la gestión de estaciones meteorológicas y consulta de datos históricos.

La API genera automáticamente la especificación OpenAPI y sigue una metodología **spec-driven**.

## Stack Tecnológico

* Lenguaje: Python 3.13+
* Framework: FastAPI
* ORM: SQLAlchemy 2.x (async)
* Base de datos: **PostgreSQL + TimescaleDB**
* Validación: Pydantic v2
* Migraciones: Alembic
* Análisis de datos: Pandas

---

# Modelos de Dominio

## Station

```python
id: str
name: str
location: str
status: Literal["online", "offline", "degraded"]
created_at: datetime
updated_at: datetime
```

---

## Reading

```python
id: UUID
station_id: str
timestamp: datetime

temperature: float
humidity: float

wind_speed: float
wind_direction: str

precipitation: float
battery_level: float | None  # porcentaje 0–100; null si no fue registrado
```

---

# Endpoints

---

## POST /api/stations

### Descripción

Registra una nueva estación meteorológica.

### Request Body

```json
{
  "name": "Alpha Base Station",
  "location": "Mendoza, Argentina",
  "status": "online"
}
```

### Validaciones

* `name`: obligatorio
* `location`: obligatorio
* `status`:

  * online
  * offline
  * degraded

### Response 201

```json
{
  "id": "alpha",
  "name": "Alpha Base Station",
  "location": "Mendoza, Argentina",
  "status": "online"
}
```

### Errores

```text
400 Invalid request
409 Station already exists
```

---

## GET /api/stations

### Descripción

Obtiene estaciones registradas con soporte de paginación y búsqueda por nombre. Devuelve un objeto `StationPage` en lugar de una lista plana.

### Query Params

| Param  | Tipo   | Obligatorio | Descripción                                          |
| ------ | ------ | ----------- | ---------------------------------------------------- |
| page   | int    | No          | Página (default: 1, mínimo: 1)                       |
| search | string | No          | Filtro por nombre de estación (case-insensitive)     |

### Response 200

```json
{
  "total": 12,
  "page": 1,
  "data": [
    {
      "id": "alpha",
      "name": "Alpha Base Station",
      "location": "Mendoza, Argentina",
      "status": "online"
    }
  ]
}
```

### Reglas de negocio

* Tamaño de página fijo: 6 estaciones.
* Orden alfabético por nombre.
* El filtro `search` es case-insensitive y compara contra el nombre de la estación.
* Si `page < 1`, la API responde con 422 Unprocessable Entity.
* Si `page` excede el total de páginas disponibles, `data` devuelve `[]` con `total` correcto y sin error 4xx.

### Scenarios

#### Scenario: Listado sin parámetros devuelve primera página

- **WHEN** se realiza `GET /api/stations` sin parámetros
- **THEN** la respuesta contiene `page: 1`, `total` igual al total de estaciones en la base, y `data` con hasta 6 estaciones ordenadas alfabéticamente por nombre

#### Scenario: Paginación con page=N

- **WHEN** se realiza `GET /api/stations?page=2`
- **THEN** la respuesta contiene `page: 2` y `data` con las estaciones de la segunda página (offset 6)

#### Scenario: Filtrado por nombre

- **WHEN** se realiza `GET /api/stations?search=alpha`
- **THEN** `data` contiene solo estaciones cuyo nombre incluye "alpha" (case-insensitive) y `total` refleja el conteo filtrado

#### Scenario: Página fuera de rango devuelve data vacía

- **WHEN** se realiza `GET /api/stations?page=999` y hay menos de 6×998 estaciones
- **THEN** la respuesta retorna `data: []` con `total` correcto y sin error 4xx

#### Scenario: page menor a 1 es rechazado

- **WHEN** se realiza `GET /api/stations?page=0`
- **THEN** la API responde con 422 Unprocessable Entity

### Errores

```text
422 Unprocessable Entity (page < 1)
```

### Uso

* Dashboard (modal de selección de estación)
* Historial
* Gestión de estaciones

---

## GET /api/stations/{id}

### Descripción

Obtiene la información actual de una estación y su última lectura disponible.

### Path Params

```text
id: string
```

### Response 200

```json
{
  "id": "alpha",
  "name": "Alpha Base Station",
  "location": "Mendoza, Argentina",
  "status": "online",
  "lastUpdatedAt": "2026-06-26T14:32:00-03:00",
  "current": {
    "temperature": 24.8,
    "humidity": 61,
    "windSpeed": 18.4,
    "windDirection": "NE",
    "precipitation": 12.6
  }
}
```

### Errores

```text
404 Station not found
```

### Uso

* Metric Cards
* Header del Dashboard

---

## GET /api/stations/{id}/readings

### Descripción

Obtiene el historial paginado de lecturas.

La interfaz consume páginas de 7 elementos.

### Path Params

```text
id: string
```

### Query Params

| Param  | Tipo   | Obligatorio | Descripción                   |
| ------ | ------ | ----------- | ----------------------------- |
| page   | int    | No          | Página (default: 1)           |
| search | string | No          | Filtro por nombre de estación |

### Response 200

```json
{
  "total": 284,
  "page": 1,
  "data": [
    {
      "id": "uuid",
      "stationId": "alpha",
      "stationName": "Alpha Base Station",
      "timestamp": "2026-06-26T14:32:00-03:00",
      "temperature": 24.8,
      "humidity": 61,
      "windSpeed": 18.4,
      "precipitation": 0.0
    }
  ]
}
```

### Reglas de negocio

* Tamaño de página fijo: 7 registros.
* Orden descendente por timestamp.
* El filtro search es case-insensitive.

### Errores

```text
404 Station not found
```

### Uso

* Tabla de historial
* Paginación
* Buscador por estación

---

## GET /api/stations/{id}/metrics/{metric}/hourly

### Descripción

Obtiene la serie horaria de las últimas 24 horas.

Se utiliza para la vista 1D de los gráficos.

### Path Params

```text
id: string

metric:
- temperature
- humidity
- windSpeed
- precipitation
```

### Response 200

```json
{
  "metric": "temperature",
  "unit": "°C",
  "date": "2026-06-26",
  "points": [
    {
      "hour": 0,
      "value": 13.2
    },
    {
      "hour": 24,
      "value": 13.1
    }
  ]
}
```

### Reglas de negocio

La respuesta debe contener exactamente:

```text
25 puntos:
hora 0 -> hora 24
```

Los datos faltantes deberán completarse según la estrategia definida por el frontend:

* valor nulo
* interpolación
* último valor conocido

(la decisión final deberá documentarse en la implementación).

### Errores

```text
400 Invalid metric
404 Station not found
```

### Uso

* Gráficos modo 1D
* Cálculo de máximos y mínimos diarios

---

## GET /api/stations/{id}/metrics/{metric}/daily

### Descripción

Obtiene resúmenes diarios para las vistas:

* 7D
* 30D
* 1Y

### Path Params

```text
id: string

metric:
- temperature
- humidity
- windSpeed
- precipitation
```

### Query Params

| Param | Tipo | Valores    |
| ----- | ---- | ---------- |
| days  | int  | 7, 30, 365 |

### Response 200

```json
{
  "metric": "temperature",
  "unit": "°C",
  "days": 30,
  "summaries": [
    {
      "date": "2026-05-27",
      "dayLabel": "Mar",
      "dateLabel": "27 may",
      "monthLabel": "May",
      "isMonthStart": false,
      "min": 8.0,
      "max": 21.5,
      "mean": 14.2
    }
  ]
}
```

### Reglas de negocio

La cantidad de elementos devueltos debe coincidir exactamente con el parámetro:

```text
days=7   -> 7 elementos
days=30  -> 30 elementos
days=365 -> 365 elementos
```

Los cálculos deben realizarse utilizando Pandas:

```text
min
max
mean
```

### Errores

```text
400 Invalid metric
400 Invalid days parameter
404 Station not found
```

### Uso

* Gráficos 7D
* Gráficos 30D
* Gráficos 1Y

---

# Requisitos No Funcionales

## Rendimiento

* Todos los endpoints deben ser async.
* La paginación debe ejecutarse mediante LIMIT/OFFSET.
* Los agregados diarios deberán realizarse en background utilizando Pandas o SQL agregada.

---

## OpenAPI

La documentación deberá generarse automáticamente mediante:

```text
/docs
```

y

```text
/openapi.json
```

---

## Convenciones

### JSON

camelCase para respuestas:

```json
{
  "windSpeed": 18.4
}
```

---

### Fechas

Formato ISO-8601:

```text
2026-06-26T14:32:00-03:00
```

---

### Versionado

```text
/api
```

como prefijo base para futuras versiones de la API.

---

## Requirements

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

### Requirement: Variables de entorno MQTT en configuración del backend

El backend SHALL aceptar las variables de entorno `CHIRPSTACK_MQTT_BROKER` (default `localhost:1883`) y `CHIRPSTACK_APP_ID` (requerido para activar MQTT) además de las variables ya existentes (`DATABASE_URL`). Estas variables SHALL documentarse en `backend/README.md`.

#### Scenario: Variables de entorno documentadas en README

- **WHEN** un desarrollador lee `backend/README.md`
- **THEN** encuentra la tabla completa de variables de entorno incluyendo `CHIRPSTACK_MQTT_BROKER`, `CHIRPSTACK_APP_ID`, `SENSOR_K_WIND` y `SENSOR_K_RAIN` con sus defaults y descripción

### Requirement: GET /api/stations devuelve estaciones auto-creadas

Las estaciones creadas automáticamente por el ingestion bridge (con prefijo `dev-`) SHALL aparecer en `GET /api/stations` junto con las estaciones registradas manualmente, sin distinción en la respuesta.

#### Scenario: Estación auto-creada visible en listado

- **WHEN** el gateway-mock publica su primer uplink y luego se realiza `GET /api/stations`
- **THEN** la respuesta incluye la Station auto-creada con `id = "dev-{dev_eui[:8]}"` y `status = "online"`

### Requirement: GET /api/stations/{id} devuelve current reading de uplinks reales

Una vez que el ingestion bridge persiste uplinks como `Reading`, el endpoint `GET /api/stations/{id}` SHALL devolver el campo `current` con los valores de la lectura más reciente del nodo real o del gateway-mock, no datos mock.

#### Scenario: current reading reflejando uplink del gateway-mock

- **WHEN** el gateway-mock publica al menos un uplink válido y se consulta `GET /api/stations/dev-{dev_eui[:8]}`
- **THEN** el campo `current.temperature` coincide con el valor del último uplink (dentro de la precisión del field mapping) y `lastUpdatedAt` es reciente

### Requirement: Nivel de batería en la lectura actual de una estación
El endpoint `GET /api/stations/{id}` SHALL incluir un campo `batteryLevel` dentro del objeto `current`, representando el porcentaje de carga de la batería (0–100, resolución 1%) de la última lectura conocida. Cuando la última lectura no tenga dato de batería registrado, el campo SHALL devolverse como `null`.

#### Scenario: Estación con dato de batería disponible
- **WHEN** el cliente solicita `GET /api/stations/alpha` y la última lectura almacenada tiene `battery_level = 78`
- **THEN** la respuesta incluye `"current": { ..., "batteryLevel": 78 }`

#### Scenario: Estación con lectura sin dato de batería
- **WHEN** el cliente solicita `GET /api/stations/alpha` y la última lectura almacenada no tiene `battery_level` (valor `NULL` en la base)
- **THEN** la respuesta incluye `"current": { ..., "batteryLevel": null }`

#### Scenario: Estación sin lecturas registradas
- **WHEN** el cliente solicita `GET /api/stations/{id}` de una estación registrada que aún no tiene ninguna lectura
- **THEN** `current` se devuelve como `null`, igual que el comportamiento existente para el resto de las variables

### Requirement: Nivel de batería en el historial paginado de lecturas
El endpoint `GET /api/stations/{id}/readings` SHALL incluir el campo `batteryLevel` (porcentaje 0–100 o `null`) en cada elemento de `data`, manteniendo el resto del contrato de paginación sin cambios.

#### Scenario: Historial con lecturas que incluyen batería
- **WHEN** el cliente solicita `GET /api/stations/alpha/readings?page=1`
- **THEN** cada elemento de `data` incluye `batteryLevel` con el valor numérico (0–100) o `null` si no fue registrado para esa lectura

### Requirement: Persistencia del nivel de batería en el modelo de lecturas
El modelo de dominio `Reading` SHALL almacenar `battery_level` como un valor numérico opcional (0–100, sin unidades adicionales, ya convertido a porcentaje antes de persistirse). El campo SHALL ser nullable para no romper la compatibilidad con lecturas históricas que no lo registraron.

#### Scenario: Inserción de una nueva lectura con batería
- **WHEN** se inserta una nueva fila en `readings` con `battery_level = 45.5`
- **THEN** el valor se persiste y es recuperable sin pérdida de precisión decimal

#### Scenario: Inserción de una lectura sin dato de batería
- **WHEN** se inserta una nueva fila en `readings` sin especificar `battery_level`
- **THEN** la columna queda en `NULL` y la inserción no falla
