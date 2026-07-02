# loading-skeleton Specification

## Purpose

Estados de carga del dashboard basados en skeleton screens animados: un componente `Skeleton` reutilizable reemplaza los textos "Cargando…" en paneles, metric cards, gráficos y listas paginadas del frontend.

## Requirements

### Requirement: Componente Skeleton compartido

El sistema SHALL proveer un componente reutilizable `Skeleton` que renderice un bloque con animación de pulso de opacidad. El componente SHALL aceptar `width`, `height` y `radius` opcionales (con valores por defecto razonables para una línea de texto) para adaptarse a la forma del contenido que reemplaza. El componente SHALL marcarse como `aria-hidden="true"` porque es puramente decorativo.

#### Scenario: Renderizado de un bloque skeleton

- **GIVEN** un componente que necesita mostrar un estado de carga
- **WHEN** instancia `<Skeleton width="60px" height="14px" />`
- **THEN** se renderiza un bloque con esas dimensiones y la animación de pulso activa

### Requirement: Animación del skeleton respeta prefers-reduced-motion

La animación de pulso de opacidad del componente `Skeleton` SHALL desactivarse cuando el usuario tiene configurada la preferencia `prefers-reduced-motion: reduce`, siguiendo la misma convención ya aplicada a `.log-live-dot` y `.log-row-enter`.

#### Scenario: Usuario con reduced motion activado

- **GIVEN** el sistema operativo del usuario tiene activada la preferencia de movimiento reducido
- **WHEN** se renderiza cualquier `<Skeleton>` en el dashboard
- **THEN** el bloque se muestra sin animación de pulso (opacidad estática)

### Requirement: Skeleton sin delay artificial

El sistema SHALL mostrar el `Skeleton` inmediatamente cuando el estado de carga de una superficie sea verdadero, sin aplicar ningún umbral mínimo de tiempo ni debounce antes de mostrarlo u ocultarlo.

#### Scenario: Fetch que resuelve muy rápido

- **GIVEN** una superficie del dashboard inicia una carga de datos
- **WHEN** el estado `loading` pasa a `true` y luego a `false` en menos de 100ms
- **THEN** el `Skeleton` se muestra y se oculta sin retraso adicional, siguiendo el valor de `loading` en cada instante

### Requirement: Estado de carga en el panel de estación

`StationPanel` SHALL aceptar un prop `loading?: boolean`. Cuando `loading` es `true`, el badge de estado y el texto de "última actualización" SHALL reemplazarse por `Skeleton`, en vez de mostrar el texto "Cargando…".

#### Scenario: Dashboard cargando datos de la estación

- **WHEN** `App` no tiene todavía la respuesta de `useStation` (`loading === true`)
- **THEN** `StationPanel` muestra `Skeleton` en el badge de estado y en el texto de última actualización, sin renderizar el string "Cargando…"

### Requirement: Estado de carga en metric cards

`MetricCard` SHALL aceptar un prop `loading?: boolean` (no existía previamente). Cuando `loading` es `true`, `label`, `value` y `detail` SHALL reemplazarse por `Skeleton`, en vez de mostrar el placeholder `"—"`. El estado de carga SHALL ser visualmente distinguible del estado "sin dato" (`"—"` cuando `loading` es `false` pero el valor es `null`/`undefined`).

#### Scenario: Métrica cargando

- **GIVEN** el dashboard está esperando la respuesta de `useStation`
- **WHEN** se renderiza una `MetricCard` con `loading={true}`
- **THEN** la card muestra `Skeleton` en lugar del valor numérico y el detalle, y no muestra `"—"`

#### Scenario: Métrica sin dato disponible (no es un estado de carga)

- **GIVEN** la respuesta de `useStation` ya llegó (`loading === false`) pero el valor de una métrica es `null`
- **WHEN** se renderiza esa `MetricCard`
- **THEN** la card muestra `"—"` como hoy, sin `Skeleton`

### Requirement: Silueta de gráfico en ChartCard según el tipo

Cuando `ChartCard` recibe `loading={true}`, el sistema SHALL reemplazar el overlay de texto ("Cargando datos…") por una silueta decorativa de `Skeleton` cuya forma depende del prop `kind`: para `kind="bar"` SHALL mostrar una fila de barras fantasma de alturas fijas variadas; para `kind="line"` o `kind="area"` SHALL mostrar una curva SVG ondulada fantasma estática. Ninguna de las dos siluetas SHALL calcularse a partir de datos reales.

#### Scenario: Gráfico de barras cargando

- **GIVEN** un `ChartCard` con `kind="bar"` (precipitación)
- **WHEN** recibe `loading={true}`
- **THEN** el cuerpo del gráfico muestra una fila de barras fantasma de alturas variadas con animación de pulso, en vez del texto "Cargando datos…"

#### Scenario: Gráfico de línea o área cargando

- **GIVEN** un `ChartCard` con `kind="line"` o `kind="area"`
- **WHEN** recibe `loading={true}`
- **THEN** el cuerpo del gráfico muestra una curva SVG ondulada fantasma con animación de pulso, en vez del texto "Cargando datos…"

### Requirement: Filas fantasma en listas paginadas

`StationLogPanel`, `StationManagementPanel` y `StationSwitcherModal` SHALL mostrar exactamente 5 filas fantasma (`Skeleton`) cuando su estado `loading` sea `true`, en vez del texto "Cargando…"/"Cargando estaciones…". El número de filas fantasma SHALL ser fijo y no SHALL depender del tamaño de una respuesta previa.

#### Scenario: Historial de lecturas cargando

- **WHEN** `StationLogPanel` tiene `loading === true`
- **THEN** la tabla muestra 5 filas fantasma con `Skeleton`, sin el texto "Cargando…"

#### Scenario: Gestión de estaciones cargando

- **WHEN** `StationManagementPanel` tiene `loading === true`
- **THEN** la lista muestra 5 filas fantasma con `Skeleton`, sin el texto "Cargando estaciones…"

#### Scenario: Modal de selección de estación cargando

- **WHEN** `StationSwitcherModal` tiene `loading === true`
- **THEN** la lista del modal muestra 5 filas fantasma con `Skeleton`, sin el texto "Cargando…"
