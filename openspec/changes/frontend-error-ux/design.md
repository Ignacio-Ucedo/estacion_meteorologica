## Context

El frontend actual mezcla el estado de error con el estado vacío usando `div.log-empty` en todos los paneles (`StationManagementPanel`, `GraficasPanel`, `StationLogPanel`). El Dashboard tiene un `api-error-banner` separado que muestra texto técnico. El auto-refresh del `StationLogPanel` falla silenciosamente: si la petición periódica de 30 s falla, el usuario no recibe ninguna señal. Los mensajes actuales incluyen fragmentos como "Error al conectar con el servidor" sin contexto sobre qué parte falló.

El dashboard está orientado a usuarios finales no técnicos (operadores de campo, personal administrativo) — no deben ver "HTTP 500" ni "fetch failed".

## Goals / Non-Goals

**Goals:**
- Componente `InlineError` reutilizable: icono + mensaje contextual + retry opcional. Visualmente distinto del estado vacío.
- Sistema de toasts: contexto React + provider + hook `useToast`. Notificaciones de esquina, no bloqueantes, auto-dismiss 5 s.
- Reemplazar todos los usos de `div.log-empty` en contexto de error por `InlineError`.
- Reemplazar `api-error-banner` por `InlineError` con mensaje contextual sobre la estación.
- Agregar toast al auto-refresh fallido del `StationLogPanel`.
- Mensajes amigables sin códigos HTTP, específicos por sección.

**Non-Goals:**
- Retry automático (sin intervención del usuario).
- Persistencia de errores entre sesiones.
- Reportes o logging de errores al servidor.
- Cambios en la capa de fetching (`useFetch`, `apiFetch`).

## Decisions

### InlineError: componente simple, sin contexto global

`InlineError` es un componente de presentación puro con props `message: string` y `onRetry?: () => void`. No requiere contexto ni estado global. Cada sitio de uso pasa su propio mensaje contextual.

Alternativa descartada: un contexto global de errores inline. Innecesario — los errores inline son locales a cada sección y ya tienen estado local (`error` string del hook `useFetch`).

### Toast: contexto React + array de toasts en estado

Un `ToastContext` con `addToast(message)` almacena un array de toasts con `{ id, message, expiresAt }`. El `ToastProvider` renderiza el contenedor de toasts. El hook `useToast()` expone `addToast`. Los toasts se eliminan al expirar (5 s) vía `useEffect` con `setTimeout`.

Alternativa descartada: librería externa (react-hot-toast, sonner). El requisito es un solo tipo de toast de error simple; una dependencia externa agrega overhead injustificado.

### Mensajes de error: definidos en el sitio de uso, no en InlineError

`InlineError` recibe el `message` como prop — no tiene lógica de mapeo de errores HTTP a mensajes. Cada panel decide su propio mensaje contextual. Esto mantiene el componente desacoplado y permite mensajes precisos ("No se pudo cargar el historial de lecturas" vs "No se pudieron cargar las gráficas").

### div.log-empty se mantiene para estado vacío

El CSS class `log-empty` se preserva para el caso "sin datos / lista vacía". `InlineError` usa su propia clase (`inline-error`) con estilos distintos (fondo levemente diferente, icono de alerta). Esto hace inequívoca la diferencia entre "no hay datos" y "algo falló".

### Estructura de archivos

```
src/
  components/
    InlineError.tsx          — componente de presentación
    ToastProvider.tsx        — contexto + provider + renderizador de toasts
  hooks/
    useToast.ts              — hook consumidor del contexto
```

`ToastProvider` envuelve `<main className="app-shell">` en `App.tsx`.

## Risks / Trade-offs

- [Risk] El auto-refresh del `StationLogPanel` puede generar un toast por cada ciclo de 30 s si el backend permanece caído → Mitigation: el toast solo se muestra si la carga era silenciosa (auto-refresh) y el estado de error cambia de `null` a `string`; si ya había error en el ciclo anterior, no se agrega otro toast.
- [Risk] Los mensajes hardcodeados en los sitios de uso pueden quedar desactualizados si cambian los endpoints → Mitigation: los mensajes son deliberadamente genéricos sobre la sección, no sobre la URL específica.
- [Trade-off] Sin contexto global de errores inline, no hay un panel de "historial de errores" — aceptado, el requisito es visibilidad mínima no viralidad de errores.
