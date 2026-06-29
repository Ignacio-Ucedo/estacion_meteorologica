## 1. Backend — Habilitar CORS

- [x] 1.1 Agregar `CORSMiddleware` en `backend/app/main.py` con `allow_origins=["http://localhost:5173"]`, `allow_methods=["*"]`, `allow_headers=["*"]`
- [x] 1.2 Crear `frontend/.env.local` con `VITE_API_URL=http://localhost:8000` (no commitear este archivo)

> Commit sugerido: `feat(backend): habilitar CORS para el dev server de Vite`

## 2. Frontend — Capa de cliente API

- [x] 2.1 Crear `frontend/src/api/config.ts` con la constante `STATION_ID = "alpha"` y `BASE_URL` leída de `import.meta.env.VITE_API_URL` con fallback a `http://localhost:8000`
- [x] 2.2 Crear `frontend/src/api/types.ts` con los tipos TypeScript de respuesta para todos los endpoints: `StationResponse`, `StationDetail`, `CurrentReading`, `ReadingPage`, `ReadingResponse`, `HourlyMetricResponse`, `HourlyPoint`, `DailyMetricResponse`, `DailySummary`
- [x] 2.3 Crear `frontend/src/api/client.ts` con la función `apiFetch<T>(path, init?)` y las funciones por endpoint: `getStation`, `listStations`, `getReadings`, `getHourlyMetric`, `getDailyMetric`
- [x] 2.4 Crear `frontend/src/api/hooks.ts` con los hooks `useStation`, `useStations`, `useReadings`, `useHourlyMetric`, `useDailyMetric`, cada uno retornando `{ data, loading, error }`

> Commit sugerido: `feat(frontend): agregar capa de cliente HTTP tipado para la API REST`

## 3. Frontend — Dashboard principal (App.tsx y StationPanel)

- [x] 3.1 Reemplazar los datos inline de `App.tsx` (`station`, `metrics`, `batteryLevel`) por el hook `useStation(STATION_ID)`. Mantener `batteryLevel = null` hasta completar `add-battery-level-backend`
- [x] 3.2 Propagar el estado de `loading` y `error` de `useStation` al renderizado del dashboard: mostrar skeleton o mensaje de error cuando corresponda
- [x] 3.3 Actualizar `StationPanel` para derivar `lastUpdated` del campo `lastUpdatedAt` de la API (formateado como "Última actualización: hace N minutos")
- [x] 3.4 Actualizar las `MetricCards` para mostrar "—" cuando `current` es `null` (estación sin lecturas)

> Commit sugerido: `feat(frontend): conectar StationPanel y MetricCards con la API real`

## 4. Frontend — Gráficos (SelectedMetricChart y GraficasPanel)

- [x] 4.1 Modificar `SelectedMetricChart` para recibir `stationId` y usar `useHourlyMetric` y `useDailyMetric` en lugar de importar `weatherSeries` y `dailySeries`
- [x] 4.2 Modificar `GraficasPanel` para usar `useHourlyMetric` y `useDailyMetric` por cada métrica (`temperature`, `humidity`, `windSpeed`, `precipitation`)
- [x] 4.3 Agregar estado de `loading` en `ChartCard`: mostrar un indicador de carga mientras se espera la respuesta de la API
- [x] 4.4 Agregar estado de `error` en `ChartCard`: mostrar mensaje de error de conectividad cuando la API no responde
- [x] 4.5 Manejar arrays vacíos en `ChartCard`: mostrar mensaje "Sin datos disponibles" si la API retorna puntos vacíos

> Commit sugerido: `feat(frontend): conectar gráficos de métricas con los endpoints hourly y daily`

## 5. Frontend — Log de historial (StationLogPanel)

- [x] 5.1 Reemplazar `generateReading` y el `setInterval` del mock por el hook `useReadings(STATION_ID, page, search)`
- [x] 5.2 Pasar la paginación a server-side: `totalPages` y `total` se derivan del campo `total` de la respuesta `ReadingPage`
- [x] 5.3 Implementar auto-refresh: recargar `GET /api/stations/alpha/readings?page=1` cada 30 segundos, detenible con el botón "Pausar"
- [x] 5.4 Agregar estados de `loading` y `error` en la tabla: mostrar spinner o mensaje de error según corresponda

> Commit sugerido: `feat(frontend): conectar StationLogPanel con el historial paginado de la API`

## 6. Frontend — Gestión de estaciones (StationManagementPanel)

- [x] 6.1 Reemplazar `INITIAL_STATIONS` por el hook `useStations()` para cargar estaciones reales de `GET /api/stations`
- [x] 6.2 Adaptar `StationCard` para los campos de la API (`id`, `name`, `location`, `status`). Los campos `lastCommunication`, `battery` y `connection` no existen en la API aún — mostrar "N/A" para esos valores hasta que el backend los exponga
- [x] 6.3 Agregar estado de lista vacía: mostrar "No hay estaciones registradas" si la API retorna `[]`
- [x] 6.4 Agregar estados de `loading` y `error` en el panel

> Commit sugerido: `feat(frontend): conectar StationManagementPanel con la lista real de estaciones`

## 7. Limpieza de datos mock

- [x] 7.1 Vaciar `frontend/src/data/WeatherSeries.ts`: eliminar las funciones de generación (`generateDailySeries`, `prng`, `weatherSeries`, `dailySeries`). Conservar únicamente los tipos `WeatherPoint`, `DailySummary` y `MetricKey` si aún son referenciados por otros módulos
- [x] 7.2 Vaciar `frontend/src/data/Stationlog.ts`: eliminar `stations`, `generateReading`, `jitter`, `readingCounter`. Conservar `StationReading`, `StationDef` y `formatTimestamp` si aún son usados

> Commit sugerido: `refactor(frontend): eliminar generadores de datos mock reemplazados por la API`
