## Why

Los errores del frontend se muestran de forma inconsistente y poco amigable para el usuario final: algunos usan el mismo `div.log-empty` que el estado vacío (confundiendo "no hay datos" con "algo falló"), el banner `api-error-banner` expone texto técnico con códigos HTTP, y el auto-refresh del `StationLogPanel` falla silenciosamente sin ninguna notificación. El dashboard está orientado a usuarios finales no técnicos, por lo que los mensajes de error deben ser contextuales, amigables y sin jerga de servidor.

## What Changes

- **Nuevo componente `InlineError`**: reemplaza los `div.log-empty` usados para errores y el `api-error-banner` en el Dashboard. Muestra icono + mensaje contextual amigable (sin códigos HTTP) + botón de reintento opcional. El componente `div.log-empty` se mantiene únicamente para el estado "sin datos" (lista vacía).
- **Sistema de toasts**: infraestructura para notificaciones de esquina no bloqueantes. Auto-dismiss en 5 s. Inicialmente usada por el auto-refresh del `StationLogPanel` que hoy falla silenciosamente.
- Los mensajes de error son específicos sobre QUÉ falló (ej. "No se pudieron cargar las lecturas"), sin mencionar códigos HTTP ni detalles de servidor.
- Eliminación del `api-error-banner` del Dashboard para errores 404 (ya manejados por el fallback de estación).

## Capabilities

### New Capabilities

- `inline-error`: Componente reutilizable `InlineError` para errores en secciones cargadas explícitamente por el usuario — icono, mensaje contextual, botón de reintento opcional. Distingue visualmente el estado de error del estado vacío.
- `toast-notifications`: Sistema de toasts (contexto + provider + hook `useToast`) para notificaciones de background — esquina inferior derecha, auto-dismiss 5 s, no bloquea la UI.

### Modified Capabilities

- `web-dashboard`: Cambia cómo se presentan los errores en el Dashboard (reemplaza `api-error-banner` por `InlineError` dentro del `StationPanel` area) y en el `StationLogPanel` (agrega toast en auto-refresh fallido).

## Impact

- **Frontend**: `src/components/InlineError.tsx` (nuevo), `src/components/ToastProvider.tsx` (nuevo), `src/hooks/useToast.ts` (nuevo), `src/App.tsx` (reemplaza banner), `src/components/Stationlogpanel.tsx` (agrega toast en refresh), `src/components/StationManagmentPanel.tsx` (reemplaza `log-empty` de error), `src/components/Graficaspanel.tsx` (reemplaza `log-empty` de error), `src/styles.css` (estilos de InlineError y toast).
- **Sin cambios de API ni de backend**: es un cambio puramente de presentación.
- **Sin breaking changes**.
