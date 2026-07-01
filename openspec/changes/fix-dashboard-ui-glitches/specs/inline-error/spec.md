## MODIFIED Requirements

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
