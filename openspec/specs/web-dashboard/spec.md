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

### Requirement: Visualización del nivel de batería en el dashboard principal
El grid de metric cards del dashboard principal SHALL incluir una métrica de batería junto al resto de las variables ambientales (temperatura, humedad, viento, precipitación), consumiendo el campo `batteryLevel` expuesto por `GET /api/stations/{id}`. Cuando existe una lectura actual (`current` no es `null`), el campo SHALL tratarse siempre como un número (nunca `null`), con `0` como valor por defecto cuando la estación no reportó batería explícitamente.

#### Scenario: Batería con dato disponible
- **WHEN** el backend retorna `current.batteryLevel = 78` para la estación seleccionada
- **THEN** la metric card de batería muestra `78%`

#### Scenario: Batería en su valor por defecto
- **WHEN** el backend retorna `current.batteryLevel = 0` (default, sin dato explícito) para la estación seleccionada
- **THEN** la metric card de batería muestra `0%`, igual que cualquier otro valor numérico bajo

#### Scenario: Sin lectura actual disponible
- **WHEN** la API retorna `current: null` para la estación seleccionada
- **THEN** la metric card de batería muestra "—", igual que el resto de las metric cards del dashboard en ese mismo caso

### Requirement: Codificación visual de severidad del nivel de batería
La metric card de batería SHALL mostrar, junto al valor numérico, un indicador (`BatteryIcon`) que codifica por color el nivel de severidad de la carga: verde para más de 60%, naranja para 25%–60%, y rojo para menos de 25%.

#### Scenario: Batería en nivel alto
- **WHEN** `batteryLevel` es 85
- **THEN** el indicador de batería se muestra en verde ("alto")

#### Scenario: Batería en nivel medio
- **WHEN** `batteryLevel` es 40
- **THEN** el indicador de batería se muestra en naranja ("medio")

#### Scenario: Batería en nivel bajo
- **WHEN** `batteryLevel` es 15
- **THEN** el indicador de batería se muestra en rojo ("bajo")

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

### Requirement: Gráfico de la variable seleccionada siempre visible en el dashboard
El dashboard principal SHALL mostrar, en todo momento y debajo del grid de metric cards, un gráfico con la evolución temporal de la variable actualmente seleccionada (temperatura, humedad, velocidad del viento o precipitación acumulada), sin requerir abrir un elemento emergente ni abandonar la pestaña actual. El gráfico mostrado SHALL reutilizar el mismo componente y la misma configuración de gráfico (tipo de gráfico, color, unidad, dominio de ejes y periodos 1D/7D/30D/1Y) que utiliza la pestaña "Gráficas" para esa variable, sin duplicar la lógica de obtención o render de datos.

#### Scenario: Estado inicial del dashboard
- **WHEN** el usuario abre el dashboard principal por primera vez
- **THEN** la aplicación muestra el gráfico de evolución de una variable por defecto (Temperatura) debajo del grid de metric cards

#### Scenario: Seleccionar una metric card con histórico disponible
- **WHEN** el usuario hace click en la metric card de Temperatura, Humedad, Velocidad del viento o Precipitación acumulada en el dashboard principal
- **THEN** el gráfico mostrado debajo del grid se actualiza in place para mostrar la evolución de esa variable, con los mismos datos, colores y periodos que se ven en la pestaña "Gráficas", sin recargar la página, sin navegar a otra pestaña y sin ocultar el resto del dashboard
- **AND** la metric card seleccionada queda visualmente resaltada como activa

#### Scenario: Metric card sin histórico disponible
- **WHEN** el usuario hace click en una metric card que no tiene serie histórica definida (por ejemplo Dirección del viento o Batería)
- **THEN** el gráfico mostrado debajo del grid no cambia y la card permanece en su estado visual normal

### Requirement: Configuración de gráficos centralizada por variable
La configuración de presentación de cada gráfico (título, tipo de gráfico, color, unidad, dominio de ejes y series diarias) SHALL definirse en un único lugar compartido por la pestaña "Gráficas" y por el detalle de gráfico abierto desde una metric card, de modo que ambos flujos queden sincronizados ante cualquier cambio futuro en esa configuración.

#### Scenario: Cambio de configuración se refleja en ambos flujos
- **WHEN** se actualiza la configuración de presentación de una variable (por ejemplo su color o el dominio del eje Y)
- **THEN** tanto el gráfico mostrado en la pestaña "Gráficas" como el gráfico mostrado al seleccionar la metric card correspondiente reflejan el mismo cambio, sin requerir ediciones en dos lugares distintos

4. Diseño y Flujo de Datos
El frontend es el último eslabón de la cadena: Sensor → ESP32 → LoRa → Gateway → Backend (FastAPI) → PostgreSQL → Frontend (React). El módulo `src/api/` centraliza toda comunicación HTTP y provee hooks React para cada dominio de datos.

5. Convenciones de Trabajo
Para cualquier tarea o avance en este componente, recuerda usar Conventional Commits con el scope frontend:

    Ejemplo de nueva funcionalidad: feat(frontend): implementar gráfico de precipitación acumulada con Recharts
    Ejemplo de corrección: fix(frontend): corregir escala del eje Y en el gráfico de velocidad del viento
