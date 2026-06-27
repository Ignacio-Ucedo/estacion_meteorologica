## Why

El dashboard principal (`App.tsx`) no muestra el nivel de batería de la estación, a pesar de que es un dato crítico para detectar nodos en riesgo de quedarse sin energía en campo. El panel de gestión de estaciones (`StationManagmentPanel.tsx`) ya resuelve la visualización (componente `BatteryBar` con codificación de color por severidad), pero esa lógica vive local a ese panel y no se reutiliza en el dashboard principal.

## What Changes

- Frontend: extraer `BatteryBar` (y sus umbrales de color: alto >60%, medio 25-60%, bajo <25%) de `StationManagmentPanel.tsx` a un componente compartido reutilizable.
- Frontend: agregar una métrica de batería en el dashboard principal (`App.tsx`) usando el `BatteryBar` compartido.
- Frontend: definir el tipo `batteryLevel: number | null`, anticipando el contrato de API que expondrá el backend (ver change `add-battery-level-backend`, a cargo de otro integrante del equipo en paralelo).
- Frontend: mientras el endpoint real no esté disponible, usar un valor mock/local para `batteryLevel`, consistente con el patrón ya existente de datos hardcodeados en `App.tsx`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `web-dashboard`: el dashboard principal ahora debe mostrar el nivel de batería de la estación como una métrica visible, con codificación visual de severidad.

## Impact

- Afecta únicamente al frontend (React). No requiere cambios de backend para implementarse ni mergearse: usa un valor mock hasta que el contrato `batteryLevel` exista en la API real.
- Este change es independiente y puede desarrollarse en paralelo al change `add-battery-level-backend` (otro desarrollador). Cuando ese backend esté listo, una tarea de integración posterior (fuera de este change) deberá reemplazar el mock por el fetch real a `GET /api/stations/{id}`.
- Código afectado: `frontend/src/components/App.tsx`, `frontend/src/components/StationManagmentPanel.tsx`, nuevo `frontend/src/components/BatteryBar.tsx`, `frontend/src/styles.css`.
- No es un breaking change.
