## 1. Componente InlineError

- [x] 1.1 Crear `frontend/src/components/InlineError.tsx` con props `message: string` y `onRetry?: () => void` — muestra icono de alerta, mensaje y botón "Reintentar" condicional
- [x] 1.2 Agregar estilos `.inline-error` a `frontend/src/styles.css` — visualmente distinto de `.log-empty` (fondo, icono, color de texto)

Commit sugerido: `feat(frontend): agregar componente InlineError para errores de sección`

## 2. Sistema de Toasts

- [x] 2.1 Crear `frontend/src/components/ToastProvider.tsx` — `ToastContext`, `ToastProvider` (array de toasts en estado, auto-dismiss con `setTimeout` de 5 s, renderiza contenedor de toasts en esquina inferior derecha)
- [x] 2.2 Crear `frontend/src/hooks/useToast.ts` — hook que consume `ToastContext` y expone `addToast(message: string)`
- [x] 2.3 Envolver `<main className="app-shell">` con `<ToastProvider>` en `frontend/src/App.tsx`
- [x] 2.4 Agregar estilos `.toast-container` y `.toast-item` a `frontend/src/styles.css` — esquina inferior derecha, z-index alto, animación de entrada/salida

Commit sugerido: `feat(frontend): agregar sistema de toasts para errores de background`

## 3. Integración en StationManagementPanel

- [x] 3.1 Importar `InlineError` en `frontend/src/components/StationManagmentPanel.tsx`
- [x] 3.2 Reemplazar `<div className="log-empty">Error al conectar con el servidor.</div>` por `<InlineError message="No se pudo cargar la lista de estaciones." onRetry={...} />` — `onRetry` vuelve a llamar al fetch (reset de página a 1)

Commit sugerido: `fix(frontend): reemplazar log-empty de error en StationManagementPanel por InlineError`

## 4. Integración en GraficasPanel

- [x] 4.1 Importar `InlineError` en `frontend/src/components/Graficaspanel.tsx`
- [x] 4.2 Reemplazar el manejo de error en `MetricChart` (actualmente renderiza el mismo placeholder de "Sin datos") por `<InlineError message="No se pudieron cargar las gráficas de la estación." />` cuando `error !== null`

Commit sugerido: `fix(frontend): reemplazar error silencioso en GraficasPanel por InlineError`

## 5. Integración en Dashboard (App.tsx)

- [x] 5.1 Importar `InlineError` en `frontend/src/App.tsx`
- [x] 5.2 Reemplazar el bloque `{error && !error.includes("404") && <div className="api-error-banner">...</div>}` por `<InlineError message="No se pudieron cargar los datos de la estación." />` dentro del case `"dashboard"` de `renderPanel`

Commit sugerido: `fix(frontend): reemplazar api-error-banner por InlineError en el dashboard`

## 6. Toast en auto-refresh de StationLogPanel

- [x] 6.1 Importar y usar `useToast` en `frontend/src/components/Stationlogpanel.tsx`
- [x] 6.2 Detectar error en ciclos de auto-refresh (distinguir del error de carga inicial): cuando el timer de 30 s dispara un fetch y retorna error, invocar `addToast("No se pudo actualizar el historial de lecturas.")` en lugar de actualizar el estado `error` de la sección
- [x] 6.3 Verificar que la carga inicial fallida siga mostrando `InlineError` dentro del panel (no toast)

Commit sugerido: `fix(frontend): mostrar toast en auto-refresh fallido del StationLogPanel`
