## Context

El dashboard actual importa `STATION_ID = "alpha"` como constante de módulo desde `api/config.ts`. Esta constante es consumida directamente por `App.tsx`, `GraficasPanel.tsx` y `Stationlogpanel.tsx`. No existe ningún mecanismo para cambiar de estación en runtime.

El backend ya expone `GET /api/stations` y el hook `useStations()` ya existe en el frontend, pero ninguno tiene soporte de paginación ni búsqueda.

```
Estado actual:
  config.ts: STATION_ID = "alpha"  ← constante fija
      ↓ importado en
  App.tsx          → useStation(STATION_ID)
  Graficaspanel.tsx → useHourlyMetric(STATION_ID) × 4 métricas
  Stationlogpanel.tsx → useReadings(STATION_ID)
```

## Goals / Non-Goals

**Goals:**
- Permitir cambiar de estación activa desde el Dashboard sin recargar la página.
- Dos puntos de entrada: chip en Topbar y StationPanel clickeable.
- Modal con búsqueda por nombre y paginación de 6 estaciones por página.
- Dashboard y Gráficas reaccionan al cambio de estación.
- Backend expone `GET /api/stations?page=&search=` con respuesta paginada.
- Persistir la estación seleccionada en `localStorage`; si ya no existe al volver, auto-seleccionar otra.

**Non-Goals:**
- Historial (`StationLogPanel`): no filtra por estación seleccionada; ya tiene su propia búsqueda por nombre.
- Gestión de estaciones (`StationManagementPanel`): panel independiente, no afectado.
- Paginación server-side para otras colecciones (readings, metrics): no cambian.

## Decisions

### 1. Estado de estación en `App.tsx`, no React Context

**Decisión:** `selectedStationId` vive como `useState` en `App.tsx` y se pasa como prop a los componentes afectados.

**Alternativa descartada:** React Context global. Overkill para dos componentes afectados (Dashboard y Gráficas); los paneles independientes (Historial, Gestión) no necesitan el ID.

**Alternativa descartada:** URL query param (`?station=alpha`). Agrega complejidad de routing no justificada en esta etapa.

### 2. Paginación server-side en `GET /api/stations`

**Decisión:** La paginación se implementa en el backend (query con `LIMIT`/`OFFSET`). El frontend no pre-fetcha la lista completa.

**Alternativa descartada:** Client-side pagination (fetch todo, paginar en memoria). Funciona con pocas estaciones pero no escala; dado que el diseño contempla muchas estaciones, server-side es la opción correcta desde el inicio.

**Parámetros del endpoint:**
```
GET /api/stations?page=1&search=<nombre>
Response: { total: int, page: int, data: StationResponse[] }
PAGE_SIZE = 6 (fijo en backend)
```

### 3. Dos triggers de apertura del modal

**Decisión:** Chip en Topbar + StationPanel entero clickeable.

El chip en Topbar muestra el nombre de la estación activa y es siempre visible. El StationPanel clickeable es el punto de entrada más natural para el usuario que está mirando la estación activa y quiere cambiarla.

### 4. Persistencia en localStorage con fallback ante estación eliminada

**Decisión:** Al seleccionar una estación se guarda su `id` en `localStorage` bajo la clave `selectedStationId`. Al montar `App.tsx`, se lee ese valor y se usa como ID inicial; si no hay valor guardado se usa `STATION_ID` como default.

El fallback opera así: al cargar la app, si el ID leído de localStorage responde con 404 al llamar a `GET /api/stations/{id}`, se llama a `GET /api/stations?page=1` y se selecciona automáticamente el primer resultado. Si no hay estaciones en la base, el estado queda vacío y el Dashboard muestra el banner de error existente.

**Alternativa descartada:** Validar el ID contra la lista antes de montar. Requeriría un fetch adicional en secuencia antes del primer render; el enfoque de "intentar cargar y reaccionar al 404" es más simple y reutiliza el flujo de error ya existente en `useStation`.

**Clave localStorage:** `"station-monitor:selected-station"` (con prefijo de app para evitar colisiones).

### 5. Reset de página al buscar en el modal

**Decisión:** Cada vez que el usuario modifica el texto de búsqueda, `page` vuelve a 1 automáticamente. La búsqueda se dispara con debounce de 300ms o al presionar Enter.

## Data Flow

```
App.tsx
  state: selectedStationId (string, init: localStorage ?? STATION_ID)
  state: switcherOpen (boolean)
  │
  ├── Topbar
  │     prop: stationName (station?.name ?? "—")
  │     prop: onSwitchStation → setSwitcherOpen(true)
  │
  ├── StationPanel
  │     prop: onSwitchStation → setSwitcherOpen(true)
  │     (existentes: name, location, status, badge, lastUpdated)
  │
  ├── [Dashboard]
  │     useStation(selectedStationId)
  │     SelectedMetricChart: stationId={selectedStationId}  ← ya es prop
  │
  ├── [Gráficas]
  │     GraficasPanel: stationId={selectedStationId}  ← NUEVA prop
  │           └─ MetricChart: stationId  ← threadeado desde GraficasPanel
  │
  ├── [Historial] → StationLogPanel: sin cambios
  ├── [Gestión]   → StationManagementPanel: sin cambios
  │
  └── StationSwitcherModal
        props: open, onClose, selectedId, onSelect(id)
        │
        ├── useStations(page, search)
        │     → GET /api/stations?page=N&search=X
        │     → { total, page, data: StationResponse[] }
        │
        ├── local state: search (string), page (number)
        └── onSelect(id) → setSelectedStationId(id); localStorage.set(id); setSwitcherOpen(false)
```

## Risks / Trade-offs

- **`GraficasPanel` threadea `stationId` a `MetricChart` interno**: el componente `MetricChart` no es exportado, vive dentro de `GraficasPanel.tsx`. El refactor es local y no rompe otras superficies. Bajo riesgo.
- **Breaking change de API**: `GET /api/stations` cambia su response shape de `list[StationResponse]` a `StationPage`. Frontend se actualiza en el mismo change; no hay otros consumidores conocidos.
- **`STATION_ID` en `config.ts` queda como fallback de inicialización**: si localStorage está vacío, se usa la constante como default, evitando un flash de "sin datos" en el primer render.
- **Fallback por estación eliminada**: el 404 de `useStation` dispara un fetch a `GET /api/stations?page=1` para auto-seleccionar la primera estación disponible. Si la base está vacía, el Dashboard muestra el banner de error existente; no se produce un loop infinito porque el fallback se ejecuta una sola vez (guardado en un ref o derivado del estado de error).

## Migration Plan

1. Backend primero: modificar `list_stations`, agregar `StationPage` schema, actualizar ruta. Sin downtime, el endpoint anterior no tiene consumidores externos.
2. Frontend: actualizar `api/types.ts`, `api/client.ts`, `api/hooks.ts`.
3. Refactorizar `GraficasPanel` para recibir `stationId` como prop.
4. Implementar `StationSwitcherModal`.
5. Actualizar `App.tsx` (estado + modal), `Topbar` (chip), `StationPanel` (clickeable).

Rollback: revertir commits por componente; el backend es el único cambio con impacto externo y es aditivo en parámetros (query params opcionales en degradación).

## Open Questions

- ~~¿Debería el chip del Topbar mostrar un indicador de estado (dot de color) junto al nombre de la estación, o solo el nombre?~~ **Resuelto:** el chip muestra solo el nombre de la estación.
