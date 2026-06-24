## Context

Este cambio define la primera pantalla visual del frontend web de la estacion meteorologica. La repo actualmente contiene principalmente artefactos OpenSpec y una spec `web-dashboard` enfocada en graficas/historial; esta historia cubre una pantalla distinta y mas temprana: dashboard principal con datos actuales y sidebar estatica.

La referencia visual principal es el frame Figma `Dashboard Principal` (`node-id=1:211`). El nodo leido previamente `1:2` corresponde a historial y solo sirve como referencia secundaria de estilo, no como alcance funcional.

## Goals / Non-Goals

**Goals:**

- Renderizar una interfaz desktop oscura para el dashboard principal.
- Usar una sidebar fija de 256px con marca, subtitulo y opciones de navegacion visuales.
- Mostrar `Dashboard` como item activo.
- Mostrar `Historial`, `Graficas` y `Gestion de estaciones` como items inactivos.
- Mostrar nombre de estacion, ubicacion y fecha/hora de ultima actualizacion.
- Mostrar metricas actuales: temperatura en °C, humedad en %, velocidad del viento en km/h, direccion del viento en orientacion cardinal y precipitacion acumulada en mm.
- Usar mock data local y textos representativos.
- Mantener los controles de top bar como elementos visuales sin comportamiento.

**Non-Goals:**

- No implementar navegacion real entre vistas.
- No integrar backend, API REST, InfluxDB ni datos en vivo.
- No incluir graficas en el dashboard.
- No implementar historial de mediciones.
- No implementar gestion real de estaciones.
- No cubrir responsive mobile en esta historia; el objetivo de validacion es desktop.
- No modificar firmware, gateway, app Android ni modelos 3D.

## Visual Direction

La pantalla debe seguir una estetica desktop oscura, tecnica y contenida:

- Fondo principal: `#131315`.
- Sidebar: `#1b1b1d`.
- Bordes: `#45464d`.
- Estado activo: `#3a4a5f`.
- Texto principal: `#e4e2e4`.
- Texto secundario: `#c6c6cd`.
- Acento claro: `#bec6e0`.
- Tipografia principal: `Inter`.
- Tipografia numerica o de datos: `JetBrains Mono`.

La sidebar puede usar la marca `WeatherOS` y el subtitulo `Precision Monitoring` para alinearse con Figma. Los items opcionales de footer (`Support`, `Account`) quedan fuera del alcance requerido y pueden omitirse para mantener una implementacion estricta.

## Layout

La estructura esperada es:

```text
App shell desktop
  |
  +-- Sidebar fija, 256px
  |     - WeatherOS
  |     - Precision Monitoring
  |     - Dashboard activo
  |     - Historial inactivo
  |     - Graficas inactivo
  |     - Gestion de estaciones inactivo
  |
  +-- Main area
        |
        +-- Top bar
        |     - Station Monitor
        |     - icon buttons/avatar visuales
        |
        +-- Station status/header
        |     - Nombre estacion + ubicacion
        |     - Estado online
        |     - Badge operativo
        |     - Ultima actualizacion
        |
        +-- Metric cards grid
              - Temperatura
              - Humedad
              - Velocidad del viento
              - Direccion del viento
              - Precipitacion acumulada
```

## Data Model

La implementacion debe usar mock data local, por ejemplo:

```ts
const station = {
  name: "Station Alpha",
  location: "Mendoza, Argentina",
  status: "Online",
  lastUpdated: "Last updated: 2 minutes ago",
};

const metrics = [
  { label: "Temperatura", value: "24.8", unit: "°C" },
  { label: "Humedad", value: "61", unit: "%" },
  { label: "Velocidad del viento", value: "18.4", unit: "km/h" },
  { label: "Direccion del viento", value: "NE", unit: "" },
  { label: "Precipitacion acumulada", value: "12.6", unit: "mm" },
];
```

Los valores exactos pueden cambiar durante implementacion, siempre que cubran todas las unidades y campos requeridos.

## Risks / Trade-offs

- [No existe scaffold frontend visible] -> La implementacion puede requerir crear estructura React minima antes de construir la pantalla.
- [La spec existente `web-dashboard` habla de graficas] -> Este cambio agrega una capacidad nueva para evitar mezclar la pantalla principal con historico/graficas.
- [Figma contiene elementos extra] -> La implementacion debe priorizar criterios de aceptacion y puede omitir footer de sidebar si aumenta alcance sin aportar a la historia.
- [Sin backend] -> Los datos mock no deben presentarse como lecturas reales ni crear dependencias a servicios todavia inexistentes.

## Validation

La validacion principal es visual en desktop:

- Verificar que la sidebar mida aproximadamente 256px y muestre los cuatro items requeridos con estado activo/inactivo correcto.
- Verificar que el dashboard muestre nombre, ubicacion y ultima actualizacion.
- Verificar que existan cards o bloques para las cinco metricas requeridas con unidades correctas.
- Verificar que no haya graficas visibles.
- Verificar que no haya navegacion real ni llamadas a backend/API.
