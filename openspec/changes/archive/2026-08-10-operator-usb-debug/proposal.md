## Why

Debuggear un node o gateway hoy requiere abrir una terminal con `minicom` o `esptool` y saber interpretar los logs en crudo. Una tab de monitoring USB en operator-app centraliza el debug: seleccionás el puerto, ves los logs formateados en tiempo real y podés filtrar por nivel.

## What Changes

- Nueva tab "Debug USB" en el operator-app
- Selector de puerto serial (auto-detecta puertos disponibles)
- Viewer de logs en tiempo real con filtro por nivel (INFO/WARN/ERROR) y búsqueda
- Soporte para nodes y gateways (misma UI, distinto firmware)
- Opcionalmente: botón de reset del dispositivo vía DTR/RTS

## Capabilities

### New Capabilities

- `operator-usb-debug`: Tab en operator-app para monitorear por USB cualquier ESP32 (node o gateway) en tiempo real. Lee el puerto serial y muestra logs formateados.

### Modified Capabilities

- `operator-app`: nueva sección en sidebar.

## Impact

- Solo afecta `operator-app/`
- Requiere acceso al puerto serial desde Tauri (plugin `tauri-plugin-serialport` o implementación Rust con `serialport` crate)
- No requiere hardware específico — funciona con cualquier ESP32 conectado por USB
