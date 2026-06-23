1. Resumen Tecnológico

    Framework: React.
    Librería de Gráficos: Recharts o Chart.js.
    Consumo de Datos: API REST generada por el backend en FastAPI.

2. Requisitos Funcionales
El frontend debe permitir visualizar la evolución temporal de las siguientes variables:

    Temperatura: Gráfico de línea en grados Celsius (°C).
    Humedad: Gráfico de línea en porcentaje (%).
    Precipitación Acumulada: Gráfico de barras o línea en milímetros (mm).
    Velocidad del Viento: Gráfico de evolución en kilómetros por hora (km/h).

3. Escenarios de Usuario (Formato Given/When/Then)
Siguiendo las directrices de specs del archivo de configuración:
Escenario 1: Visualización de datos históricos

    Given: Que el usuario accede a la URL de la aplicación web y el backend tiene datos almacenados en InfluxDB.
    When: El componente de gráficos se carga en el navegador.
    Then: La aplicación realiza una petición GET a la API REST, recibe un JSON con las series temporales y renderiza los gráficos de temperatura, humedad, viento y lluvia.

Escenario 2: Manejo de errores de conexión

    Given: Que el gateway o el backend no están disponibles o hay un error de red.
    When: El frontend intenta obtener los últimos datos de la estación.
    Then: La interfaz debe mostrar un mensaje de error claro indicando la pérdida de conectividad, en lugar de gráficos vacíos o errores de consola.

4. Diseño y Flujo de Datos
El frontend es el último eslabón de la cadena: Sensor → ESP32 → LoRa → Gateway → Backend (FastAPI) → InfluxDB → Frontend (React). Debe ser capaz de manejar la estructura de datos que el backend extrae de la base de datos de series temporales (InfluxDB).
5. Convenciones de Trabajo
Para cualquier tarea o avance en este componente, recuerda usar Conventional Commits con el scope frontend:

    Ejemplo de nueva funcionalidad: feat(frontend): implementar gráfico de precipitación acumulada con Recharts
    Ejemplo de corrección: fix(frontend): corregir escala del eje Y en el gráfico de velocidad del viento