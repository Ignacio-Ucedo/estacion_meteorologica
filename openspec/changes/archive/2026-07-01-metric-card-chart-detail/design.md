## Context

El dashboard principal (`frontend/src/App.tsx`) renderiza un array local `metrics` (label, value, unit, detail, tone) como `MetricCard` (`frontend/src/components/MetricCard.tsx`), sin estado de selección ni interacción. La pestaña "Gráficas" (`GraficasPanel` en `frontend/src/components/Graficaspanel.tsx`) ya define, por cada variable, los props completos de `ChartCard` (`dataKey`, `metricKey`, `daily7/30/365`, `unit`, `color`, `domain*`, `tickStep`) usando los datos de `frontend/src/data/Weatherseries.ts` (`weatherSeries`, `dailySeries`). Hoy esos datos son generados de forma procedural en el frontend; el backend ya expone `GET /stations/{station_id}/metrics/{metric}/hourly` y `/daily?days=` con la forma `HourlyPoint`/`DailySummary`, pero el frontend todavía no los consume. Esta propuesta no cambia esa relación dato-componente; solo agrega un segundo punto de entrada (la metric card) hacia el mismo `ChartCard`.

No existe hoy ningún hook ni contexto global: cada componente maneja su propio estado (`useState`) y los props de gráfico se escriben a mano en `GraficasPanel`. Para evitar duplicar esa configuración entre `GraficasPanel` y el nuevo flujo de "click en metric card", conviene extraer esa configuración por variable a un único lugar.

## Goals / Non-Goals

**Goals:**
- Permitir click/selección sobre una `MetricCard` de variables con histórico (temperatura, humedad, viento, precipitación) para ver su evolución temporal sin salir del dashboard.
- Reutilizar `ChartCard` y los datos de `Weatherseries.ts` tal cual los usa `GraficasPanel`, sin reimplementar fetch ni render de series.
- Centralizar en un solo lugar el mapeo `metricKey → { título, dataKey, unit, color, domain, dailySeries, ... }` para que tanto `GraficasPanel` como el nuevo flujo de detalle lo consuman.

**Non-Goals:**
- No se conecta el frontend a los endpoints reales del backend (`/hourly`, `/daily`) en este cambio; se sigue usando `Weatherseries.ts`. Migrar a datos reales del backend es un cambio aparte.
- No se agrega gráfico para la tarjeta de Batería ni para Dirección del viento (no tienen serie temporal definida en `Weatherseries.ts`).
- No se introduce una librería de estado global (Redux/Zustand/Context API genérico); se usa `useState` en `App.tsx`, consistente con el patrón actual.

## Decisions

1. **Extraer configuración de métricas a un mapa compartido** (`metricChartConfig`, ubicado junto a `Weatherseries.ts` o en un nuevo `frontend/src/data/MetricChartConfig.ts`) que indexe por `metricKey` los props fijos hoy hardcodeados en `Graficaspanel.tsx` (`title`, `tone`, `kind`, `dataKey`, `unit`, `color`, `domainMin/Max`, `axisStep`, `tickStep`). `GraficasPanel` se refactoriza para iterar este mapa en vez de repetir 4 bloques `<ChartCard>` casi idénticos. El nuevo flujo de detalle de metric card usa el mismo mapa.
   - Alternativa descartada: duplicar los props de `ChartCard` dentro de `MetricCard`/`App.tsx`. Se descarta porque viola el objetivo explícito de no duplicar lógica ya existente en "Gráficas".

2. **Vincular cada entrada de `metrics` (en `App.tsx`) a un `metricKey`** agregando ese campo al array existente (hoy solo tiene `label/value/unit/detail/tone`). Esto evita parsear o adivinar el `metricKey` a partir del `label` en tiempo de render.

3. **Mostrar el gráfico siempre visible dentro del dashboard, debajo del grid de metric cards**, controlado por `App.tsx` (`selectedMetricKey: MetricKey` vía `useState`, con `"temperature"` como valor inicial para que siempre haya un gráfico visible). Al hacer click en una card con histórico, `selectedMetricKey` cambia y el panel se actualiza in place; la card seleccionada se resalta visualmente (`active`). Se descartó el modal/overlay porque el pedido explícito es que el gráfico forme parte del dashboard de forma persistente, no como un elemento emergente.
   - Alternativa descartada: modal/overlay que se abre y cierra. Se descartó porque oculta el resto del dashboard y no resuelve el objetivo de tener el gráfico siempre visible en el flujo principal.
   - Alternativa considerada: navegar automáticamente a la pestaña "Gráficas" con la card correspondiente resaltada. Se descarta porque no resuelve el problema real (seguir requiriendo cambio de contexto) que motiva esta propuesta.

4. **`MetricCard` se mantiene como componente presentacional**: se le agrega un `onSelect`/`onClick` opcional (prop), pero no conoce `ChartCard` ni el mapa de configuración. La composición (qué card abre qué gráfico) vive en `App.tsx`. Esto preserva la separación actual entre presentación y orquestación de datos.

## Risks / Trade-offs

- [Riesgo] El array `metrics` en `App.tsx` y el `metricChartConfig` quedan como dos fuentes separadas que deben mantenerse coherentes (mismo `metricKey`) → Mitigación: el `metricKey` es la única clave de unión y se valida con tipos TypeScript compartidos (`MetricKey`) ya definidos en `Weatherseries.ts`.
- [Riesgo] Si en el futuro se conecta el frontend a los endpoints reales del backend, el panel de detalle y `GraficasPanel` deberán migrar a la vez (comparten el mismo mapa de configuración) → Mitigación aceptable: es justamente el efecto buscado de centralizar la configuración, evita una migración duplicada.
- [Trade-off] Mostrar siempre un gráfico (por defecto el de Temperatura) agrega altura fija al dashboard incluso antes de que el usuario interactúe → aceptable porque es justamente el comportamiento pedido: el gráfico debe estar siempre presente, no ser un elemento opcional/emergente.
