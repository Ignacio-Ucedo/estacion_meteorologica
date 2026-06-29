## Why

La arquitectura actual usa LoRa P2P (sin protocolo de red) con módulos SX1278 a 433 MHz y un payload CSV de depuración, lo que no escala a múltiples nodos, no es interoperable con infraestructura estándar y utiliza hardware incompatible con el plan de frecuencias LoRaWAN vigente en Argentina (AU915). Adoptar LoRaWAN con módulos SX1276 permite una arquitectura correcta, escalable y con hardware reutilizable a futuro, a un costo marginal insignificante (~USD 2 por módulo adicional).

## What Changes

- **BREAKING** — Reemplazo de hardware RF: SX1278 (433 MHz, max 525 MHz) por SX1276 (137–1020 MHz, soporta AU915).
- **BREAKING** — Protocolo de comunicación: LoRa P2P → LoRaWAN con activación OTAA y band plan AU915 (902–928 MHz).
- **BREAKING** — Formato de payload: CSV de depuración (`id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento`) → payload binario de campos fijos encapsulado en trama LoRaWAN (FRMPayload).
- Firmware del nodo sensor: incorpora stack LoRaWAN (LMIC portado a ESP-IDF), registro OTAA con DevEUI/AppEUI/AppKey, serialización binaria del payload.
- Gateway: reemplaza receptor LoRa simple por single-channel UDP packet forwarder compatible con el protocolo Semtech UDP hacia ChirpStack. Limitación de prototipo documentada: 1 canal vs. 8 canales del estándar LoRaWAN compliant.
- Backend (FastAPI): reemplaza endpoint HTTPS directo desde gateway por integración con ChirpStack vía MQTT o HTTP webhook.
- Infraestructura nueva: ChirpStack network server (Docker, self-hosted) como pieza intermedia obligatoria entre gateway y backend.
- Documentación: actualización de `openspec/config.yaml` (bloque de stack tecnológico), `CLAUDE.md` (sección de arquitectura), y specs del spike existente donde se referencia LoRa P2P y SX1278.

## Capabilities

### New Capabilities

- `lorawan-node`: stack LoRaWAN en el nodo sensor ESP32 — activación OTAA, payload binario de campos fijos, band plan AU915, duty cycle respetado.
- `lorawan-gateway`: gateway ESP32 operando como single-channel UDP packet forwarder hacia ChirpStack, con reconexión automática ante caída de WiFi y buffering local de paquetes durante outages.
- `lorawan-backend-integration`: integración de FastAPI con ChirpStack mediante MQTT o HTTP webhook para ingesta de lecturas de la estación.

### Modified Capabilities

_(ninguna — no hay specs principales en `openspec/specs/` que cubran comunicación LoRa; el spike usa una spec de cambio temporal que queda supersedida por este cambio)_

## Impact

- **Firmware** (`firmware/`): reemplaza bloque de comunicación LoRa del spike; las tareas de sensores físicos del spike (DHT22, pluviómetro, anemómetro) siguen siendo válidas y reutilizables.
- **Gateway** (`gateway/`): código nuevo; el receptor simple del spike queda obsoleto.
- **Backend** (`backend/`): nuevo endpoint de ingesta vía ChirpStack; el endpoint HTTPS directo del spike queda obsoleto.
- **Infraestructura**: ChirpStack pasa a ser requisito del entorno de desarrollo y producción (Docker Compose).
- **Docs**: `CLAUDE.md` y `openspec/config.yaml` deben actualizarse para reflejar el stack real.
- **Impacto energético**: el join OTAA agrega ~1–2 s de TX en el primer arranque; en operación normal el consumo es equivalente a P2P. El duty cycle de AU915 (1% por sub-banda) no impacta al intervalo de envío de 5–10 minutos planificado.
- **Rollback**: el firmware P2P del spike permanece en la rama `spike-firmware-lora-sensors`. No hay firmware desplegado en campo; el rollback es flashear esa versión.
