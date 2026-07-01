## Why

Hoy todas las superficies de carga del dashboard (header de estación, metric cards, gráficos, tablas y el modal de selección de estación) muestran el mismo texto estático "Cargando…" sin ninguna animación, y en el caso de `MetricCard` no hay siquiera un estado de carga: mientras los datos llegan se muestra "—", indistinguible de "sin datos". El resultado es que no es obvio para el usuario que la aplicación está trabajando, especialmente en gráficos y tablas donde la carga tarda más. Esto contrasta con el estado de error, que desde el cambio `add-inline-error` ya tiene un tratamiento visual dedicado (`InlineError`).

## What Changes

- Nuevo componente compartido `Skeleton` (bloque gris con animación de pulso de opacidad, ancho/alto/radius configurables), reutilizable en todo el dashboard siguiendo el mismo patrón que `InlineError`.
- Reemplazo del texto "Cargando…" por composiciones de `Skeleton` en las 6 superficies de carga existentes:
  - `StationPanel` (header): líneas fantasma para badge de estado y "última actualización".
  - `MetricCard`: **nuevo** prop `loading?: boolean` (no existía) — muestra líneas fantasma para label/value/detail en vez de "—".
  - `ChartCard` (usado por `GraficasPanel` y `SelectedMetricChart`): silueta de gráfico fantasma dependiente del prop `kind` existente — barras fantasma de alturas fijas variadas para `kind="bar"`, curva SVG ondulada estática para `kind="line"`/`"area"`.
  - `StationLogPanel`, `StationManagementPanel`, `StationSwitcherModal`: 5 filas fantasma fijas en vez del texto "Cargando…"/"Cargando estaciones…".
- La animación de pulso respeta `prefers-reduced-motion: reduce` (se deshabilita), siguiendo la convención ya existente en `styles.css` para `.log-live-dot` y `.log-row-enter`.
- Sin delay artificial: el skeleton se muestra inmediatamente cuando `loading === true`, sin umbral mínimo de tiempo.
- Las siluetas de gráfico y las filas fantasma son puramente decorativas (no son previews de datos reales).

## Capabilities

### New Capabilities
- `loading-skeleton`: componente compartido `Skeleton` y su aplicación consistente como estado de carga en las 6 superficies del dashboard que hoy muestran texto estático.

### Modified Capabilities
(ninguna — no cambia el contrato de `web-dashboard` ni de `inline-error`; el estado de error sigue siendo responsabilidad exclusiva de `InlineError`, este cambio solo cubre el estado de carga)

## Impact

- Afecta únicamente `frontend/` (React + TypeScript). Sin impacto en firmware, gateway, backend, Android ni 3D; no cambia el formato de payload LoRa ni el contrato de la API REST.
- Archivos nuevos: `frontend/src/components/Skeleton.tsx`.
- Archivos modificados: `frontend/src/components/MetricCard.tsx`, `frontend/src/components/ChartCard.tsx`, `frontend/src/components/StationPanel.tsx`, `frontend/src/components/Stationlogpanel.tsx`, `frontend/src/components/StationManagmentPanel.tsx`, `frontend/src/components/StationSwitcherModal.tsx`, `frontend/src/App.tsx` (pasar `loading` a `MetricCard`), `frontend/src/styles.css` (clases `.skeleton*`, `@keyframes` de pulso, entrada en el bloque `prefers-reduced-motion`).
- Sin nuevas dependencias externas (CSS + SVG estático, sin librería de animación).
- No solapa con el cambio activo `metric-card-chart-detail` (sus tareas pendientes son solo verificación manual, no tocan estados de carga).
