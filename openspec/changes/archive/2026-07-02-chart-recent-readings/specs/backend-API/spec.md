## ADDED Requirements

### Requirement: Endpoint de lecturas recientes por métrica
El backend SHALL exponer `GET /api/stations/{station_id}/metrics/{metric}/recent` que devuelve los puntos individuales de la tabla `readings` en la ventana de tiempo especificada, ordenados por timestamp ascendente.

**Métricas soportadas:** `temperature`, `humidity`, `windSpeed`, `precipitation`
**Unidades:** °C, %, km/h, mm

**Query params:**
| Param | Tipo | Default | Rango válido |
|-------|------|---------|--------------|
| `minutes` | int | 60 | 1–1440 |

**Response 200:**
```json
{
  "metric": "temperature",
  "unit": "°C",
  "minutes": 60,
  "points": [
    { "timestamp": "2026-07-02T16:31:20Z", "value": 15.2 },
    { "timestamp": "2026-07-02T16:31:50Z", "value": 15.3 }
  ]
}
```

#### Scenario: Lectura reciente exitosa
- **GIVEN** que existen filas en `readings` para la estación en los últimos `minutes` minutos
- **WHEN** `GET /api/stations/{id}/metrics/temperature/recent?minutes=60`
- **THEN** la respuesta SHALL ser 200 con un array `points` ordenado ascendente por `timestamp`; cada punto SHALL tener `timestamp` en ISO 8601 UTC y `value` como float con la precisión de la lectura almacenada

#### Scenario: Sin lecturas en el período
- **GIVEN** que no existen filas en `readings` para la estación en los últimos `minutes` minutos
- **WHEN** `GET /api/stations/{id}/metrics/temperature/recent?minutes=60`
- **THEN** la respuesta SHALL ser 200 con `"points": []`

#### Scenario: Métrica no soportada
- **GIVEN** que `{metric}` no es uno de los valores soportados
- **WHEN** `GET /api/stations/{id}/metrics/invalid/recent`
- **THEN** la respuesta SHALL ser 422 con detalle del error de validación

#### Scenario: `minutes` fuera de rango
- **GIVEN** que `minutes` < 1 o > 1440
- **WHEN** la petición llega al backend
- **THEN** la respuesta SHALL ser 422 con detalle del error de validación

#### Scenario: Estación inexistente
- **GIVEN** que `{station_id}` no existe en la base de datos
- **WHEN** la petición llega al backend
- **THEN** la respuesta SHALL ser 404
