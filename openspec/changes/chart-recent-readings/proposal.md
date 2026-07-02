## Why

La pestaña "1H" de las gráficas del dashboard usa el endpoint de métricas horarias agregadas por bucket de reloj, lo que impide ver datos hasta que transcurre al menos una hora desde el primer uplink. Con lecturas que llegan cada 30 s, hay resolución suficiente para una vista de "última hora" inmediatamente útil desde el arranque del sistema.

## What Changes

- Backend: nuevo endpoint `GET /api/stations/{id}/metrics/recent?minutes=60&metric=<m>` que devuelve las filas crudas de `readings` del último período con timestamp real en el eje X (sin agregación por bucket).
- Frontend: la pestaña "1H" de `SelectedMetricChart` y `GraficasPanel` pasa a consumir este endpoint en lugar del horario agregado; el eje X muestra la hora exacta de cada lectura.

## Capabilities

### New Capabilities

- `recent-readings-chart`: Vista de lecturas crudas de la última hora (o N minutos configurables) en el dashboard, con timestamp real por punto en el eje X.

### Modified Capabilities

- `web-dashboard`: La pestaña "1H" cambia su fuente de datos de métricas horarias agregadas a lecturas recientes crudas; el comportamiento visible del eje X y la granularidad de los puntos cambia.
- `backend-API`: Nuevo endpoint de lecturas recientes por métrica y rango de tiempo.

## Impact

- `backend/app/api/routes.py` — nuevo route
- `backend/app/services/` — nueva query de lecturas recientes por métrica y ventana de tiempo
- `backend/app/schemas.py` — nuevo schema de respuesta
- `frontend/src/api/client.ts` y `hooks.ts` — nueva función y hook
- `frontend/src/components/SelectedMetricChart.tsx` y `GraficasPanel.tsx` — consumo del nuevo endpoint en la pestaña 1H
- Sin cambios en el firmware ni en la ingesta MQTT; no altera el payload LoRaWAN ni la cadena gateway → ChirpStack → backend
