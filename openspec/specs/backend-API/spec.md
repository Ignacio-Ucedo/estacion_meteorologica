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

Los buckets horarios sin lecturas deben representarse con valor `null`, sin interpolar ni repetir el último valor conocido.

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
