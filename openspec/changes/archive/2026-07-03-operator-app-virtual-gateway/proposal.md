## Why

Sin un ESP32 físico, ningún integrante del grupo puede generar datos reales en el pipeline ChirpStack → backend → frontend, lo que bloquea el desarrollo y verificación del dashboard. Se necesita un modo de operación completamente software que simule el gateway de hardware y permita al operario verificar que toda la infraestructura funciona antes de tener o conectar hardware real.

## What Changes

- Nueva sección "Gateway Virtual" en la Operator App (Tauri), accesible desde la barra lateral junto al wizard de flash
- Backend Rust de Tauri incorpora una tarea tokio que implementa el protocolo Semtech UDP Packet Forwarder y la lógica OTAA, basada en la implementación existente de `firmware/src/bin/gateway-node-mock.rs`
- La UI permite al operario iniciar/detener el gateway virtual, configurar el host ChirpStack y el intervalo de envío, y ver un log en tiempo real de los eventos

## Capabilities

### New Capabilities

- `operator-app`: Aplicación Tauri standalone para el operario. Este change introduce el scaffold inicial (sección "Gateway Virtual") con la estructura de navegación lateral que luego usarán otras secciones (flash wizard, setup de ChirpStack, etc.).
- `operator-app-virtual-gateway`: Gateway sintético en software embebido en la Operator App. Implementa el protocolo Semtech UDP Packet Forwarder, OTAA con ChirpStack, generación de lecturas sintéticas con variación aleatoria, y envío periódico de uplinks LoRaWAN. Permite al operario verificar el pipeline completo sin hardware ESP32.

### Modified Capabilities

## Impact

- Nuevo componente `operator-app/` en la raíz del repo (Tauri + React + TypeScript), comparte estructura con el change `operator-flash-app` — si ese change ya inició el scaffold, este change lo extiende; si no, este change crea el scaffold mínimo necesario
- Dependencia nueva: crates Rust `tokio`, `lorawan` (o implementación manual de frames LoRaWAN), `aes` para crypto OTAA, `udp` stdlib
- No modifica firmware, backend, frontend ni ChirpStack; actúa como cliente UDP del gateway forwarder protocol igual que haría un ESP32 real
- No hay impacto en el formato del payload LoRaWAN ni en la configuración de ChirpStack: el virtual gateway usa exactamente las mismas OTAA keys y AppEUI que un dispositivo real registrado
- Sin impacto en batería/energía (corre en PC, no en ESP32)
