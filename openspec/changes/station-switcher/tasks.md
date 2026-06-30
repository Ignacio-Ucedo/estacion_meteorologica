## 1. Backend — Paginación de estaciones

- [x] 1.1 Agregar `StationPage` schema en `backend/app/schemas.py` con campos `total: int`, `page: int`, `data: list[StationResponse]`
- [x] 1.2 Refactorizar `list_stations` en `backend/app/services/stations.py` para aceptar `page: int` y `search: str | None`, aplicar `LIMIT`/`OFFSET` con `PAGE_SIZE = 6`, y devolver `tuple[int, list[Station]]`
- [x] 1.3 Actualizar el endpoint `GET /stations` en `backend/app/api/routes.py` para aceptar query params `page` (ge=1, default=1) y `search` (opcional), usar la nueva firma de `list_stations` y devolver `StationPage`
- [x] 1.4 Verificar que `GET /api/stations`, `GET /api/stations?page=2` y `GET /api/stations?search=alpha` respondan correctamente con la forma `{ total, page, data }`

  _Commit sugerido: `feat(backend)!: paginar endpoint GET /stations con page y search`_

## 2. Frontend — Capa de API

- [x] 2.1 Agregar tipo `StationPage` en `frontend/src/api/types.ts` con campos `total: number`, `page: number`, `data: StationResponse[]`
- [x] 2.2 Actualizar `listStations` en `frontend/src/api/client.ts` para aceptar `page: number` y `search?: string`, construir query params y devolver `Promise<StationPage>`
- [x] 2.3 Actualizar `useStations` en `frontend/src/api/hooks.ts` para aceptar `page: number` y `search: string`, incluirlos en el array de dependencias de `useFetch`

  _Commit sugerido: `feat(frontend): actualizar cliente API para StationPage paginado`_

## 3. Frontend — Refactor de GraficasPanel

- [x] 3.1 Agregar prop `stationId: string` a `GraficasPanel` y al componente interno `MetricChart` en `frontend/src/components/Graficaspanel.tsx`
- [x] 3.2 Reemplazar el import de `STATION_ID` en `Graficaspanel.tsx` por el uso de la prop `stationId` en las llamadas a `useHourlyMetric` y `useDailyMetric`

  _Commit sugerido: `refactor(frontend): hacer stationId prop explícita en GraficasPanel`_

## 4. Frontend — Modal de selección de estaciones

- [x] 4.1 Crear componente `StationSwitcherModal` en `frontend/src/components/StationSwitcherModal.tsx` con props `open`, `onClose`, `selectedId`, `onSelect`
- [x] 4.2 Implementar estado local `search` y `page` dentro del modal; llamar a `useStations(page, search)` para obtener los datos
- [x] 4.3 Renderizar la lista de estaciones con nombre, ubicación y badge de estado; resaltar la estación actualmente seleccionada
- [x] 4.4 Implementar campo de búsqueda que resetee `page` a 1 al cambiar; incluir botón de limpiar búsqueda
- [x] 4.5 Implementar controles de paginación (‹ página anterior / N de M / página siguiente ›)
- [x] 4.6 Al hacer click en una estación, llamar a `onSelect(id)` y cerrar el modal
- [x] 4.7 Implementar cierre del modal con botón [×] y click en el overlay fuera del contenido

  _Commit sugerido: `feat(frontend): agregar StationSwitcherModal con búsqueda y paginación`_

## 5. Frontend — Triggers de apertura del modal

- [x] 5.1 Agregar props `stationName: string` y `onSwitchStation: () => void` a `Topbar` en `frontend/src/components/Topbar.tsx`; renderizar chip `[⇄ <nombre> ▾]` en la zona de acciones
- [x] 5.2 Agregar prop `onSwitchStation: () => void` a `StationPanel` en `frontend/src/components/StationPanel.tsx`; hacer toda la card clickeable con `cursor: pointer` e indicador visual de interactividad

  _Commit sugerido: `feat(frontend): agregar triggers de apertura del selector de estaciones`_

## 6. Frontend — Persistencia en localStorage

- [x] 6.1 Crear helper `getPersistedStationId(): string` y `persistStationId(id: string): void` en `frontend/src/api/config.ts` (o un archivo `storage.ts`), usando la clave `"station-monitor:selected-station"`; `getPersistedStationId` devuelve el valor guardado o `STATION_ID` si no hay ninguno
- [x] 6.2 En `App.tsx`, inicializar `selectedStationId` con `useState(() => getPersistedStationId())`
- [x] 6.3 En el handler `onSelect` del modal, llamar a `persistStationId(id)` antes de actualizar el estado
- [x] 6.4 Detectar el caso de estación eliminada: cuando `useStation` devuelve un error 404, ejecutar una sola vez `GET /api/stations?page=1` (usando `listStations`) y auto-seleccionar `data[0].id`; si `data` está vacío, no reintentar
- [x] 6.5 Verificar que recargar la página con una estación previamente seleccionada no produce flash de la estación por defecto

  _Commit sugerido: `feat(frontend): persistir estación seleccionada en localStorage con fallback`_

## 7. Frontend — Integración en App.tsx

- [x] 7.1 Reemplazar la importación de `STATION_ID` por `useState(() => getPersistedStationId())` en `frontend/src/App.tsx` para crear `selectedStationId`
- [x] 7.2 Agregar `useState(false)` para `switcherOpen`
- [x] 7.3 Pasar `stationName={station?.name ?? "—"}` y `onSwitchStation={() => setSwitcherOpen(true)}` al componente `Topbar`
- [x] 7.4 Pasar `onSwitchStation={() => setSwitcherOpen(true)}` al componente `StationPanel`
- [x] 7.5 Pasar `stationId={selectedStationId}` al componente `GraficasPanel` en la rama `case "graficas"` del `renderPanel`
- [x] 7.6 Montar `StationSwitcherModal` con `open={switcherOpen}`, `onClose`, `selectedId={selectedStationId}`, `onSelect={(id) => { persistStationId(id); setSelectedStationId(id); setSwitcherOpen(false); }}`

  _Commit sugerido: `feat(frontend): integrar selector de estaciones en App.tsx`_
