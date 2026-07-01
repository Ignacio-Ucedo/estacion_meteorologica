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

Cada sección del dashboard SHALL usar un mensaje específico orientado al usuario final al instanciar `InlineError`, sin mencionar códigos HTTP ni URLs. El error de carga de gráficos SHALL manejarse dentro de `ChartCard` (no en cada panel consumidor por separado), de forma que el mismo mensaje se muestre de forma consistente sin importar desde qué sección se use.

#### Scenario: Error en panel de gestión de estaciones

- **WHEN** `StationManagementPanel` no puede cargar la lista de estaciones
- **THEN** `InlineError` muestra "No se pudo cargar la lista de estaciones."

#### Scenario: Error en panel de gráficas

- **WHEN** `ChartCard` recibe un error de carga de datos (`loading` false, `error` truthy) desde `GraficasPanel`
- **THEN** `ChartCard` renderiza `InlineError` con el mensaje "No se pudieron cargar las gráficas de la estación." dentro de `chart-card-body`, manteniendo visible el encabezado del gráfico (título y selector de período)

#### Scenario: Error en el gráfico del Dashboard principal

- **WHEN** `ChartCard` recibe un error de carga de datos desde `SelectedMetricChart` (gráfico inline debajo de las metric cards)
- **THEN** `ChartCard` renderiza el mismo `InlineError` con el mensaje "No se pudieron cargar las gráficas de la estación." — idéntico al de la pestaña "Gráficas" — en lugar de un texto de error genérico

#### Scenario: Error en dashboard principal (estación no disponible)

- **WHEN** el Dashboard no puede obtener los datos de la estación seleccionada (error distinto de 404)
- **THEN** `InlineError` muestra "No se pudieron cargar los datos de la estación."
