## Why

El `gateway-mock` de escritorio (Docker) bypasea ChirpStack por completo al publicar directamente al topic MQTT, dejando sin validar la parte más compleja del stack: registro del gateway, device profile EU433, OTAA y descifrado de FRMPayload. Se necesita un mecanismo que ejerza la cadena completa ESP32→WiFi→UDP→ChirpStack→MQTT→Backend→Frontend con un solo ESP32 y sin SX1278, para poder detectar problemas de configuración de ChirpStack antes de conectar hardware LoRa real.

## What Changes

- Nuevo binario `firmware/src/bin/gateway-node-mock.rs`: ESP32 sin SX1278 que conecta a WiFi, genera lecturas sintéticas, construye frames LoRaWAN reales (OTAA join, payload 14 bytes, CRC-8, MIC), los envuelve en RXPK JSON y los envía al ChirpStack Gateway Bridge via el protocolo Semtech UDP (puerto 1700).
- `device_id = 3` para distinguirlo del nodo real (`device_id = 1`) y del `sensor-node-mock` (`device_id = 2`).
- Claves OTAA distintas a los otros dos dispositivos; se registra como tercer device en ChirpStack.
- El gateway EUI se deriva de la MAC WiFi del ESP32 (mismo mecanismo que `gateway-node`).
- No requiere SX1278 ni ningún hardware adicional fuera del ESP32.

## Capabilities

### New Capabilities

- `gateway-node-mock`: firmware ESP32 que simula un gateway LoRaWAN inyectando frames sintéticos directamente en ChirpStack via UDP, sin módulo de radio.

### Modified Capabilities

_(ninguna — no hay cambios de requisitos en capabilities existentes)_

## Impact

- **Firmware** (`firmware/`): nuevo binario y registro en `Cargo.toml`. Sin impacto en `sensor-node`, `sensor-node-mock` ni `gateway-node`.
- **Impacto energético**: pensado para desarrollo en banco conectado a USB. No aplica autonomía por batería.
- **Cambios de formato LoRa / frecuencia de envío**: ninguno. El payload binario de 14 bytes es idéntico al del nodo real; no hay transmisión RF.
- **Rollback**: eliminar `firmware/src/bin/gateway-node-mock.rs` y su entrada en `Cargo.toml`. No hay firmware desplegado en campo; rollback sin impacto operativo.
- **Backend, frontend, Android, 3D, docs**: sin cambios de código. Se requiere registrar un gateway y un tercer device en ChirpStack (documentado en `infra/SETUP.md`).
