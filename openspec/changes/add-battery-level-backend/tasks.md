## 1. Modelo y migración

- [x] 1.1 Agregar columna `battery_level: Mapped[float]` (NOT NULL, `server_default="0"`) al modelo `Reading` en `backend/app/db/models.py`
- [x] 1.2 Generar migración Alembic `ADD COLUMN battery_level FLOAT NOT NULL DEFAULT 0` en `backend/alembic/versions/` (`202607011200_add_battery_level.py`) — aplicada y verificada contra la base de desarrollo: backfillea filas existentes a `0`.
- [x] 1.3 ~~Actualizar seeds/fixtures de desarrollo~~ — no existe ningún script de seed/fixture en el repo; no aplica.

## 2. Schemas y endpoints

- [x] 2.1 Agregar `battery_level: float = Field(alias="batteryLevel")` (no opcional) a `CurrentReading` en `backend/app/schemas.py`
- [x] 2.2 Agregar el mismo campo a `ReadingResponse` en `backend/app/schemas.py`
- [x] 2.3 Mapear `reading.battery_level` al construir `CurrentReading`/`StationDetail` en `get_station_detail()` (`backend/app/api/routes.py`)
- [x] 2.4 Mapear `reading.battery_level` al construir cada `ReadingResponse` en `get_readings()` (`backend/app/api/routes.py`)

## 3. Tests

- [x] 3.1 Test: `GET /api/stations/{id}` devuelve `batteryLevel` con valor numérico cuando la última lectura lo tiene
- [x] 3.2 Test: `GET /api/stations/{id}` devuelve `batteryLevel: 0` cuando la lectura no registró un valor explícito (default, nunca `null`)
- [x] 3.3 Test: `GET /api/stations/{id}/readings` incluye `batteryLevel` en cada elemento de `data`, nunca `null`
- [x] 3.4 Test: estación sin ninguna lectura devuelve `current: null` y `batteryLevel: null` a nivel de estación (único caso de `null`)

`backend/tests/test_api.py` cubre 1-4 con mocks de servicio; además se verificó manualmente contra Postgres real (migración aplicada, backfill confirmado, `GET /api/stations` y `GET /api/stations/{id}` probados con `curl`).

## 4. Integración de frontend (dashboard + listado de estaciones)

El mock que originalmente iba a servir de puente (`add-battery-level-frontend`) ya no existe en el código: fue reemplazado por la integración real de API (`connect-frontend-to-api`) sin migrar el dato de batería. Estas tareas reconectan la UI ya construida (`BatteryBar`) al contrato real que este change expone.

- [x] 4.1 Agregar `batteryLevel: number` (no `| null`) a `CurrentReading`/`ReadingResponse`, y `batteryLevel: number | null` a `StationResponse`, en `frontend/src/api/types.ts`
- [x] 4.2 Reemplazar `<BatteryBar value={null} />` por `<BatteryBar value={current?.batteryLevel ?? null} />` en `frontend/src/App.tsx` (el `?? null` cubre solo el caso de estación sin ninguna lectura, no el campo de batería en sí)
- [x] 4.3 **(ampliación de alcance)** Exponer `batteryLevel` también en `GET /api/stations` (listado), agregando una subquery de "última lectura por estación" en `list_stations()` (`backend/app/services/stations.py`), para que `StationManagmentPanel.tsx` deje de mostrar el placeholder fijo y use `<BatteryBar value={station.batteryLevel} />` con el dato real por estación.

## 5. Documentación

- [ ] 5.1 Actualizar `openspec/specs/backend-API/spec.md` (vía sync) una vez archivado este change
