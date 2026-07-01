## Purpose

Especificación del componente reutilizable `InlineError` para mostrar estados de error dentro de secciones del dashboard, con mensajes contextuales orientados al usuario final.

## Requirements

### Requirement: Componente InlineError para errores de sección

El sistema SHALL proveer un componente reutilizable `InlineError` que muestre un estado de error dentro de una sección del dashboard. El componente SHALL aceptar `message: string` (mensaje contextual para el usuario) y `onRetry?: () => void` (callback opcional de reintento). El componente SHALL mostrar un icono de alerta, el mensaje provisto, y un botón "Reintentar" si `onRetry` está definido. El componente NO SHALL mostrar códigos HTTP, stack traces ni texto técnico. El componente SHALL ser visualmente distinto del estado vacío (`div.log-empty`).

#### Scenario: Error con opción de reintento

- **WHEN** un panel recibe un error de API y pasa `message` y `onRetry` a `InlineError`
- **THEN** el componente muestra el icono de alerta, el mensaje contextual y un botón "Reintentar" clicable que invoca `onRetry`

#### Scenario: Error sin opción de reintento

- **WHEN** un panel recibe un error y pasa solo `message` a `InlineError` sin `onRetry`
- **THEN** el componente muestra el icono de alerta y el mensaje, sin botón de reintento

#### Scenario: InlineError reemplaza div.log-empty en contexto de error

- **WHEN** un panel (`StationManagementPanel`, `GraficasPanel`) detecta `error !== null` en el resultado del hook de datos
- **THEN** renderiza `<InlineError>` en lugar de `<div className="log-empty">`, y `div.log-empty` queda reservado exclusivamente para el estado vacío (lista sin datos)

### Requirement: Mensajes de error contextuales por sección

Cada sección del dashboard SHALL usar un mensaje específico orientado al usuario final al instanciar `InlineError`, sin mencionar códigos HTTP ni URLs.

#### Scenario: Error en panel de gestión de estaciones

- **WHEN** `StationManagementPanel` no puede cargar la lista de estaciones
- **THEN** `InlineError` muestra "No se pudo cargar la lista de estaciones."

#### Scenario: Error en panel de gráficas

- **WHEN** `GraficasPanel` no puede cargar los datos de un gráfico
- **THEN** `InlineError` muestra "No se pudieron cargar las gráficas de la estación."

#### Scenario: Error en dashboard principal (estación no disponible)

- **WHEN** el Dashboard no puede obtener los datos de la estación seleccionada (error distinto de 404)
- **THEN** `InlineError` muestra "No se pudieron cargar los datos de la estación."
