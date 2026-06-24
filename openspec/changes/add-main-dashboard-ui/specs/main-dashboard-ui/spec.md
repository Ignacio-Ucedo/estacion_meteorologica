## ADDED Requirements

### Requirement: El dashboard principal muestra identidad de estacion
El frontend SHALL renderizar una pantalla desktop del dashboard principal que muestre el nombre de la estacion meteorologica, su ubicacion y la fecha/hora o texto de ultima actualizacion usando mock data local.

#### Scenario: Se visualiza la identidad de estacion
- **GIVEN** el usuario abre la pantalla del dashboard principal en un viewport desktop
- **WHEN** la interfaz termina de renderizar
- **THEN** el usuario ve el nombre de la estacion meteorologica
- **AND** ve la ubicacion junto al nombre o en el mismo bloque de encabezado
- **AND** ve la ultima actualizacion de los datos

### Requirement: El dashboard principal muestra metricas actuales
El frontend SHALL mostrar metricas actuales de la estacion usando mock data local, sin depender de backend ni API.

Las metricas requeridas SHALL incluir:

- Temperatura en °C.
- Humedad en %.
- Velocidad del viento en km/h.
- Direccion del viento en orientacion cardinal.
- Precipitacion acumulada en mm.

#### Scenario: Se visualizan todas las metricas requeridas
- **GIVEN** el usuario abre la pantalla del dashboard principal
- **WHEN** la grilla o conjunto de metricas termina de renderizar
- **THEN** el usuario ve una metrica de temperatura con unidad °C
- **AND** ve una metrica de humedad con unidad %
- **AND** ve una metrica de velocidad del viento con unidad km/h
- **AND** ve una metrica de direccion del viento con orientacion cardinal
- **AND** ve una metrica de precipitacion acumulada con unidad mm

### Requirement: La sidebar muestra navegacion visual estatica
El frontend SHALL renderizar una sidebar fija para la pantalla desktop con los items requeridos y estados visuales activos/inactivos, sin implementar navegacion funcional.

#### Scenario: La sidebar marca Dashboard como activo
- **GIVEN** el usuario abre la pantalla del dashboard principal
- **WHEN** la sidebar termina de renderizar
- **THEN** el item `Dashboard` aparece visualmente activo
- **AND** los items `Historial`, `Graficas` y `Gestion de estaciones` aparecen visualmente inactivos

#### Scenario: Los items inactivos no navegan realmente
- **GIVEN** el usuario ve la sidebar del dashboard principal
- **WHEN** interactua con `Historial`, `Graficas` o `Gestion de estaciones`
- **THEN** la aplicacion no cambia a una vista funcional de historial, graficas ni gestion de estaciones en esta historia

### Requirement: El dashboard principal no incluye graficas
El frontend SHALL omitir componentes de graficas, charts o visualizaciones historicas dentro del dashboard principal para este cambio.

#### Scenario: No se renderizan graficas en el dashboard principal
- **GIVEN** el usuario abre la pantalla del dashboard principal
- **WHEN** inspecciona el area principal de contenido
- **THEN** no ve graficas de linea, barras, torta, area ni series temporales
- **AND** no ve una vista de historial de mediciones

### Requirement: La interfaz sigue la referencia visual desktop oscura
El frontend SHALL presentar el dashboard principal como una interfaz desktop oscura alineada al frame Figma `Dashboard Principal`, incluyendo sidebar fija, top bar, area de estado/encabezado de estacion y cards de metricas.

#### Scenario: La estructura visual coincide con la referencia de alcance
- **GIVEN** el usuario abre la pantalla en un viewport desktop
- **WHEN** la UI termina de renderizar
- **THEN** ve una sidebar fija a la izquierda
- **AND** ve una top bar en el area principal
- **AND** ve un bloque de estado o encabezado de estacion
- **AND** ve las metricas actuales como cards o bloques visuales
