## 1. Modelo y migración

- [ ] 1.1 Agregar columna `battery_level: Mapped[float | None]` (nullable) al modelo `Reading` en `backend/app/db/models.py`
- [ ] 1.2 Generar migración Alembic `ADD COLUMN battery_level FLOAT NULL` en `backend/alembic/versions/`
- [ ] 1.3 Actualizar seeds/fixtures de desarrollo (si existen) para incluir valores de ejemplo de `battery_level`

## 2. Schemas y endpoints

- [ ] 2.1 Agregar `battery_level: float | None = Field(alias="batteryLevel")` a `CurrentReading` en `backend/app/schemas.py`
- [ ] 2.2 Agregar el mismo campo a `ReadingResponse` en `backend/app/schemas.py`
- [ ] 2.3 Mapear `reading.battery_level` al construir `CurrentReading` en `get_station_detail()` (`backend/app/api/routes.py`)
- [ ] 2.4 Mapear `reading.battery_level` al construir cada `ReadingResponse` en `get_readings()` (`backend/app/api/routes.py`)

## 3. Tests

- [ ] 3.1 Test: `GET /api/stations/{id}` devuelve `batteryLevel` con valor numérico cuando la última lectura lo tiene
- [ ] 3.2 Test: `GET /api/stations/{id}` devuelve `batteryLevel: null` cuando la última lectura no lo tiene
- [ ] 3.3 Test: `GET /api/stations/{id}/readings` incluye `batteryLevel` en cada elemento de `data`

## 4. Documentación

- [ ] 4.1 Actualizar `openspec/specs/backend-API/spec.md` (vía sync) una vez archivado este change
