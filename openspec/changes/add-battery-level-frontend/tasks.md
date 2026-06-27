## 1. Componente compartido de batería

- [x] 1.1 Crear `frontend/src/components/BatteryBar.tsx` con la lógica extraída de `StationManagmentPanel.tsx` (umbrales: alto >60%, medio 25-60%, bajo <25%) y soporte para `value: number | null` (mostrar "Sin dato" cuando es `null`)
- [x] 1.2 Mover los estilos `.smp-battery-*` relevantes de `frontend/src/styles.css` a clases reutilizables (o mantener nombres si ya son genéricos) para que el nuevo componente no dependa del scope de `StationManagmentPanel`
- [x] 1.3 Actualizar `StationManagmentPanel.tsx` para importar y usar el `BatteryBar` compartido en lugar de la función local

## 2. Integración en el dashboard principal

- [x] 2.1 Definir el tipo `batteryLevel: number | null` junto a los demás datos mock de `App.tsx`
- [x] 2.2 Agregar un valor mock de `batteryLevel` a los datos hardcodeados existentes en `App.tsx`
- [x] 2.3 Agregar la métrica de batería en el dashboard principal (`App.tsx`) usando el `BatteryBar` compartido

## 3. Verificación visual

- [x] 3.1 Levantar el frontend y verificar los tres estados de color (alto/medio/bajo) ajustando temporalmente el valor mock
- [x] 3.2 Verificar el estado `null` ("Sin dato") ajustando temporalmente el valor mock a `null`
- [x] 3.3 Confirmar que `StationManagmentPanel.tsx` sigue funcionando igual que antes tras el refactor del componente compartido
