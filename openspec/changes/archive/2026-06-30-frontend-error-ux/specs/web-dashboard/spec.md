## MODIFIED Requirements

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

## MODIFIED Requirements

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
