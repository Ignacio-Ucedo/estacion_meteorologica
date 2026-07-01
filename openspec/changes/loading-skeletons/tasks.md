## 1. Componente Skeleton compartido (frontend)

- [x] 1.1 Crear `frontend/src/components/Skeleton.tsx` con el componente `Skeleton` (`width`, `height`, `radius` opcionales, `aria-hidden="true"`), según `design.md`.
  Commit sugerido: `feat(frontend): agregar componente Skeleton reutilizable`
- [x] 1.2 Agregar a `frontend/src/styles.css` la clase `.skeleton` (color de fondo sólido, `border-radius` por defecto) y `@keyframes skeleton-pulse` animando `opacity`.
- [x] 1.3 Agregar `.skeleton { animation: none; }` al bloque `@media (prefers-reduced-motion: reduce)` ya existente en `frontend/src/styles.css`.
  Commit sugerido: `feat(frontend): animar Skeleton con pulso y respetar prefers-reduced-motion`

## 2. StationPanel (header de estación)

- [x] 2.1 Agregar prop `loading?: boolean` a `StationPanelProps` en `frontend/src/components/StationPanel.tsx`; cuando sea `true`, renderizar `<Skeleton>` en lugar del contenido de `badge` y `lastUpdated`.
- [x] 2.2 En `frontend/src/App.tsx`, quitar el literal `"Cargando…"` de `stationPanelProps.badge`/`lastUpdated` y pasar `loading` directamente a `<StationPanel>`.
  Commit sugerido: `feat(frontend): mostrar skeleton en StationPanel mientras carga la estación`

## 3. MetricCard

- [x] 3.1 Agregar prop `loading?: boolean` a `MetricCardProps` en `frontend/src/components/MetricCard.tsx`; cuando sea `true`, renderizar `<Skeleton>` para `label`, `value` y `detail` en vez del contenido/`"—"`.
- [x] 3.2 En `frontend/src/App.tsx`, pasar el `loading` de `useStation` a cada `<MetricCard>` del grid de métricas.
  Commit sugerido: `feat(frontend): agregar estado de carga a MetricCard con skeleton`

## 4. ChartCard (siluetas por tipo de gráfico)

- [x] 4.1 En `frontend/src/components/ChartCard.tsx`, reemplazar el `div.chart-state-overlay` de texto ("Cargando datos…") por una rama que renderiza según `kind`: barras fantasma (`kind === "bar"`) o curva SVG fantasma (`kind === "line" | "area"`), ambas con la clase `.skeleton` para la animación de pulso.
- [x] 4.2 Implementar las barras fantasma como una fila de `<Skeleton>` verticales con alturas fijas variadas (ver lista de ejemplo en `design.md`).
- [x] 4.3 Implementar la curva fantasma como un `<svg>` con `viewBox` y `preserveAspectRatio="none"`, con un único `<path>` de coordenadas fijas y clase `.skeleton` aplicada al `path` (`fill`/`stroke` según corresponda).
  Commit sugerido: `feat(frontend): mostrar silueta de gráfico fantasma en ChartCard mientras carga`
- [x] 4.4 Verificar visualmente que `GraficasPanel` (4 `ChartCard`, incluyendo el de precipitación con `kind="bar"`) y `SelectedMetricChart` muestran la silueta correcta según cada `kind`. **Requiere verificación manual en navegador.**

## 5. Listas paginadas (StationLogPanel, StationManagementPanel, StationSwitcherModal)

- [x] 5.1 En `frontend/src/components/Stationlogpanel.tsx`, reemplazar `<div className="log-empty">Cargando…</div>` por 5 filas de `<Skeleton>` con la forma de una fila de la tabla de lecturas.
- [x] 5.2 En `frontend/src/components/StationManagmentPanel.tsx`, reemplazar `<div className="log-empty">Cargando estaciones…</div>` por 5 filas de `<Skeleton>` con la forma de una fila de la lista de estaciones.
- [x] 5.3 En `frontend/src/components/StationSwitcherModal.tsx`, reemplazar `<div className="modal-empty">Cargando…</div>` por 5 filas de `<Skeleton>` con la forma de un ítem de la lista del modal.
  Commit sugerido: `feat(frontend): mostrar filas fantasma skeleton en listas paginadas durante la carga`

## 6. Verificación

- [x] 6.1 Probar manualmente en navegador (`pnpm dev`) cada superficie: dashboard al cargar la estación, cada `MetricCard`, los 4 `ChartCard` en "Gráficas" y el gráfico inline seleccionado, "Historial", "Gestión de estaciones" y el modal de cambio de estación — confirmar que el skeleton aparece de inmediato y desaparece al llegar los datos, sin parpadeo de texto "Cargando…" residual. **Requiere verificación manual del usuario, no hay acceso a navegador en este entorno.**
- [x] 6.2 Con las DevTools del navegador, emular `prefers-reduced-motion: reduce` y confirmar que todos los `Skeleton` quedan estáticos (sin pulso). **Requiere verificación manual del usuario.**
- [x] 6.3 Confirmar que el estado "sin datos" (listas vacías tras cargar) y el estado de error (`InlineError`) siguen intactos y no fueron reemplazados por skeleton en ningún lugar.
