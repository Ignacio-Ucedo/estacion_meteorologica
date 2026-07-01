## 1. Configuración de gráficos centralizada

- [x] 1.1 Crear `frontend/src/data/MetricChartConfig.ts` con un mapa por `metricKey` (`temperature`, `humidity`, `windSpeed`, `precipitation`) que contenga `title`, `tone`, `kind`, `dataKey`, `unit`, `color`, `domainMin`, `domainMax`, `axisStep`, `tickStep`, replicando los valores actuales de `Graficaspanel.tsx`.
- [x] 1.2 Refactorizar `frontend/src/components/Graficaspanel.tsx` para iterar `MetricChartConfig` en vez de declarar los 4 `<ChartCard>` a mano, pasando `data={weatherSeries}` y `daily7/30/365` desde `dailySeries[metricKey]`.
- [x] 1.3 Verificar visualmente que la pestaña "Gráficas" se ve idéntica antes y después del refactor (mismos colores, dominios y periodos). Verificado manualmente por el usuario en navegador.

## 2. Vincular metric cards con su metricKey

- [x] 2.1 Agregar el campo `metricKey` al array `metrics` en `frontend/src/App.tsx` para Temperatura, Humedad, Velocidad del viento y Precipitación acumulada; dejar sin `metricKey` (o `metricKey: undefined`) la entrada de Dirección del viento.
- [x] 2.2 Agregar prop opcional `onSelect`/`selectable` a `frontend/src/components/MetricCard.tsx` para que sea clickeable solo cuando tiene `metricKey` asociado (estilo/cursor que indique interactividad).

## 3. Gráfico inline de la variable seleccionada

- [x] 3.1 Crear componente `frontend/src/components/SelectedMetricChart.tsx` que reciba `metricKey` y renderice un único `ChartCard` usando los props resueltos desde `MetricChartConfig` + `weatherSeries`/`dailySeries`, sin overlay ni modal (componente inline).
- [x] 3.2 En `frontend/src/App.tsx`, agregar estado `selectedMetricKey` (`useState<MetricKey>("temperature")`, con valor inicial para que siempre haya un gráfico visible), pasar `onSelect` y `active` a cada `MetricCard` del dashboard, y renderizar `SelectedMetricChart` siempre, debajo del grid de metric cards.
- [x] 3.3 Resaltar visualmente la metric card cuya `metricKey` coincide con `selectedMetricKey` (clase `active` en `MetricCard`).
- [x] 3.4 Confirmar que clickear la tarjeta de Batería o la de Dirección del viento no cambia el gráfico mostrado (no tienen `metricKey`/`onSelect`).

## 4. Verificación

- [x] 4.1 Probar manualmente en navegador: el dashboard muestra un gráfico por defecto al cargar, clickear cada metric card con histórico actualiza el gráfico in place y resalta la card activa, y los toggles de periodo (1D/7D/30D/1Y) funcionan dentro del panel. Verificado manualmente por el usuario en navegador.
- [x] 4.2 Confirmar que no se introdujeron llamadas duplicadas a datos ni nuevos componentes de gráfico fuera de `ChartCard` (se reutiliza `ChartCard` desde `SelectedMetricChart` y `GraficasPanel`, ambos consumen `metricChartConfig`/`weatherSeries`/`dailySeries`).
