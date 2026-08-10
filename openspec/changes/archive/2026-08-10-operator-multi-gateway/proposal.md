## Why

Hoy el operator-app solo soporta un gateway virtual a la vez. Para testear múltiples usuarios simultáneamente (cada uno con su propio DevEUI/estación) es necesario correr varios gateways virtuales en paralelo desde una sola instancia de operator-app.

## What Changes

- La tab "Gateway Virtual" pasa a mostrar una lista de gateways activos, uno por DevEUI
- Cada gateway tiene su propio estado (running/stopped/error), log y usuario asignado
- Acciones por gateway: iniciar, detener, eliminar
- En Rust: `AppState` pasa de un único `GatewayState` a un `HashMap<DevEUI, GatewayHandle>`
- Eventos `gateway_log` y `gateway_status` incluyen `dev_eui` para identificar origen

## Capabilities

### New Capabilities

- `operator-multi-gateway`: Soporte para múltiples gateways virtuales simultáneos en operator-app.

### Modified Capabilities

- `operator-app`: rediseño de la tab Gateway Virtual; cambios en AppState de Rust.

## Impact

- Cambios breaking en los comandos Tauri: `start_gateway`, `stop_gateway`, `get_gateway_status` pasan a recibir `dev_eui`
- Los eventos Tauri (`gateway_log`, `gateway_status`) agregan campo `dev_eui`
- No afecta backend ni frontend
