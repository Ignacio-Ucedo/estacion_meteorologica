# recent-readings-chart/spec.md

# Recent Readings Chart Specification

## Purpose

Define el comportamiento del gráfico de lecturas recientes con resolución de 30 s que se muestra en la pestaña "1H" del dashboard. A diferencia de las demás pestañas (7D, 30D, 1A), la pestaña "1H" consume lecturas individuales (no agregados horarios) desde el endpoint `/metrics/{metric}/recent`, permitiendo visualizar la evolución real desde el primer uplink recibido.

---

## Requirements

### Requirement: Vista de lecturas recientes con resolución de 30 s
La pestaña "1H" de los gráficos del dashboard SHALL obtener lecturas individuales de la última hora desde el endpoint `/metrics/recent` en lugar del endpoint de métricas horarias agregadas. Cada punto del gráfico SHALL corresponder a una lectura real con su timestamp exacto, permitiendo visualizar datos desde el primer uplink recibido.

#### Scenario: Datos disponibles dentro de la última hora
- **WHEN** el componente de gráfico renderiza la pestaña "1H" y el backend tiene lecturas en los últimos 60 minutos
- **THEN** el gráfico SHALL mostrar un punto por cada lectura recibida con el eje X en formato HH:MM

#### Scenario: Sin lecturas en la última hora
- **WHEN** el componente de gráfico renderiza la pestaña "1H" y no hay lecturas en los últimos 60 minutos
- **THEN** el gráfico SHALL mostrar el mismo estado vacío ("sin datos") que las otras pestañas en igual situación

#### Scenario: Las demás pestañas no se ven afectadas
- **WHEN** el usuario selecciona cualquier pestaña distinta de "1H" (7D, 30D, 1A)
- **THEN** el gráfico SHALL seguir consumiendo los endpoints de métricas diarias u horarias sin cambios
