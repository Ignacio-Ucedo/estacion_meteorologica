## Why

Hoy el dashboard principal muestra las métricas actuales (temperatura, humedad, viento, dirección, precipitación, batería) como tarjetas estáticas (`MetricCard`), y la evolución temporal de cada variable solo es visible si el usuario navega manualmente a la pestaña "Gráficas". Esto obliga a un cambio de contexto y a buscar manualmente el gráfico correspondiente a la métrica que le interesa. Permitir que el usuario haga click en una metric card y vea ahí mismo la evolución de esa variable reduce la fricción y reutiliza una lógica de gráficos que ya existe y está validada.

## What Changes

- Las `MetricCard` del dashboard principal se vuelven interactivas (clickeables/seleccionables) cuando representan una variable con datos históricos disponibles (temperatura, humedad, viento, precipitación).
- El dashboard principal muestra siempre, debajo del grid de metric cards, un gráfico con la evolución de la variable actualmente seleccionada (por defecto Temperatura), reutilizando el componente `ChartCard` y los mismos periodos (1D/7D/30D/1Y) ya soportados en la pestaña "Gráficas". Al seleccionar otra metric card, el gráfico se actualiza in place sin ocultar el resto del dashboard.
- Se introduce un mapeo entre el `label`/tono de cada `MetricCard` y su `metricKey`/endpoint correspondiente, para no duplicar la lógica de obtención de datos ni de render que ya usa `Graficaspanel.tsx`.
- La tarjeta de batería no abre gráfico en este alcance inicial (no expone series históricas hoy); queda fuera de esta iteración.
- No se modifican los endpoints del backend (`/stations/{station_id}/metrics/{metric}/hourly` y `/daily`); se reutilizan tal cual.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `web-dashboard`: se agrega el requisito de que el dashboard principal permita visualizar el gráfico histórico de una variable directamente desde su metric card, reutilizando el mismo flujo de datos y componente de gráfico que la pestaña "Gráficas", sin duplicar lógica de fetch/render.

## Impact

- Frontend: `frontend/src/components/MetricCard.tsx` (agrega interacción/selección y resaltado de la card activa), `frontend/src/App.tsx` (estado de métrica seleccionada y render del panel de gráfico inline), `frontend/src/components/ChartCard.tsx` y `frontend/src/components/Graficaspanel.tsx` (se reutilizan sin duplicar), nuevo componente liviano `SelectedMetricChart` para el panel inline.
- Backend: sin cambios (se reutilizan los endpoints existentes de métricas horarias/diarias).
- No hay cambios de breaking ni de esquema de datos.
