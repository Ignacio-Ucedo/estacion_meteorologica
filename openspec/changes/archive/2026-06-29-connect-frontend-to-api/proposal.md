## Why

El frontend muestra únicamente datos mock generados en el cliente; el backend FastAPI tiene todos los endpoints REST implementados y la base de datos PostgreSQL contiene lecturas reales. Es el momento de conectar ambas partes para que el dashboard refleje el estado actual de la estación.

## What Changes

- Agregar una capa de cliente HTTP tipado en `frontend/src/api/` que encapsule todas las llamadas a la API REST.
- Reemplazar los datos inline de `App.tsx` (nombre, estado y métricas de la estación) con datos de `GET /api/stations/{id}` y `GET /api/stations/{id}` (detail).
- Reemplazar `weatherSeries` y `dailySeries` (generados aleatoriamente en `WeatherSeries.ts`) con respuestas de `GET /api/stations/{id}/metrics/{metric}/hourly` y `.../daily?days=N`.
- Reemplazar `generateReading()` en `StationLogPanel` con datos paginados de `GET /api/stations/{id}/readings`.
- Reemplazar `INITIAL_STATIONS` de `StationManagementPanel` con datos de `GET /api/stations`.
- Habilitar CORS en el backend FastAPI para el origen del dev server de Vite (`http://localhost:5173`), o configurar un proxy en Vite.
- Agregar estados de carga y error a todos los componentes que consuman la API.
- El nivel de batería permanece con valor hardcodeado (`null`) hasta que se implemente `add-battery-level-backend`.

## Capabilities

### New Capabilities
- `frontend-api-client`: Cliente HTTP tipado para el backend REST, con funciones una por endpoint, tipos de respuesta derivados del spec de la API, y manejo de errores centralizado.

### Modified Capabilities
- `web-dashboard`: Los requisitos de visualización no cambian, pero el origen de los datos pasa de ser mock a ser la API real. Los escenarios de error (backend no disponible) ahora aplican de verdad: los componentes deben mostrar mensajes de error en lugar de datos falsos.

## Impact

- `frontend/src/api/` — nuevo directorio con el cliente de API (nuevo).
- `frontend/src/App.tsx` — consume datos reales de estación y métricas actuales.
- `frontend/src/components/SelectedMetricChart.tsx` — consume series horarias desde la API.
- `frontend/src/components/Graficaspanel.tsx` — consume series diarias desde la API.
- `frontend/src/components/Stationlogpanel.tsx` — consume historial paginado desde la API.
- `frontend/src/components/StationManagmentPanel.tsx` — consume lista de estaciones desde la API.
- `frontend/src/data/WeatherSeries.ts` y `Stationlog.ts` — eliminados o reducidos a solo sus tipos.
- `backend/app/main.py` — agregar `CORSMiddleware` para desarrollo local.
- No hay cambios de schema de base de datos, no hay cambios de payload LoRa, no hay impacto en firmware ni gateway.
