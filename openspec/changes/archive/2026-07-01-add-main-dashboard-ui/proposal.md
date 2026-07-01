## Why

El proyecto necesita una primera interfaz visual desktop para que el usuario pueda reconocer el dashboard principal de la estacion meteorologica antes de integrar backend, navegacion real o vistas historicas. El repo todavia no contiene una app frontend visible, por lo que este cambio define el alcance UI inicial con mock data y una referencia clara desde Figma.

## What Changes

- Agregar la capacidad `main-dashboard-ui` para representar el dashboard principal y su sidebar en una unica superficie frontend.
- Crear una interfaz desktop oscura basada en el frame Figma `Dashboard Principal` (`node-id=1:211`).
- Mostrar nombre de estacion, ubicacion, estado visual, ultima actualizacion y metricas actuales con mock data.
- Mostrar una sidebar fija con `Dashboard` activo y `Historial`, `Graficas` y `Gestion de estaciones` inactivos.
- Agregar una top bar visual con titulo e icon buttons/avatar sin comportamiento funcional.
- Excluir graficas, historial, navegacion funcional, integracion con backend/API y gestion real de estaciones.

## Capabilities

### New Capabilities

- `main-dashboard-ui`: capacidad frontend para renderizar una pantalla desktop estatica del dashboard principal de la estacion meteorologica, incluyendo sidebar, top bar, estado de estacion y cards de metricas actuales con mock data.

### Modified Capabilities

- Ninguna. La spec existente `web-dashboard` orientada a graficas/historial queda sin cambios por ahora.

## Impact

- Componentes afectados: frontend unicamente.
- Stack esperado: React para la app web; la implementacion puede crear el scaffold frontend si todavia no existe.
- Datos: mock data local, sin llamadas a API REST, InfluxDB ni backend FastAPI.
- Comunicacion LoRa, firmware, gateway, app Android, modelos 3D y documentacion tecnica de hardware: sin impacto directo.
- Energia/autonomia: sin impacto, porque no toca firmware ni hardware desplegado.
- Rollback: como no hay frontend desplegado en campo, revertir este cambio implica retirar la pantalla UI o volver al estado anterior del scaffold frontend.
