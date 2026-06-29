## Why

El payload LoRa sugerido en `openspec/config.yaml` ya contempla `bateria_mv (u16)`, pero el backend no tiene forma de almacenar ni exponer el nivel de batería de una estación: ni el modelo `Reading`, ni el schema `CurrentReading`/`ReadingResponse`, ni el endpoint `GET /api/stations/{id}` lo incluyen. En paralelo, el equipo de frontend está agregando la visualización de batería en el dashboard (change `add-battery-level-frontend`) usando un valor mock; este change entrega el contrato real de API que esa UI eventualmente consumirá.

## What Changes

- Backend: agregar columna `battery_level` (float, porcentaje 0-100, nullable) al modelo `Reading` y su migración Alembic correspondiente.
- Backend: agregar `batteryLevel` al schema `CurrentReading` y devolverlo en `GET /api/stations/{id}`.
- Backend: agregar `batteryLevel` al schema `ReadingResponse` y devolverlo en `GET /api/stations/{id}/readings`.
- Backend: actualizar los datos semilla/fixtures de desarrollo para incluir valores de ejemplo de batería.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `backend-API`: el modelo `Reading`, los schemas `CurrentReading`/`ReadingResponse` y los endpoints `GET /api/stations/{id}` y `GET /api/stations/{id}/readings` ahora incluyen el campo `batteryLevel`.

## Impact

- Afecta únicamente al backend (FastAPI/SQLAlchemy/Alembic). No requiere cambios de frontend para implementarse ni mergearse.
- Este change es independiente y puede desarrollarse en paralelo al change `add-battery-level-frontend` (otro desarrollador), que ya define el contrato de tipos esperado en el frontend (`batteryLevel: number | null`, porcentaje 0-100) usando un mock.
- No afecta firmware ni gateway en esta iteración: el campo `bateria_mv` ya está sugerido en el payload LoRa (`openspec/config.yaml`) pero su implementación en firmware/gateway queda fuera de alcance; este change solo prepara el contrato de datos en backend usando datos semilla/mock mientras tanto.
- Código afectado: `backend/app/db/models.py`, `backend/alembic/versions/`, `backend/app/schemas.py`, `backend/app/api/routes.py`.
- No es un breaking change: se agrega un campo opcional/nuevo (nullable), no se modifica ni elimina ningún campo existente.
- Una vez mergeado, queda pendiente (fuera de alcance de este change) una tarea de integración que conecte el frontend real a este endpoint, reemplazando el mock del change `add-battery-level-frontend`.
