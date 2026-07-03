## Why

El node mock es un ESP32 con SX1278 pero sin sensores reales — útil para probar el stack LoRaWAN sin hardware de sensores. Hoy se flashea manualmente; una tab en el operator-app simplifica el proceso para testing en laboratorio.

## What Changes

- Nueva tab "Flash Node Mock" en el operator-app
- Wizard: seleccionar puerto USB → DevEUI/AppKey (o generarlos) → flashear firmware de node mock → registrar device en ChirpStack

## Capabilities

### New Capabilities

- `operator-flash-node-mock`: Tab en operator-app para flashear ESP32 como node mock (LoRa sin sensores). Envía payloads con datos sintéticos para testear el pipeline completo.

### Modified Capabilities

- `operator-app`: nueva sección en sidebar.

## Impact

- Solo afecta `operator-app/`
- Firmware de node mock debe estar disponible como Release asset
- No requiere sensores físicos — se puede testear en laboratorio
