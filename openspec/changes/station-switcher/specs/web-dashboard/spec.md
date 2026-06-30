## MODIFIED Requirements

### Requirement: Panel de estación con datos reales

El StationPanel y las MetricCards del dashboard principal SHALL mostrar datos provenientes de `GET /api/stations/{id}` donde `id` es la estación actualmente seleccionada por el usuario (no una constante hardcodeada). El StationPanel SHALL ser clickeable y SHALL abrir el modal de selección de estación al hacer click.

#### Scenario: Lectura actual disponible

- **WHEN** el dashboard se carga y la API retorna una lectura actual para la estación seleccionada
- **THEN** las MetricCards muestran los valores reales con 1 decimal de precisión

#### Scenario: Sin lectura actual disponible

- **WHEN** la API retorna `current: null` (estación sin lecturas)
- **THEN** las MetricCards muestran "—" o "Sin datos" en lugar de un número

#### Scenario: Click en StationPanel abre modal de selección

- **WHEN** el usuario hace click sobre el StationPanel
- **THEN** el modal de selección de estación se abre

### Requirement: Visualización de datos históricos

La sección de Gráficas SHALL obtener y renderizar las series históricas (temperatura, humedad, velocidad de viento, precipitación) de la estación actualmente seleccionada. El componente SHALL recibir `stationId` como prop en lugar de importar la constante `STATION_ID`.

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
- **THEN** cada gráfico muestra un mensaje de error de conectividad en lugar de datos vacíos o errores de consola

### Requirement: Log de historial con datos paginados reales

El StationLogPanel SHALL consumir `GET /api/stations/{id}/readings?page=N&search=X` en lugar de generar lecturas aleatorias. La tabla SHALL actualizarse automáticamente cada 30 segundos. El botón "Pausar" SHALL detener el polling automático. El StationLogPanel SHALL ser independiente de la estación activa seleccionada en el dashboard y SHALL continuar usando su propio ID de estación configurado.

#### Scenario: Carga inicial del historial

- **WHEN** el StationLogPanel se monta
- **THEN** realiza `GET /api/stations/alpha/readings?page=1` y muestra los 7 registros más recientes

#### Scenario: Paginación de historial

- **WHEN** el usuario navega a la página N
- **THEN** la tabla realiza `GET /api/stations/alpha/readings?page=N` y muestra la página correspondiente

#### Scenario: Búsqueda en historial

- **WHEN** el usuario introduce un texto en el campo de búsqueda y confirma
- **THEN** la tabla realiza `GET /api/stations/alpha/readings?page=1&search=<texto>` y muestra los resultados filtrados

#### Scenario: Auto-refresh del historial

- **WHEN** han transcurrido 30 segundos desde la última carga
- **THEN** la tabla realiza automáticamente `GET /api/stations/alpha/readings?page=1` para mostrar nuevas lecturas
