## Why

El gateway real (hardware dedicado, distinto del ESP32 de desarrollo) necesita su propio wizard de flash porque la partición NVS, los parámetros de red y el registro en ChirpStack difieren del gateway mock.

## What Changes

- Nueva tab "Flash Gateway Real" en el operator-app
- Wizard: seleccionar puerto USB → parámetros de red (WiFi SSID/pass, ChirpStack host) → flashear firmware de gateway production → registrar en ChirpStack

## Capabilities

### New Capabilities

- `operator-flash-gateway-real`: Tab en operator-app para flashear el gateway de producción. Distinto del mock en que configura credenciales WiFi reales y apunta a ChirpStack de campo.

### Modified Capabilities

- `operator-app`: nueva sección en sidebar.

## Impact

- Solo afecta `operator-app/`
- Depende de tener firmware de gateway production compilado (change `migrate-lorawan-sx1278` debe estar completo)
- Requiere hardware gateway real disponible para pruebas de campo
