## Context

El dashboard (`frontend/`) usa hooks propios sobre `fetch` (`frontend/src/api/hooks.ts`, `useFetch`) que exponen `{ data, loading, error }`. Ese `loading` booleano ya llega a casi todos los componentes de superficie, pero hoy solo se usa para mostrar texto estático ("Cargando…", "Cargando datos…", "Cargando estaciones…") sin ninguna animación, y en un caso (`MetricCard`) ni siquiera se usa: el componente no recibe `loading` y muestra "—" tanto si está cargando como si no hay dato.

El cambio hermano `add-inline-error` (archivado como `2026-06-30-frontend-error-ux`) ya resolvió el mismo problema para el estado de error, introduciendo un componente compartido (`InlineError`) con su propio spec (`openspec/specs/inline-error/`) e instanciándolo de forma consistente en varios paneles. Este cambio sigue el mismo molde para el estado de carga.

Superficies afectadas y su prop `loading` actual:
- `StationPanel` (`frontend/src/components/StationPanel.tsx`): NO recibe `loading` hoy; `App.tsx` le pasa `badge`/`lastUpdated` ya formateados como string, incluyendo el literal `"Cargando…"`.
- `MetricCard` (`frontend/src/components/MetricCard.tsx`): NO recibe `loading` hoy.
- `ChartCard` (`frontend/src/components/ChartCard.tsx`): ya recibe `loading?: boolean` y lo usa para un `div.chart-state-overlay` de texto plano.
- `StationLogPanel`, `StationManagmentPanel`, `StationSwitcherModal`: ya reciben `loading` del hook correspondiente (`useReadings`/`useStations`) y lo usan para `div.log-empty`/`div.modal-empty` de texto plano.

## Goals / Non-Goals

**Goals:**
- Reemplazar el texto estático "Cargando…" por un componente `Skeleton` animado en las 6 superficies listadas arriba.
- Agregar el prop `loading` donde falta (`StationPanel`, `MetricCard`) para que puedan mostrar el skeleton.
- Que el skeleton de `ChartCard` insinúe la forma del gráfico real (barras o curva) según el prop `kind` existente.
- Respetar `prefers-reduced-motion: reduce`, siguiendo la convención ya usada para `.log-live-dot`/`.log-row-enter`.
- Mantener el estado de carga visualmente distinto del estado vacío y del estado de error (`InlineError`), igual que hoy `InlineError` está separado de `div.log-empty`.

**Non-Goals:**
- No se rediseña la lógica de fetching ni los hooks de `api/hooks.ts` — este cambio es puramente de presentación sobre el `loading` que ya existe.
- Las siluetas de gráfico (barras/curva) son decorativas y estáticas; no representan datos reales ni se calculan a partir de la respuesta previa.
- No se introduce un umbral mínimo de tiempo antes de mostrar el skeleton (sin debounce/delay).
- No se toca el estado de error (`InlineError` sigue intacto) ni el estado vacío (`div.log-empty`/`div.modal-empty` sin resultados).

## Decisions

### 1. Componente primitivo `Skeleton` compartido

Un componente simple en `frontend/src/components/Skeleton.tsx`:

```tsx
type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
};

export function Skeleton({ width = "100%", height = "1em", radius = 4, className }: SkeletonProps) {
  return (
    <span
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
```

Cada superficie compone `<Skeleton>` (una o varias instancias) para armar la forma que necesita (líneas de texto, filas de tabla, bloques de card). Alternativa descartada: un componente distinto por superficie (`MetricCardSkeleton`, `RowSkeleton`, etc.) sin primitivo común — se descarta porque duplicaría la regla de animación/CSS en 6 lugares en vez de una sola clase `.skeleton`.

### 2. Animación: pulse vía CSS, no shimmer

`@keyframes skeleton-pulse` anima `opacity` entre ~0.5 y 1 en loop, aplicado a `.skeleton` vía `background-color` sólido (sin gradiente). Se prefiere sobre shimmer (gradiente en movimiento) porque el usuario lo pidió explícitamente y porque es una sola propiedad animada (más barato de mantener y de desactivar bajo `prefers-reduced-motion`). Sigue el patrón existente:

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
```

### 3. Silueta de gráfico dependiente de `kind`

`ChartCard` ya recibe `kind: "line" | "area" | "bar"`. El overlay de carga (`div.chart-state-overlay` cuando `loading`) se reemplaza por:
- `kind === "bar"`: una fila de `<Skeleton>` verticales con alturas fijas variadas (ej. `["40%","65%","30%","80%","50%","70%","35%"]`), simulando barras.
- `kind === "line" | "area"`: un `<svg>` con un único `<path>` de curva ondulada fija (coordenadas hardcodeadas, no calculadas de `data`), con `stroke`/`fill` en el color gris de skeleton y la misma animación de pulso aplicada vía `className="skeleton"` sobre el `path`.

Alternativa descartada: un solo bloque rectangular `Skeleton` para todos los `kind`. Se descarta porque el usuario pidió explícitamente que la silueta sea específica por tipo de gráfico.

### 4. Filas fantasma fijas en listas

`StationLogPanel`, `StationManagmentPanel` y `StationSwitcherModal` renderizan 5 filas de `Skeleton` (número fijo, no dependiente de una respuesta previa) cuando `loading === true`, reemplazando `div.log-empty`/`div.modal-empty` con el texto "Cargando…".

### 5. `MetricCard` y `StationPanel` ganan prop `loading`

- `MetricCard`: nuevo prop `loading?: boolean`. Cuando es `true`, `label`/`value`/`detail` se reemplazan por `Skeleton` de ancho fijo aproximado a cada campo; `App.tsx` pasa `loading` (ya disponible desde `useStation`) a cada `MetricCard`.
- `StationPanel`: nuevo prop `loading?: boolean`. Cuando es `true`, `badge` y `lastUpdated` se reemplazan por `Skeleton` en vez del string recibido; `App.tsx` deja de construir el literal `"Cargando…"` en `stationPanelProps.badge`/`lastUpdated` y en su lugar pasa `loading` directamente.

### 6. Sin delay artificial

El skeleton se muestra en cuanto `loading === true`, sin `setTimeout`/debounce. El usuario indicó explícitamente que no quiere ese costo adicional; se acepta el trade-off de un posible parpadeo breve en fetches muy rápidos.

## Risks / Trade-offs

- **[Riesgo] Parpadeo visual en fetches muy rápidos** (sin delay mínimo) → Mitigación: aceptado explícitamente por decisión de producto; si se vuelve molesto en la práctica, es un cambio incremental futuro (agregar un umbral mínimo), no bloquea este cambio.
- **[Riesgo] Curva SVG hardcodeada no escala perfectamente a todos los anchos de contenedor** → Mitigación: usar `viewBox` + `preserveAspectRatio="none"` para que el `path` se estire al contenedor como ya hace Recharts con `ResponsiveContainer`.
- **[Riesgo] Divergencia visual entre el skeleton de `ChartCard` y el gráfico real una vez cargado** (la curva fantasma no tiene relación con los datos reales) → Mitigación: aceptado como decorativo por diseño; el objetivo es comunicar "esto va a ser un gráfico", no previsualizar datos.

## Migration Plan

Cambio de solo frontend, sin datos persistentes ni migraciones de esquema. Se implementa y verifica visualmente en `pnpm dev`; no requiere pasos de rollback más allá de revertir el commit (no hay estado en servidor ni cambios de API).
