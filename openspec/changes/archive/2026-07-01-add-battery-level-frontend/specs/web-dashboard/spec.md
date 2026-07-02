> **Nota de estado (resuelta):** los requisitos de abajo ya están implementados en su totalidad. `App.tsx` consume `current?.batteryLevel ?? null` (dato real de `GET /api/stations/{id}`), y `StationManagmentPanel.tsx` consume `station.batteryLevel` (dato real de `GET /api/stations`, agregado en `add-battery-level-backend` a pedido del usuario). Verificado visualmente contra Postgres real: estaciones con lecturas muestran el porcentaje; solo las estaciones sin ninguna lectura muestran "Sin dato".
>
> **Decisión de producto:** `batteryLevel` nunca es `null` cuando hay una lectura — el backend lo default-ea a `0`. El escenario "sin dato" de abajo representa "estación sin ninguna lectura registrada" (`current` completo en `null`), igual que el resto de las métricas del dashboard — no "batería sin dato" con lecturas existentes.

## ADDED Requirements

### Requirement: Visualización del nivel de batería en el dashboard principal
El dashboard principal SHALL mostrar el nivel de batería de la estación seleccionada como una métrica visible junto al resto de las variables ambientales (temperatura, humedad, viento, precipitación), consumiendo el campo `batteryLevel` expuesto por `GET /api/stations/{id}`. El campo SHALL tratarse siempre como un número (nunca `null`); una estación sin dato explícito de batería SHALL mostrar `0%`, no un estado de "sin dato".

#### Scenario: Batería con dato disponible
- **Given** que el backend devuelve `current.batteryLevel = 78` para la estación activa
- **When** el dashboard principal se renderiza
- **Then** se muestra una métrica de batería con el valor `78%`

#### Scenario: Batería sin dato explícito (default)
- **Given** que el backend devuelve `current.batteryLevel = 0` (default, sin dato explícito registrado) para la estación activa
- **When** el dashboard principal se renderiza
- **Then** la métrica de batería muestra `0%` con la variante de color "bajo" (rojo), igual que cualquier otro valor bajo — no existe un estado visual distinto de "sin dato" para este campo

#### Scenario: Estación sin ninguna lectura registrada
- **Given** que el backend devuelve `current = null` para la estación activa (no `current.batteryLevel`, sino el objeto completo)
- **When** el dashboard principal se renderiza
- **Then** la métrica de batería indica explícitamente la ausencia de lectura (p. ej. "Sin dato"), igual que el resto de las métricas cuando no hay `current`

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
