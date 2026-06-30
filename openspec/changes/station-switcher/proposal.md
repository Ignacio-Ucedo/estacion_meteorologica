## Why

El dashboard actual muestra siempre la misma estación hardcodeada (`STATION_ID = "alpha"`), lo que impide operar con múltiples estaciones desplegadas. Se necesita un mecanismo para que el usuario pueda cambiar de estación activa desde la interfaz sin recargar la app.

## What Changes

- **Nuevo modal de selección de estaciones**: se abre desde dos puntos de entrada (chip en el Topbar y click en el StationPanel). Muestra nombre, ubicación y estado de cada estación, con búsqueda por nombre y paginación de 6 en 6.
- **Estado reactivo de estación seleccionada**: `STATION_ID` deja de ser una constante importada de `config.ts` y pasa a ser estado en `App.tsx`. El Dashboard y la sección de Gráficas reaccionan al cambio.
- **Refactor de `GraficasPanel`**: pasa a recibir `stationId` como prop en lugar de importar la constante; su componente interno `MetricChart` también lo recibe.
- **Dos triggers de apertura**: chip `[⇄ <nombre> ▾]` en el Topbar (zona de acciones) y el `StationPanel` completo clickeable con indicador visual.
- **Backend: paginación en `GET /api/stations`**: el endpoint acepta `?page=&search=` y devuelve `{ total, page, data: StationResponse[] }` en lugar de una lista plana.
- **Historial y Gestión de estaciones permanecen independientes**: el `StationLogPanel` no filtra por estación seleccionada (ya tiene su propia búsqueda); el `StationManagementPanel` es un panel de administración global.

## Capabilities

### New Capabilities

- `station-switcher`: Modal de cambio de estación activa con búsqueda y paginación; dos puntos de entrada (Topbar chip + StationPanel clickeable); afecta Dashboard y Gráficas.

### Modified Capabilities

- `backend-api`: El endpoint `GET /api/stations` pasa de devolver `list[StationResponse]` sin parámetros a devolver `StationPage { total, page, data }` con soporte de `?page=` y `?search=`.
- `web-dashboard`: El Dashboard y GraficasPanel pasan a operar sobre la estación seleccionada en lugar de la constante `alpha`; se añaden los dos triggers de apertura del modal.

## Impact

- **Backend**: `services/stations.py` (refactor de `list_stations`), `schemas.py` (nuevo `StationPage`), `routes.py` (firma y response model de `GET /api/stations`).
- **Frontend**: nuevo componente `StationSwitcherModal.tsx`; modificados `App.tsx`, `Topbar.tsx`, `StationPanel.tsx`, `GraficasPanel.tsx`; actualizados `api/client.ts`, `api/hooks.ts`, `api/types.ts`.
- **Breaking change de API**: `GET /api/stations` cambia su response shape; el frontend se actualiza en el mismo change.
- Sin impacto en firmware, gateway, android ni modelos 3D.
