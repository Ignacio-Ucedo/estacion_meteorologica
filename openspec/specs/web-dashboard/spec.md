1. Resumen Tecnológico

    Framework: React 19 + TypeScript + Vite.
    Librería de Gráficos: Recharts.
    Consumo de Datos: API REST del backend FastAPI vía capa de cliente tipada en `src/api/`.

2. Requisitos Funcionales
El frontend debe permitir visualizar la evolución temporal de las siguientes variables:

    Temperatura: Gráfico de línea en grados Celsius (°C), rango -15 a 45.
    Humedad: Gráfico de línea en porcentaje (%), rango 0–100.
    Precipitación Acumulada: Gráfico de barras o línea en milímetros (mm), rango 0–60.
    Velocidad del Viento: Gráfico de evolución en kilómetros por hora (km/h), rango 0–120.

3. Escenarios de Usuario (Formato Given/When/Then)

### Requirement: Visualización de datos históricos
La aplicación SHALL obtener los datos históricos desde la API REST del backend FastAPI en lugar de generarlos en el cliente. Los gráficos de temperatura (°C, rango -15 a 45), humedad (%, 0–100), velocidad del viento (km/h, 0–120) y precipitación (mm, 0–60) SHALL renderizarse con datos reales de PostgreSQL. El componente SHALL recibir `stationId` como prop en lugar de importar la constante `STATION_ID`.

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

### Requirement: Log de historial con datos paginados reales
El StationLogPanel SHALL consumir `GET /api/stations/{id}/readings?page=N&search=X` en lugar de generar lecturas aleatorias. La tabla SHALL actualizarse automáticamente cada 30 segundos. El botón "Pausar" SHALL detener el polling automático. El StationLogPanel SHALL ser independiente de la estación activa seleccionada en el dashboard y SHALL continuar usando su propio ID de estación configurado. Cuando el auto-refresh falla, SHALL emitir un toast con mensaje amigable en lugar de fallar silenciosamente. La carga inicial fallida SHALL mostrar `InlineError` dentro del panel.

#### Scenario: Carga inicial del historial
- **WHEN** el StationLogPanel se monta
- **THEN** realiza `GET /api/stations/alpha/readings?page=1` y muestra los 7 registros más recientes

#### Scenario: Paginación de historial
- **WHEN** el usuario navega a la página N
- **THEN** la tabla realiza `GET /api/stations/alpha/readings?page=N` y muestra la página correspondiente

#### Scenario: Búsqueda en historial
- **WHEN** el usuario introduce un texto en el campo de búsqueda y confirma
- **THEN** la tabla realiza `GET /api/stations/alpha/readings?page=1&search=<texto>` y muestra los resultados filtrados

#### Scenario: Auto-refresh del historial exitoso
- **WHEN** han transcurrido 30 segundos desde la última carga
- **THEN** la tabla realiza automáticamente `GET /api/stations/alpha/readings?page=1` para mostrar nuevas lecturas

#### Scenario: Auto-refresh del historial fallido
- **WHEN** el auto-refresh de 30 s falla (backend no disponible)
- **THEN** se muestra un toast "No se pudo actualizar el historial de lecturas." y la tabla mantiene los datos del último fetch exitoso

#### Scenario: Carga inicial del historial fallida
- **WHEN** el StationLogPanel se monta y la carga inicial falla
- **THEN** el panel muestra `InlineError` con el mensaje "No se pudo cargar el historial de lecturas."

#### Scenario: Polling pausado
- **WHEN** el usuario hace click en "Pausar"
- **THEN** el auto-refresh se detiene hasta que el usuario haga click en "Reanudar"

### Requirement: Panel de gestión con estaciones reales
El StationManagementPanel SHALL consumir `GET /api/stations` paginado (server-side, 6 por página) y mostrar las estaciones reales en lugar de las 10 estaciones hardcodeadas. Cuando la carga falla, SHALL mostrar `InlineError` con mensaje contextual en lugar de `div.log-empty`.

#### Scenario: Lista de estaciones disponible
- **WHEN** el panel de gestión se monta y la API retorna al menos una estación
- **THEN** muestra las tarjetas con datos reales: nombre, ubicación y estado

#### Scenario: Lista de estaciones vacía
- **WHEN** la API retorna una lista vacía
- **THEN** el panel muestra `div.log-empty` con el mensaje "No hay estaciones registradas."

#### Scenario: Error al cargar lista de estaciones
- **WHEN** la API retorna un error al cargar las estaciones
- **THEN** el panel muestra `InlineError` con el mensaje "No se pudo cargar la lista de estaciones."

4. Diseño y Flujo de Datos
El frontend es el último eslabón de la cadena: Sensor → ESP32 → LoRa → Gateway → Backend (FastAPI) → PostgreSQL → Frontend (React). El módulo `src/api/` centraliza toda comunicación HTTP y provee hooks React para cada dominio de datos.

5. Convenciones de Trabajo
Para cualquier tarea o avance en este componente, recuerda usar Conventional Commits con el scope frontend:

    Ejemplo de nueva funcionalidad: feat(frontend): implementar gráfico de precipitación acumulada con Recharts
    Ejemplo de corrección: fix(frontend): corregir escala del eje Y en el gráfico de velocidad del viento
