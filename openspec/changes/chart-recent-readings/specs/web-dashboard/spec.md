## MODIFIED Requirements

### Requirement: Visualización de datos históricos — pestaña 1H
La pestaña "1H" del componente de gráficas (`SelectedMetricChart` / `GraficasPanel`) SHALL obtener sus datos desde el endpoint de lecturas recientes (`/metrics/{metric}/recent?minutes=60`) en lugar del endpoint de métricas horarias agregadas (`/metrics/{metric}/hourly`).

#### Scenario: El eje X de "1H" muestra la hora exacta de cada lectura
- **GIVEN** que el componente está en la pestaña "1H"
- **WHEN** se reciben puntos del endpoint `/metrics/{metric}/recent`
- **THEN** el eje X SHALL mostrar el timestamp real de cada lectura en formato HH:MM (no buckets de hora de reloj)

#### Scenario: El estado de carga de la pestaña "1H" es consistente con el resto
- **GIVEN** que el componente está en la pestaña "1H"
- **WHEN** la petición al endpoint de lecturas recientes está en curso
- **THEN** el gráfico SHALL mostrar el mismo indicador de carga que las demás pestañas

#### Scenario: Sin cambios en las pestañas 7D, 30D, 1A
- **GIVEN** que el usuario selecciona cualquier pestaña distinta de "1H"
- **WHEN** el componente obtiene datos
- **THEN** SHALL seguir usando los endpoints de métricas diarias sin ningún cambio en comportamiento, formato de eje o fuente de datos
