## ADDED Requirements

### Requirement: Sistema de toasts para errores de background

El sistema SHALL proveer infraestructura de toasts compuesta por `ToastProvider` (contexto React + renderizador), y el hook `useToast()` que expone `addToast(message: string)`. Los toasts SHALL aparecer en la esquina inferior derecha de la pantalla, superpuestos al contenido sin desplazarlo. Cada toast SHALL desaparecer automáticamente después de 5 segundos. Múltiples toasts SHALL apilarse verticalmente. Los toasts NO SHALL bloquear interacciones con el resto de la UI. Los toasts SHALL ser exclusivamente para notificaciones de errores en operaciones de background (no iniciadas directamente por el usuario).

#### Scenario: Toast aparece por error de background

- **WHEN** una operación de background (ej. auto-refresh de 30 s) falla
- **THEN** aparece un toast en la esquina inferior derecha con el mensaje de error

#### Scenario: Auto-dismiss del toast

- **WHEN** un toast fue mostrado
- **THEN** desaparece automáticamente después de 5 segundos sin interacción del usuario

#### Scenario: Múltiples toasts apilados

- **WHEN** dos operaciones de background fallan en momentos cercanos
- **THEN** ambos toasts son visibles simultáneamente, apilados verticalmente, cada uno con su propio temporizador de 5 s

#### Scenario: Toast no bloquea la UI

- **WHEN** un toast está visible
- **THEN** el usuario puede continuar navegando e interactuando con el dashboard sin restricciones

### Requirement: Toast en auto-refresh fallido del historial

El `StationLogPanel` SHALL mostrar un toast cuando el auto-refresh de 30 s falla, en lugar de fallar silenciosamente. El toast SHALL mostrarse únicamente si el error ocurre en un ciclo de auto-refresh (no en la carga inicial manual). Si el error persiste en ciclos sucesivos, SHALL mostrarse un nuevo toast por cada ciclo fallido excepto si el error anterior aún está visible (para evitar acumulación excesiva).

#### Scenario: Auto-refresh del historial falla

- **WHEN** el auto-refresh del `StationLogPanel` intenta obtener nuevas lecturas y la petición falla
- **THEN** se muestra un toast con el mensaje "No se pudo actualizar el historial de lecturas."

#### Scenario: Carga inicial del historial falla — sin toast

- **WHEN** el `StationLogPanel` se monta y la carga inicial falla
- **THEN** la sección muestra `InlineError` (no un toast), dado que fue el usuario quien navegó a esa sección
