## MODIFIED Requirements

### Requirement: Visualización de datos históricos
La aplicación SHALL obtener los datos históricos desde la API REST del backend FastAPI en lugar de generarlos en el cliente. Los gráficos de temperatura (°C, rango -15 a 45), humedad (%, 0–100), velocidad del viento (km/h, 0–120) y precipitación (mm, 0–60) SHALL renderizarse con datos reales de PostgreSQL.

#### Scenario: Carga de gráficos con datos disponibles
- **WHEN** el componente de gráficos se carga y el backend tiene lecturas en la base de datos
- **THEN** la aplicación realiza peticiones a los endpoints de métricas hourly/daily, recibe el JSON con las series temporales y renderiza los gráficos

#### Scenario: Carga de gráficos sin datos en la base
- **WHEN** el componente de gráficos se carga y el backend no tiene lecturas para la estación
- **THEN** los gráficos muestran un estado "sin datos" con mensaje descriptivo, sin crashear

#### Scenario: Backend no disponible al cargar gráficos
- **WHEN** el frontend intenta cargar datos de métricas y el backend no responde
- **THEN** cada gráfico muestra un mensaje de error de conectividad en lugar de datos vacíos o errores de consola

## ADDED Requirements

### Requirement: Panel de estación con datos reales
El StationPanel y las MetricCards del dashboard principal SHALL mostrar datos provenientes de `GET /api/stations/{id}`, incluyendo nombre, ubicación, estado y valores actuales de temperatura, humedad, viento y precipitación.

#### Scenario: Lectura actual disponible
- **WHEN** el dashboard se carga y la API retorna una lectura actual para la estación
- **THEN** las MetricCards muestran los valores reales con 1 decimal de precisión

#### Scenario: Sin lectura actual disponible
- **WHEN** la API retorna `current: null` (estación sin lecturas)
- **THEN** las MetricCards muestran "—" o "Sin datos" en lugar de un número

### Requirement: Log de historial con datos paginados reales
El StationLogPanel SHALL consumir `GET /api/stations/{id}/readings?page=N&search=X` en lugar de generar lecturas aleatorias. La tabla SHALL actualizarse automáticamente cada 30 segundos. El botón "Pausar" SHALL detener el polling automático.

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

#### Scenario: Polling pausado
- **WHEN** el usuario hace click en "Pausar"
- **THEN** el auto-refresh se detiene hasta que el usuario haga click en "Reanudar"

### Requirement: Panel de gestión con estaciones reales
El StationManagementPanel SHALL consumir `GET /api/stations` y mostrar las estaciones reales en lugar de las 10 estaciones hardcodeadas. La paginación de 6 cards por página es client-side sobre la lista retornada.

#### Scenario: Lista de estaciones disponible
- **WHEN** el panel de gestión se monta y la API retorna al menos una estación
- **THEN** muestra las tarjetas con datos reales: nombre, ubicación y estado

#### Scenario: Lista de estaciones vacía
- **WHEN** la API retorna una lista vacía
- **THEN** el panel muestra un mensaje "No hay estaciones registradas"
