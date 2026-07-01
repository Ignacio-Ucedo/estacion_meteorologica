## Context

Tres defectos de UI en el dashboard (`frontend/`), encontrados durante testing manual, con solución ya acordada con el usuario (no hay alternativas a evaluar, este documento formaliza las decisiones tomadas):

1. **Error de gráficos duplicado e inconsistente.** `GraficasPanel.tsx` (componente interno `MetricChart`) intercepta el error antes de llegar a `ChartCard` y renderiza `<InlineError>` por su cuenta, pasándole `error={null}` a `ChartCard` a propósito. `SelectedMetricChart.tsx` no intercepta nada y le pasa el error real a `ChartCard`, que internamente solo sabe mostrar un `<div className="chart-state-overlay chart-state-error">Sin conexión al servidor</div>` hardcodeado — nunca ejercitado por `GraficasPanel` (que lo esquiva), sí ejercitado por `SelectedMetricChart` (el Dashboard).
2. **`.chart-card-head` sin responsive.** Fila `display:flex; justify-content:space-between` sin `flex-wrap`, con el bloque de título a la izquierda (div sin clase) y `.chart-card-head-right` (`flex-shrink:0`, contiene `.period-toggle` con 4 botones) a la derecha. Ninguna media query la ajusta.
3. **`system-badge` vacío.** `App.tsx` calcula `badge` como `""` cuando `station` es `null` (error de carga), y `StationPanel.tsx` renderiza el `<span className="system-badge">` sin chequear si `badge` tiene contenido — solo chequea `loading`.

## Goals / Non-Goals

**Goals:**
- Unificar el mensaje de error de gráficos en un solo lugar (`ChartCard`), con el mismo texto en "Gráficas" y en el Dashboard.
- Que el encabezado de `ChartCard` (título + período) no se rompa visualmente en ningún ancho de pantalla, usando el fix más simple disponible (`flex-wrap`).
- Que el `system-badge` nunca se muestre vacío.

**Non-Goals:**
- No se rediseña el layout de `ChartCard` en mobile (`flex-direction: column` con breakpoint específico) — se deja como posible iteración futura si el wrap no resulta suficiente.
- No se agrega retry (`onRetry`) al `InlineError` de `ChartCard` — los hooks `useHourlyMetric`/`useDailyMetric` (`frontend/src/api/hooks.ts`) no exponen `refresh()`, a diferencia de `useStation`/`useStations`/`useReadings`. Mismo comportamiento que hoy (sin retry en gráficos).
- No se toca el estado "sin datos" (`isEmpty`) de `ChartCard`, solo el estado de error.

## Decisions

### 1. `InlineError` se mueve dentro de `ChartCard`

En `ChartCard.tsx`, la rama de error (`loading` false, `error` truthy) pasa de:
```tsx
<div className="chart-state-overlay chart-state-error">Sin conexión al servidor</div>
```
a:
```tsx
<InlineError message="No se pudieron cargar las gráficas de la estación." />
```
Sin `onRetry` (ver Non-Goals). `.inline-error` ya es un bloque autocontenido (flex column centrado, sin dependencias de layout externas — ver `openspec/specs/inline-error/spec.md`), así que encaja sin ajustes dentro de `.chart-card-body` (`flex:1; min-height:0`).

`GraficasPanel.tsx` elimina el `if (error) return <article>...<InlineError/></article>` y pasa `error={error}` a `ChartCard` en lugar de `error={null}`, igual que ya hace `SelectedMetricChart.tsx`. Esto:
- Elimina la duplicación de mensaje de error (antes vivía en dos componentes distintos).
- Cambia el comportamiento visual en "Gráficas": antes, un error ocultaba también el título y los botones de período del gráfico (el `<article>` de fallback no los incluía); después, el encabezado del `ChartCard` se mantiene visible siempre, y solo `chart-card-body` cambia a `InlineError` — mismo comportamiento que ya tenía el Dashboard. Se documenta como mejora de consistencia, no regresión.

Alternativa descartada: mantener el manejo de error duplicado en cada panel consumidor de `ChartCard` (la solución "mínima" que el usuario descartó explícitamente a favor de centralizarlo en el componente compartido).

### 2. `flex-wrap: wrap` en `.chart-card-head`

```css
.chart-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 4px;
}
```
Cuando el título + `.chart-card-head-right` no entran en una fila, `.chart-card-head-right` (con `.period-toggle`) baja a una segunda línea, sin necesidad de definir un breakpoint específico — se adapta de forma continua a cualquier ancho de card.

El bloque de título (div sin clase, hijo izquierdo de `.chart-card-head`) no tiene `min-width: 0`, por lo que en un contenedor flex puede resistirse a encogerse antes de que el wrap se dispare. Se agrega `min-width: 0` a ese bloque (envolviéndolo en una clase, p. ej. `.chart-card-title-wrap`, o aplicando la regla directamente si ya es identificable) para que el wrap ocurra de forma predecible en vez de depender del ancho intrínseco del texto del título.

Alternativas descartadas (por ahora, ver Non-Goals): truncar el título con `text-overflow: ellipsis`, o forzar `flex-direction: column` con una media query específica. El usuario pidió explícitamente probar primero con wrap por ser el cambio más simple; si en la práctica no alcanza, es una iteración incremental futura.

### 3. `system-badge` condicional

En `StationPanel.tsx`:
```tsx
{loading ? (
  <Skeleton width="140px" height="34px" radius={999} />
) : badge ? (
  <span className="system-badge">{badge}</span>
) : null}
```
`.station-meta` es `display: grid; justify-items: end; gap: 10px` — al no renderizar el badge, `lastUpdated` ocupa la fila restante sin dejar un gap fantasma (el `gap` de CSS grid no genera espacio para filas/elementos que no existen).

No se toca cómo se calcula `badge` en `App.tsx` (sigue siendo `""` en error) — el fix es puramente de renderizado condicional en `StationPanel`.

## Risks / Trade-offs

- **[Riesgo] El wrap del encabezado puede verse "saltado"** en anchos justo en el borde de romperse → Mitigación: aceptado como resultado esperado de un fix basado en wrap continuo (sin breakpoints discretos); es preferible a que el contenido se corte o desborde.
- **[Riesgo] Cambio de comportamiento visual en "Gráficas" durante error** (ahora se ve el header del gráfico en vez de solo el `InlineError` suelto) → Mitigación: documentado explícitamente como mejora de consistencia con el Dashboard, no un efecto secundario no deseado.

## Migration Plan

Cambio de solo frontend, sin migraciones de datos ni cambios de API. Se implementa y se verifica visualmente con `pnpm dev` (forzando error simulado, ej. deteniendo el backend o mockeando un rechazo en el fetch, y probando anchos de ventana intermedios para el wrap).
