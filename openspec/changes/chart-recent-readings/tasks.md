## 1. Backend — endpoint de lecturas recientes

- [x] 1.1 Agregar tipo de respuesta `RecentMetricResponse` a `backend/app/schemas.py`: campos `metric: str`, `unit: str`, `minutes: int`, `points: list[MetricPoint]` (reutilizar el `MetricPoint` ya existente con `timestamp` y `value`). Commit sugerido: `feat(backend): agregar schema RecentMetricResponse`.

- [x] 1.2 Agregar función `get_recent_metric(session, station_id, metric, minutes) -> list[MetricPoint]` en `backend/app/services/metrics.py`. Debe: validar que `metric` es uno de los soportados (`temperature`, `humidity`, `wind_speed`, `precipitation`) y que `minutes` está en [1, 1440]; hacer `SELECT timestamp, <column> FROM readings WHERE station_id=… AND timestamp >= now() - interval '… minutes' ORDER BY timestamp ASC`; devolver lista de `MetricPoint`. No requiere hardware. Commit sugerido: `feat(backend): agregar query de lecturas recientes en metrics service`.

- [x] 1.3 Agregar ruta `GET /stations/{station_id}/metrics/{metric}/recent` en `backend/app/api/routes.py` con query param `minutes: int = Query(default=60, ge=1, le=1440)`. Debe: verificar que la estación existe (404 si no); llamar a `get_recent_metric`; devolver `RecentMetricResponse`. No requiere hardware. Commit sugerido: `feat(backend): agregar endpoint GET /metrics/{metric}/recent`.

## 2. Frontend — cliente y hook

- [x] 2.1 Agregar tipo `RecentMetricResponse` a `frontend/src/api/types.ts`: `{ metric: string; unit: string; minutes: number; points: MetricPoint[] }` (reutilizar `MetricPoint` existente). Commit incluido en 2.2.

- [x] 2.2 Agregar función `getRecentMetric(id, metric, minutes?)` a `frontend/src/api/client.ts` que llame a `GET /stations/{id}/metrics/{metric}/recent?minutes={minutes}` y agregar hook `useRecentMetric(id, metric, minutes?)` en `frontend/src/api/hooks.ts`. Commit sugerido: `feat(frontend): agregar cliente y hook para endpoint de lecturas recientes`.

## 3. Frontend — componentes de gráficas

- [x] 3.1 Modificar `frontend/src/components/SelectedMetricChart.tsx`: reemplazar el uso de `useHourlyMetric` por `useRecentMetric` para la pestaña "1H"; ajustar el `tickFormatter` del eje X para formatear timestamps ISO como `HH:MM` cuando la pestaña activa es "1H" (el resto de pestañas mantiene el formato actual). Commit sugerido: `feat(frontend): usar endpoint de lecturas recientes en la pestaña 1H de SelectedMetricChart`.

- [x] 3.2 Aplicar el mismo cambio en `frontend/src/components/Graficaspanel.tsx`: reemplazar `useHourlyMetric` por `useRecentMetric`, ajustar `tickFormatter` del eje X para la vista "1H". Commit sugerido: `feat(frontend): usar endpoint de lecturas recientes en la pestaña 1H de GraficasPanel`.

## 4. Validación

- [x] 4.1 Verificar que con el stack corriendo (`docker compose up -d`) y al menos una lectura reciente, la pestaña "1H" del dashboard muestra puntos con timestamps `HH:MM` reales. No requiere hardware (funciona con `gateway-node-mock`).

- [x] 4.2 Verificar que las pestañas 7D, 30D y 1A siguen funcionando sin cambios.

- [x] 4.3 Verificar que la pestaña "1H" muestra estado vacío (sin error) cuando no hay lecturas en el último período.
