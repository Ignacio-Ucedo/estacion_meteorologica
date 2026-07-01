## 1. Error de gráficos unificado en ChartCard

- [x] 1.1 En `frontend/src/components/ChartCard.tsx`, importar `InlineError` y reemplazar `<div className="chart-state-overlay chart-state-error">Sin conexión al servidor</div>` por `<InlineError message="No se pudieron cargar las gráficas de la estación." />` (sin `onRetry`).
- [x] 1.2 En `frontend/src/components/Graficaspanel.tsx`, eliminar el `if (error) return <article>...<InlineError/></article>` de `MetricChart` y pasar `error={error}` a `<ChartCard>` en lugar de `error={null}`.
  Commit sugerido: `fix(frontend): unificar mensaje de error de gráficos en ChartCard con InlineError`
- [x] 1.3 Verificar visualmente (deteniendo el backend o mockeando un error de fetch) que tanto "Gráficas" como el gráfico inline del Dashboard muestran el mismo `InlineError`, y que el encabezado del gráfico (título + período) sigue visible en ambos casos durante el error. **Requiere verificación manual en navegador.**

## 2. Responsive del encabezado de ChartCard

- [x] 2.1 En `frontend/src/styles.css`, agregar `flex-wrap: wrap;` a `.chart-card-head`.
- [x] 2.2 Envolver o identificar el bloque de título/subtítulo (hijo izquierdo de `.chart-card-head` en `ChartCard.tsx`) con una clase (p. ej. `chart-card-title-wrap`) y agregarle `min-width: 0` en `styles.css`, para que el wrap se dispare de forma predecible en vez de depender del ancho intrínseco del texto.
  Commit sugerido: `fix(frontend): permitir que los botones de período envuelvan en ChartCard`
- [x] 2.3 Verificar visualmente en "Gráficas" (achicando la ventana o el zoom alrededor de 1200-1400px) y en el Dashboard (mobile angosto, <400px) que los botones de período bajan de línea sin desbordar ni solaparse con el título. **Requiere verificación manual en navegador.**

## 3. System badge condicional en StationPanel

- [x] 3.1 En `frontend/src/components/StationPanel.tsx`, cambiar el render del badge para que, cuando no esté cargando y `badge` sea un string vacío, no se renderice ningún `<span className="system-badge">` (ni placeholder ni espacio reservado).
  Commit sugerido: `fix(frontend): no renderizar system-badge vacío en StationPanel`
- [x] 3.2 Verificar visualmente (forzando un error de carga de estación, ej. deteniendo el backend) que el badge no aparece y que `.station-meta` no deja un hueco en blanco donde estaba. **Requiere verificación manual en navegador.**

## 4. Verificación final

- [x] 4.1 Correr `pnpm build` y confirmar que no hay errores de TypeScript.
- [x] 4.2 Confirmar que el estado "sin datos" (`isEmpty`) de `ChartCard` y el estado de error de `StationLogPanel`/`StationManagementPanel`/`StationSwitcherModal` (ya usan `InlineError` desde el cambio `frontend-error-ux`) no se vieron afectados por estos fixes.
