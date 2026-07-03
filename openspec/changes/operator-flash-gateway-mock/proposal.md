## Why

El gateway mock (ESP32 + SX1278 corriendo el firmware de gateway virtual, pero en hardware real) hoy se flashea a mano desde la terminal. Tener una tab en el operator-app que lo haga reduce la fricción para el técnico que provisiona hardware.

## What Changes

- Nueva tab "Flash Gateway Mock" en el operator-app (inicialmente marcada como en desarrollo)
- Wizard mínimo: seleccionar puerto USB → elegir versión de firmware → flashear vía `esptool` embebido o sidecar
- Configurar OTAA keys y ChirpStack host en el NVS al momento del flash (igual que el wizard de provisioning)

## Capabilities

### New Capabilities

- `operator-flash-gateway-mock`: Tab en operator-app para flashear ESP32 como gateway mock. Incluye detección de puerto USB, selección de versión de firmware precompilado, escritura de NVS y registro del gateway en ChirpStack.

### Modified Capabilities

- `operator-app`: nueva sección en sidebar.

## Impact

- Solo afecta `operator-app/`
- Requiere firmware de gateway compilado y publicado como Release asset (ver change `firmware-ci-release` en `operator-flash-app`)
- No modifica backend ni frontend
