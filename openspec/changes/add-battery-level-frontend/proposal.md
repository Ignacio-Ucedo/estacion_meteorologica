## Why

El dashboard principal (`App.tsx`) no mostraba el nivel de batería de la estación, a pesar de que es un dato crítico para detectar nodos en riesgo de quedarse sin energía en campo. El panel de gestión de estaciones (`StationManagmentPanel.tsx`) ya resolvía la visualización (componente `BatteryBar` con codificación de color por severidad), pero esa lógica vivía local a ese panel y no se reutilizaba en el dashboard principal.

**Estado actual (actualizado):** este change se implementó y mergeó (commit `7147f72`, 2026-06-27) con un valor mock en `App.tsx`, tal como se planteó abajo. Dos días después, el change `connect-frontend-to-api` (archivado, commit `d74ca54`) reescribió `App.tsx` para consumir la API real (`useStation`/`useStations`) y eliminó por completo la estructura de datos hardcodeados que sostenía el mock de batería, sin reemplazarla por nada equivalente. Como consecuencia, hoy `BatteryBar` está cableado a `value={null}` de forma permanente tanto en `App.tsx` como en `StationManagmentPanel.tsx` (siempre muestra "Sin dato"), y no existe ningún campo `batteryLevel` ni mock en `frontend/src/api/types.ts`. El objetivo original de este change — mostrar el nivel de batería de forma visible — dejó de cumplirse en la práctica.

**Decisión de producto (actualizada):** el campo de batería de una estación nunca es `null` — si no hay dato explícito, el valor por defecto es `0`. Esto reemplaza el planteo original de este change (tipo `batteryLevel: number | null`, ver Decisión 3 de `design.md`), que asumía que el backend podría devolver `null`. El único `null` que sigue existiendo cerca de esta UI es el de `station.current` completo, cuando la estación no tiene ninguna lectura.

## What Changes

- Frontend: extraer `BatteryBar` (y sus umbrales de color: alto >60%, medio 25-60%, bajo <25%) de `StationManagmentPanel.tsx` a un componente compartido reutilizable. **(hecho, sigue vigente)**
- Frontend: agregar una métrica de batería en el dashboard principal (`App.tsx`) usando el `BatteryBar` compartido. **(hecho, pero el dato que consume quedó hardcodeado en `null` — ver estado actual)**
- ~~Frontend: definir el tipo `batteryLevel: number | null`, anticipando el contrato de API que expondrá el backend~~ — este tipo se definió en su momento pero fue eliminado junto con el resto del mock de `App.tsx` al integrarse la API real; ya no existe en `frontend/src/api/types.ts`. Su reintroducción queda a cargo del change `add-battery-level-backend`, que es quien ahora expone el contrato real.
- ~~Frontend: mientras el endpoint real no esté disponible, usar un valor mock/local para `batteryLevel`~~ — ya no aplica: `App.tsx` no tiene datos hardcodeados de ningún tipo desde la integración con la API real; no tiene sentido reintroducir un mock aislado solo para batería. El closing de este change queda condicionado a que `add-battery-level-backend` entregue el dato real (ver sus tasks, sección "Integración mínima de frontend").

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `web-dashboard`: el dashboard principal ahora debe mostrar el nivel de batería de la estación como una métrica visible, con codificación visual de severidad.

## Impact

- Afecta únicamente al frontend (React). Se implementó y mergeó de forma independiente al change `add-battery-level-backend`, como estaba previsto.
- **Deuda pendiente:** el mock que sostenía la UI fue eliminado por un tercer change no relacionado (`connect-frontend-to-api`). La tarea de integración que reemplaza el `null` hardcodeado por el fetch real ya no es "posterior y fuera de alcance" en abstracto: está concretamente registrada como sección 4 de `tasks.md` en `add-battery-level-backend` (que ahora es dueño de reintroducir `batteryLevel` en `frontend/src/api/types.ts` y de cablear `App.tsx`).
- Código afectado (histórico): `frontend/src/components/App.tsx`, `frontend/src/components/StationManagmentPanel.tsx`, `frontend/src/components/BatteryBar.tsx`, `frontend/src/styles.css`. La clase de estilos quedó como `.battery-bar-*` (no `.smp-battery-*`), confirmando que la extracción a componente compartido se completó y sigue vigente hoy.
- No es un breaking change.
