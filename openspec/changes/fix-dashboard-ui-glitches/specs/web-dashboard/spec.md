## MODIFIED Requirements

### Requirement: Visualización de datos históricos
La aplicación SHALL obtener los datos históricos desde la API REST del backend FastAPI en lugar de generarlos en el cliente. Los gráficos de temperatura (°C, rango -15 a 45), humedad (%, 0–100), velocidad del viento (km/h, 0–120) y precipitación (mm, 0–60) SHALL renderizarse con datos reales de PostgreSQL. El componente SHALL recibir `stationId` como prop en lugar de importar la constante `STATION_ID`. El encabezado de cada gráfico (título y selector de período) SHALL permanecer legible y sin desbordarse en cualquier ancho de pantalla.

#### Scenario: Carga de gráficos con datos disponibles
- **WHEN** el componente de gráficos se carga y el backend tiene lecturas en la base de datos para la estación seleccionada
- **THEN** la aplicación realiza peticiones a los endpoints de métricas hourly/daily con el `stationId` activo, y renderiza los gráficos

#### Scenario: Cambio de estación actualiza los gráficos

- **WHEN** el usuario selecciona una estación diferente desde el modal
- **THEN** la sección de Gráficas cancela los fetches anteriores y realiza nuevas peticiones con el nuevo `stationId`

#### Scenario: Carga de gráficos sin datos en la base
- **WHEN** el componente de gráficos se carga y el backend no tiene lecturas para la estación seleccionada
- **THEN** los gráficos muestran un estado "sin datos" con mensaje descriptivo, sin crashear

#### Scenario: Backend no disponible al cargar gráficos
- **WHEN** el frontend intenta cargar datos de métricas y el backend no responde
- **THEN** cada gráfico (tanto en la pestaña "Gráficas" como en el gráfico inline del Dashboard principal) muestra `InlineError` con el mensaje "No se pudieron cargar las gráficas de la estación.", en lugar de un texto de error genérico o hardcodeado

#### Scenario: Encabezado del gráfico se adapta a anchos angostos
- **GIVEN** un `ChartCard` cuyo ancho disponible no alcanza para mostrar el título y los 4 botones de período (1D/7D/30D/1Y) en una sola fila
- **WHEN** el gráfico se renderiza en ese ancho
- **THEN** los botones de período bajan a una segunda línea debajo del título, sin desbordar el contenedor ni solaparse con el texto

### Requirement: Panel de estación con datos reales
El StationPanel y las MetricCards del dashboard principal SHALL mostrar datos provenientes de `GET /api/stations/{id}` donde `id` es la estación actualmente seleccionada por el usuario (no una constante hardcodeada). El StationPanel SHALL ser clickeable y SHALL abrir el modal de selección de estación al hacer click. El badge de estado del sistema (`system-badge`) SHALL no renderizarse cuando no tiene contenido, en lugar de mostrarse vacío.

#### Scenario: Lectura actual disponible
- **WHEN** el dashboard se carga y la API retorna una lectura actual para la estación seleccionada
- **THEN** las MetricCards muestran los valores reales con 1 decimal de precisión

#### Scenario: Sin lectura actual disponible
- **WHEN** la API retorna `current: null` (estación sin lecturas)
- **THEN** las MetricCards muestran "—" o "Sin datos" en lugar de un número

#### Scenario: Click en StationPanel abre modal de selección

- **WHEN** el usuario hace click sobre el StationPanel
- **THEN** el modal de selección de estación se abre

#### Scenario: Badge de estado no se muestra cuando no hay contenido
- **GIVEN** el dashboard tiene un error de carga de la estación (no está cargando y no hay estación disponible)
- **WHEN** se renderiza el `StationPanel`
- **THEN** el `system-badge` no se renderiza (sin `<span>` vacío ni espacio en blanco reservado), y el resto del panel (`lastUpdated`, etc.) se muestra normalmente
