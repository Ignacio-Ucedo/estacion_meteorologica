## MODIFIED Requirements

### Requirement: Visualización de datos históricos
La aplicación SHALL obtener los datos históricos desde la API REST del backend FastAPI en lugar de generarlos en el cliente. Los gráficos de temperatura (°C, rango -15 a 45), humedad (%, 0–100), velocidad del viento (km/h, 0–120) y precipitación (mm, 0–60) SHALL renderizarse con datos reales de PostgreSQL. El componente SHALL recibir `stationId` como prop en lugar de importar la constante `STATION_ID`. El encabezado de cada gráfico (título y selector de período) SHALL permanecer legible y sin desbordarse en cualquier ancho de pantalla. El dashboard SHALL mostrar exclusivamente las estaciones pertenecientes al usuario autenticado; no SHALL ser posible acceder ni visualizar datos de estaciones de otros usuarios desde el dashboard.

#### Scenario: Carga de gráficos con datos disponibles
- **WHEN** el componente de gráficos se carga y el backend tiene lecturas en la base de datos para la estación seleccionada
- **THEN** la aplicación realiza peticiones a los endpoints de métricas hourly/daily con el `stationId` activo, y renderiza los gráficos

#### Scenario: Cambio de estación actualiza los gráficos
- **WHEN** el usuario selecciona una estación diferente desde el modal
- **THEN** la sección de Gráficas cancela los fetches anteriores y realiza nuevas peticiones con el nuevo `stationId`

#### Scenario: Carga de gráficos sin datos en la base
- **WHEN** el componente de gráficos se carga y el backend no tiene lecturas para la estación seleccionada
- **THEN** los gráficos muestran estado vacío sin error

#### Scenario: Dashboard muestra solo estaciones propias
- **WHEN** el usuario `nacho` está autenticado y accede al dashboard
- **THEN** el listado de estaciones y el station switcher contienen únicamente las estaciones cuyo `user_id` coincide con `nacho`; las estaciones de otros usuarios no son visibles ni accesibles

#### Scenario: Sin estaciones propias
- **WHEN** el usuario autenticado no tiene ninguna estación asociada
- **THEN** el dashboard muestra un estado vacío o indicación de que no hay estaciones disponibles (sin error)
