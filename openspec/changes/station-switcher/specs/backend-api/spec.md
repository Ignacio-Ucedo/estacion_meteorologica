## MODIFIED Requirements

### Requirement: Listado paginado de estaciones

El endpoint `GET /api/stations` SHALL aceptar los parámetros de query `page` (entero ≥ 1, default 1) y `search` (string opcional) y SHALL devolver un objeto paginado `StationPage` en lugar de una lista plana. El tamaño de página SHALL ser 6 estaciones. El filtro `search` SHALL comparar de forma case-insensitive contra el nombre de la estación.

**Contrato de API:**
```
GET /api/stations?page=<int>&search=<str>

Response 200:
{
  "total": <int>,   // total de estaciones que coinciden con search
  "page": <int>,    // página actual
  "data": [
    {
      "id": <str>,
      "name": <str>,
      "location": <str>,
      "status": "online" | "offline" | "degraded"
    },
    ...             // hasta 6 items
  ]
}
```

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
