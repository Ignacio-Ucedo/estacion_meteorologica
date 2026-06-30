## ADDED Requirements

### Requirement: Modal de selección de estación

El sistema SHALL exponer un modal de cambio de estación activa accesible desde dos puntos de entrada: el chip de estación en el Topbar y el StationPanel. El modal SHALL mostrar la lista de estaciones con nombre, ubicación y estado, con soporte de búsqueda por nombre y paginación de 6 estaciones por página.

#### Scenario: Apertura desde chip del Topbar

- **WHEN** el usuario hace click en el chip de estación del Topbar
- **THEN** el modal de selección se abre mostrando la lista de estaciones paginada

#### Scenario: Apertura desde StationPanel

- **WHEN** el usuario hace click en cualquier parte del StationPanel
- **THEN** el modal de selección se abre mostrando la lista de estaciones paginada

#### Scenario: Búsqueda por nombre en el modal

- **WHEN** el usuario escribe un término en el campo de búsqueda del modal
- **THEN** la lista se filtra para mostrar solo estaciones cuyo nombre contiene el término (case-insensitive), y la paginación vuelve a la página 1

#### Scenario: Paginación del modal

- **WHEN** el total de estaciones filtradas supera 6
- **THEN** el modal muestra controles de paginación (‹ / N de M / ›) y permite navegar entre páginas de 6 estaciones

#### Scenario: Selección de estación

- **WHEN** el usuario hace click en una estación del modal
- **THEN** el modal se cierra, la estación seleccionada pasa a ser la estación activa, y el Dashboard y la sección de Gráficas se actualizan con los datos de esa estación

#### Scenario: Estación actualmente seleccionada resaltada

- **WHEN** el modal está abierto
- **THEN** la estación actualmente activa aparece visualmente resaltada en la lista

#### Scenario: Cierre sin cambio

- **WHEN** el usuario cierra el modal sin seleccionar una estación (via [×] o click fuera)
- **THEN** la estación activa no cambia y el modal se cierra

### Requirement: Persistencia de estación seleccionada en localStorage

La estación seleccionada SHALL persistir entre sesiones mediante `localStorage` bajo la clave `"station-monitor:selected-station"`. Al iniciar la app, SHALL intentar restaurar la última estación seleccionada. Si dicha estación ya no existe en el backend (404), SHALL auto-seleccionar la primera estación disponible en lugar de mostrar un error permanente.

#### Scenario: Restaurar estación al recargar la página

- **WHEN** el usuario recarga la página habiendo seleccionado previamente una estación
- **THEN** la app inicia directamente con esa estación activa, sin necesidad de volver a seleccionarla

#### Scenario: Guardar estación al seleccionarla

- **WHEN** el usuario selecciona una estación desde el modal
- **THEN** el id de esa estación se guarda en `localStorage["station-monitor:selected-station"]`

#### Scenario: Fallback si la estación persistida fue eliminada

- **WHEN** la app intenta cargar la estación guardada en localStorage y el backend responde 404
- **THEN** la app realiza `GET /api/stations?page=1`, selecciona automáticamente la primera estación del resultado, y la guarda en localStorage reemplazando el valor anterior

#### Scenario: Sin estaciones disponibles tras eliminación

- **WHEN** la app detecta que la estación persistida no existe y `GET /api/stations?page=1` devuelve `data: []`
- **THEN** el Dashboard muestra el banner de error de conectividad existente; no se produce un loop de reintentos

### Requirement: Chip de estación en el Topbar

El Topbar SHALL mostrar un chip que indica la estación actualmente seleccionada por nombre. El chip SHALL ser el primer punto de entrada al modal de selección.

#### Scenario: Chip muestra nombre de estación activa

- **WHEN** hay una estación seleccionada y sus datos fueron cargados desde la API
- **THEN** el chip del Topbar muestra el nombre de esa estación

#### Scenario: Chip en estado de carga

- **WHEN** la estación activa todavía está cargando
- **THEN** el chip muestra "—" o un estado de placeholder

### Requirement: StationPanel clickeable

El StationPanel SHALL tener un indicador visual (ej. ícono de cambio o cursor pointer) que comunique al usuario que puede hacer click para cambiar de estación.

#### Scenario: Cursor indica interactividad

- **WHEN** el usuario posiciona el cursor sobre el StationPanel
- **THEN** el cursor cambia a pointer y el panel muestra algún indicador visual de interactividad

### Requirement: Dashboard y Gráficas reactivos a la estación seleccionada

El Dashboard (métricas actuales, panel de estación, gráfico de métrica seleccionada) y la sección de Gráficas (4 gráficos históricos) SHALL mostrar datos de la estación activa en todo momento.

#### Scenario: Cambio de estación actualiza el Dashboard

- **WHEN** el usuario selecciona una estación diferente desde el modal
- **THEN** el Dashboard realiza un nuevo `GET /api/stations/{nuevo_id}` y actualiza nombre, ubicación, estado y métricas actuales

#### Scenario: Cambio de estación actualiza las Gráficas

- **WHEN** el usuario selecciona una estación diferente desde el modal
- **THEN** la sección de Gráficas realiza nuevas peticiones a los endpoints de métricas usando el nuevo station ID

#### Scenario: Historial no se ve afectado por el cambio de estación

- **WHEN** el usuario cambia de estación activa
- **THEN** el StationLogPanel no cambia su comportamiento; sigue mostrando lecturas de todas las estaciones y respetando el filtro de búsqueda propio del usuario
