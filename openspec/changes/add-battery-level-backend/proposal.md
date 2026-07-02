## Why

El payload LoRa sugerido en `openspec/config.yaml` ya contempla `bateria_mv (u16)`, pero el backend no tiene forma de almacenar ni exponer el nivel de batería de una estación: ni el modelo `Reading`, ni el schema `CurrentReading`/`ReadingResponse`, ni el endpoint `GET /api/stations/{id}` lo incluyen. En paralelo, el equipo de frontend ya mergeó la visualización de batería en el dashboard (change `add-battery-level-frontend`, commit `7147f72`); este change entrega el contrato real de API que esa UI eventualmente consumirá.

**Estado actual del lado frontend (actualizado):** el mock original quedó huérfano. Un change posterior no relacionado (`connect-frontend-to-api`, archivado, commit `d74ca54`) reemplazó los datos hardcodeados de `App.tsx` por fetches reales a la API (`useStation`/`useStations`), pero no migró el mock de batería. Antes de esta iteración, `frontend/src/App.tsx` y `frontend/src/components/StationManagmentPanel.tsx` renderizaban `<BatteryBar value={null} />` de forma fija (siempre "Sin dato").

**Implementado:** esta iteración entregó tanto el backend como la reconexión de ambas pantallas de frontend — a pedido explícito del usuario, quien pidió que la batería deje de mostrar "Sin dato" y refleje el valor real tanto en la estación seleccionada del dashboard como en cada tarjeta del listado de gestión de estaciones. Esto amplió el alcance original (que excluía `StationManagmentPanel.tsx`): `GET /api/stations` ahora también expone `batteryLevel` por estación.

## What Changes

- Backend: agregar columna `battery_level` (float, porcentaje 0-100, **NOT NULL, default `0`**) al modelo `Reading` y su migración Alembic correspondiente.
- Backend: agregar `batteryLevel` (float, no opcional, default `0`) al schema `CurrentReading` y devolverlo en `GET /api/stations/{id}`.
- Backend: agregar `batteryLevel` (float, no opcional, default `0`) al schema `ReadingResponse` y devolverlo en `GET /api/stations/{id}/readings`.
- Backend: agregar `batteryLevel` (float o `null`) al schema `StationResponse` y devolverlo en `GET /api/stations` (listado), resolviendo la última lectura por estación con una subquery.
- Frontend: reconectar `App.tsx` (dashboard) y `StationManagmentPanel.tsx` (listado) al dato real, reemplazando el `<BatteryBar value={null} />` hardcodeado.

**Decisión de producto:** el nivel de batería de una lectura nunca es `null` — si no se registra un valor explícito, se persiste `0`. `null` solo puede seguir apareciendo cuando el objeto `current` completo es `null` (estación sin ninguna lectura registrada), igual que hoy pasa con el resto de las variables.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `backend-API`: el modelo `Reading`, los schemas `CurrentReading`/`ReadingResponse`/`StationResponse` y los endpoints `GET /api/stations`, `GET /api/stations/{id}` y `GET /api/stations/{id}/readings` ahora incluyen el campo `batteryLevel`.
- `web-dashboard`: el dashboard principal y el listado de gestión de estaciones ahora muestran el nivel de batería real (ya no un placeholder fijo).

## Impact

- Afecta backend (FastAPI/SQLAlchemy/Alembic) y frontend (React) — implementados juntos en esta iteración a pedido explícito del usuario.
- El change `add-battery-level-frontend` (mergeado) definió la convención de tipos esperada en el frontend (`BatteryBar`), pero el contrato de tipos no había llegado a persistir en `frontend/src/api/types.ts` porque el mock que lo llevaba fue reemplazado por la integración real de API en el change `connect-frontend-to-api`. Este change lo reintrodujo directamente.
- No afecta firmware ni gateway en esta iteración: el campo `bateria_mv` ya está sugerido en el payload LoRa (`openspec/config.yaml`) pero su implementación en firmware/gateway queda fuera de alcance; el valor real hoy viene de datos ya sembrados en la base de desarrollo (backfill a `0`), no de un sensor real.
- Código afectado: `backend/app/db/models.py`, `backend/alembic/versions/`, `backend/app/schemas.py`, `backend/app/api/routes.py`, `backend/app/services/stations.py`, `backend/tests/test_api.py`, `frontend/src/api/types.ts`, `frontend/src/App.tsx`, `frontend/src/components/StationManagmentPanel.tsx`.
- No es un breaking change: se agregan campos nuevos (NOT NULL con default `0` en el modelo; `batteryLevel` es opcional/`null` solo en `StationResponse` para estaciones sin lecturas), no se modifica ni elimina ningún campo existente; las filas históricas se backfillean a `0` en la propia migración.
- Verificado extremo a extremo: migración aplicada contra Postgres de desarrollo (backfill confirmado), endpoints probados con `curl`, frontend levantado y verificado visualmente (dashboard y listado de gestión de estaciones muestran barras de batería reales; solo las estaciones sin ninguna lectura muestran "Sin dato").
