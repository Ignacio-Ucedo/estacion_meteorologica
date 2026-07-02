## 1. Componente compartido de batería

- [x] 1.1 Crear `frontend/src/components/BatteryBar.tsx` con la lógica extraída de `StationManagmentPanel.tsx` (umbrales: alto >60%, medio 25-60%, bajo <25%) y soporte para `value: number | null` (mostrar "Sin dato" cuando es `null`)
- [x] 1.2 Mover los estilos `.smp-battery-*` relevantes de `frontend/src/styles.css` a clases reutilizables (o mantener nombres si ya son genéricos) para que el nuevo componente no dependa del scope de `StationManagmentPanel`
- [x] 1.3 Actualizar `StationManagmentPanel.tsx` para importar y usar el `BatteryBar` compartido en lugar de la función local

## 2. Integración en el dashboard principal

- [x] 2.1 ~~Definir el tipo `batteryLevel: number | null` junto a los demás datos mock de `App.tsx`~~ — **invalidado**: el tipo y los datos mock de `App.tsx` fueron eliminados por completo por el change `connect-frontend-to-api` (commit `d74ca54`), que reemplazó los datos hardcodeados por fetches reales a la API. Hoy no existe ningún `batteryLevel` en `frontend/src/api/types.ts`.
- [x] 2.2 ~~Agregar un valor mock de `batteryLevel` a los datos hardcodeados existentes en `App.tsx`~~ — **invalidado** por el mismo motivo que 2.1.
- [x] 2.3 Agregar la métrica de batería en el dashboard principal (`App.tsx`) usando el `BatteryBar` compartido — **resuelto**: ahora recibe `current?.batteryLevel ?? null` (dato real de la API), no el `null` hardcodeado.

## 3. Verificación visual

- [x] 3.1 Levantar el frontend y verificar los tres estados de color (alto/medio/bajo) — verificado contra datos reales de Postgres (screenshot del dashboard con batería en `0%`, color bajo/rojo).
- [x] 3.2 Verificar el estado `null` ("Sin dato") — reproducido en `StationManagmentPanel.tsx` para las estaciones sin ninguna lectura (`delta`, `lambda`, `omega`).
- [x] 3.3 Confirmar que `StationManagmentPanel.tsx` sigue funcionando igual que antes tras el refactor del componente compartido, y además ahora muestra `batteryLevel` real por estación (screenshot del listado de gestión de estaciones).

## 4. Resuelto (ver `add-battery-level-backend`)

Lo que en la versión anterior de este documento estaba "pendiente fuera de alcance" se implementó en conjunto con `add-battery-level-backend` (tareas 4.1-4.3 de ese change), a pedido explícito del usuario: la batería ya no muestra "Sin dato" para estaciones con lecturas, tanto en el dashboard principal como en `StationManagmentPanel.tsx`. El único caso que sigue mostrando "Sin dato" es el legítimo: una estación sin ninguna lectura registrada.
