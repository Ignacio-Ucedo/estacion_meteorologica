## Why

Testing manual del dashboard (durante la verificación del cambio `loading-skeletons`) reveló tres defectos de UI puntuales, ya diagnosticados y con solución acordada:

1. El gráfico del Dashboard (`SelectedMetricChart`) muestra un mensaje de error hardcodeado y genérico ("Sin conexión al servidor") en vez del `InlineError` contextual que ya usa el resto de la app, incluida la pestaña "Gráficas" para el mismo tipo de error.
2. La fila de encabezado de `ChartCard` (título + botones de período 1D/7D/30D/1Y) no tiene ningún tratamiento responsive: en anchos intermedios (tablet en "Gráficas", mobile angosto en el Dashboard) el título y los botones no entran en una fila y el layout se rompe.
3. El `system-badge` del `StationPanel` queda como una píldora vacía (sin texto) cuando hay un error de carga de la estación, dejando un elemento visualmente roto en vez de simplemente no mostrarse.

## What Changes

- `ChartCard` pasa a manejar su propio estado de error con `InlineError` (mismo mensaje "No se pudieron cargar las gráficas de la estación." que ya usa "Gráficas"), reemplazando el texto hardcodeado "Sin conexión al servidor".
- `GraficasPanel` deja de interceptar el error manualmente (elimina el `if (error) return <InlineError/>` especial) y le pasa `error` directamente a `ChartCard`, igual que ya hace `SelectedMetricChart`. Efecto secundario positivo: el encabezado del gráfico (título, período) queda visible incluso en estado de error, en vez de ocultarse por completo.
- `.chart-card-head` gana `flex-wrap: wrap` para que los botones de período bajen a una segunda línea cuando no entran junto al título, en cualquier ancho, sin necesidad de una media query nueva.
- `StationPanel` deja de renderizar el `system-badge` cuando no tiene texto (en vez de un `<span>` vacío), evitando el hueco visual sin reservar espacio fantasma.

## Capabilities

### New Capabilities
(ninguna — los tres fixes son ajustes de comportamiento sobre capabilities ya existentes)

### Modified Capabilities
- `web-dashboard`: el escenario de error de carga de gráficos pasa a especificar `InlineError` explícitamente (en vez de un "mensaje de error de conectividad" genérico); se agrega comportamiento responsive del encabezado de `ChartCard`; se agrega comportamiento del `system-badge` cuando no hay contenido.
- `inline-error`: `ChartCard` pasa a ser quien renderiza `InlineError` para errores de gráficos (en lugar de que cada panel lo haga por su cuenta), usado tanto desde `GraficasPanel` como desde `SelectedMetricChart`.

## Impact

- Afecta únicamente `frontend/`. Sin impacto en firmware, gateway, backend, Android ni 3D; no cambia el contrato de la API REST ni el payload LoRa.
- Archivos modificados: `frontend/src/components/ChartCard.tsx`, `frontend/src/components/Graficaspanel.tsx`, `frontend/src/components/StationPanel.tsx`, `frontend/src/styles.css`.
- Sin nuevas dependencias.
- No solapa con cambios activos: `metric-card-chart-detail` está en curso pero no toca estos archivos de la misma forma; `loading-skeletons` ya está completo.
