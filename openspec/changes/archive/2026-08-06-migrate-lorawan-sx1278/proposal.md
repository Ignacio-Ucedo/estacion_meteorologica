## Why

El spike de firmware validó el hardware (ESP32 + SX1278 a 433 MHz) usando LoRa P2P con payload CSV de depuración. Esta arquitectura no escala a múltiples nodos, carece de protocolo de red estandarizado y requiere que el gateway reenvíe directamente al backend sin ninguna capa de network server. Adoptar LoRaWAN con topología estrella sobre el hardware SX1278 existente (band plan EU433, 433.175–434.665 MHz) provee escalabilidad, protocolo estándar y reutiliza completamente el hardware validado en el spike, sin costo adicional de hardware.

## What Changes

- **BREAKING** — Protocolo de comunicación: LoRa P2P → LoRaWAN con activación OTAA y band plan EU433 (433.175–434.665 MHz, SF7BW125). El hardware SX1278 **no cambia**.
- **BREAKING** — Formato de payload: CSV de depuración (`id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento`) → payload binario de 14 bytes de campos fijos, encapsulado como FRMPayload de trama LoRaWAN.
- Firmware del nodo sensor: incorpora stack LoRaWAN (LMIC portado a ESP-IDF) configurado para EU433, registro OTAA con DevEUI/AppEUI/AppKey en NVS, serialización binaria del payload.
- Gateway: reemplaza receptor LoRa P2P simple por single-channel UDP packet forwarder en el canal 433.175 MHz SF7BW125, compatible con el protocolo Semtech UDP hacia ChirpStack. **Limitación de prototipo documentada**: un canal fijo vs. los 3 canales del estándar EU433 compliant; suficiente para un único nodo en canal fijo.
- Backend (FastAPI): reemplaza endpoint HTTPS directo desde gateway por integración con ChirpStack vía suscripción MQTT.
- Infraestructura nueva: ChirpStack network server (Docker, self-hosted) como pieza intermedia obligatoria entre gateway y backend.
- Documentación: actualización de `openspec/config.yaml` (bloque de stack tecnológico) y `CLAUDE.md` (sección de arquitectura) para reflejar el stack real con LoRaWAN y la decisión de mantener SX1278/EU433.

## Capabilities

### New Capabilities

- `lorawan-node`: stack LoRaWAN en el nodo sensor ESP32 — activación OTAA, payload binario de campos fijos, band plan EU433, duty cycle respetado, hardware SX1278 existente.
- `lorawan-gateway`: gateway ESP32 + SX1278 operando como single-channel UDP packet forwarder hacia ChirpStack en 433.175 MHz SF7BW125, con reconexión automática ante caída de WiFi. Limitación de prototipo documentada.

### Modified Capabilities

_(ninguna — no hay specs principales en `openspec/specs/` que cubran comunicación LoRa; el spike usa una spec de cambio temporal que queda supersedida por este cambio)_

## Impact

- **Firmware** (`firmware/`): reemplaza el bloque de comunicación LoRa P2P del spike; las tareas de sensores físicos (DHT22, pluviómetro, anemómetro) siguen siendo válidas y reutilizables. Impacto energético: el join OTAA agrega ~1–2 s de TX en el primer arranque; en operación normal el consumo es equivalente a P2P. El duty cycle de EU433 (1% global) no impacta al intervalo de envío de 10 minutos planificado.
- **Gateway** (`gateway/`): código nuevo; el receptor simple del spike queda obsoleto.
- **Backend** (`backend/`): la ingesta desde ChirpStack es responsabilidad del change `backend-lorawan-ingestion` (desarrollador separado). Este change no toca el directorio `backend/`.
- **Infraestructura**: ChirpStack pasa a ser requisito del entorno de desarrollo y producción (Docker Compose).
- **Docs**: `CLAUDE.md` y `openspec/config.yaml` deben actualizarse para reflejar el stack real.
- **Rollback**: el firmware P2P del spike permanece en la rama `spike-firmware-lora-sensors`. No hay firmware desplegado en campo; el rollback es flashear esa versión.
