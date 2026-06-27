## ADDED Requirements

### Requirement: Visualización del nivel de batería en el dashboard principal
El dashboard principal SHALL mostrar el nivel de batería de la estación seleccionada como una métrica visible junto al resto de las variables ambientales (temperatura, humedad, viento, precipitación), consumiendo el campo `batteryLevel` expuesto por `GET /api/stations/{id}`.

#### Scenario: Batería con dato disponible
- **Given** que el backend devuelve `current.batteryLevel = 78` para la estación activa
- **When** el dashboard principal se renderiza
- **Then** se muestra una métrica de batería con el valor `78%`

#### Scenario: Batería sin dato disponible
- **Given** que el backend devuelve `current.batteryLevel = null` para la estación activa
- **When** el dashboard principal se renderiza
- **Then** la métrica de batería indica explícitamente la ausencia de dato (p. ej. "Sin dato") en lugar de mostrar `0%` o un valor inventado

---

### Requirement: Codificación visual de severidad del nivel de batería
La métrica de batería del dashboard principal SHALL usar la misma codificación de color por umbral ya validada en el panel de gestión de estaciones: verde para >60%, naranja para 25-60%, rojo para <25%.

#### Scenario: Batería en nivel alto
- **Given** que `batteryLevel` es 85
- **When** se renderiza la métrica de batería
- **Then** se muestra con la variante de color "alto" (verde)

#### Scenario: Batería en nivel medio
- **Given** que `batteryLevel` es 40
- **When** se renderiza la métrica de batería
- **Then** se muestra con la variante de color "medio" (naranja)

#### Scenario: Batería en nivel bajo
- **Given** que `batteryLevel` es 15
- **When** se renderiza la métrica de batería
- **Then** se muestra con la variante de color "bajo" (rojo)
