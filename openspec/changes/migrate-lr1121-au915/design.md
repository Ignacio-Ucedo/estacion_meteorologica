## Context

El stack de comunicación actual (implementado en `migrate-lorawan-sx1278`, 16/20 tareas) usa SX1278 con el stack LMIC configurado para EU433. Ese change queda supersedido por este.

El LR1121 es un transceiver multi-banda de Semtech (familia LR11xx): puerto sub-GHz HF (400–960 MHz) y puerto 2.4 GHz. Soporta LoRa, GFSK, LoRaWAN y LR-FHSS nativamente. Semtech mantiene un SDK C oficial (`lr11xx_driver`) y la LoRa Basics Modem SDK. La diferencia crítica con SX1278 es el protocolo SPI: el LR1121 usa comandos de opcode de 2 bytes con busy pin obligatorio, completamente distinto al registro map del SX1278.

---

## Flujo de datos extremo a extremo

```
DHT22 + pluviómetro + anemómetro + ADC batería
        │
   ESP32 nodo sensor (Rust)
   └── lr1121-driver (FFI → lr11xx_driver C)
        │  LoRaWAN AU915 — canal fijo para PoC
        │  Sub-band 2: TX en 903.9 MHz SF7BW125 (canal 8)
        │  FRMPayload 14 bytes (mismo formato existente)
        │  OTAA con ChirpStack (DevEUI/AppEUI/AppKey en NVS)
        ▼
   ESP32 gateway (Rust)
   └── lr1121-driver (mismo crate, modo RX)
        │  Escucha en 903.9 MHz SF7BW125 (canal fijo PoC)
        │  Protocolo Semtech UDP Packet Forwarder (sin cambios)
        ▼
   ChirpStack v4 (Docker, band plan AU915 sub-band 2)
        │  MQTT: application/{appId}/device/{devEUI}/event/up
        ▼
   FastAPI backend → InfluxDB → Frontend
```

---

## Goals / Non-Goals

**Goals:**
- Reemplazar el driver SX1278+LMIC por LR1121 en nodo y gateway, manteniendo la misma arquitectura LoRaWAN y el mismo formato de payload de 14 bytes.
- Habilitar AU915 como band plan (reemplaza EU433 en firmware y ChirpStack).
- Para la PoC de rango: operar en canal fijo AU915 sub-band 2, canal 8 (903.9 MHz SF7BW125) — compatible con gateway single-channel.
- Producir un crate Rust `lr1121-driver` reutilizable para nodo y gateway.

**Non-Goals:**
- Implementar soporte multi-canal en el gateway (sigue siendo single-channel, limitación de PoC documentada).
- Usar LR-FHSS o el puerto 2.4 GHz del LR1121.
- Migrar a un gateway hardware dedicado (RAK, Dragino, etc.).
- Cambiar el formato de payload binario (eso es responsabilidad de `veleta-wind-direction`).
- Implementar downlinks desde ChirpStack al nodo (no requerido para PoC).

---

## Decisions

### D1 — Driver LR1121: FFI sobre SDK C de Semtech

El ecosistema Rust/esp-rs no tiene un crate maduro para LR1121 a la fecha. Se creará un crate `lr1121-driver` en Rust que envuelve `lr11xx_driver` de Semtech vía `bindgen`/`esp-idf-sys` (el mismo patrón que ya usa el proyecto con `esp-idf-hal`). El SDK C de Semtech es la referencia oficial y más completa para el LR1121.

**Alternativa descartada**: implementar un driver Rust puro desde el datasheet. Viable pero costoso en tiempo; el FFI wrapper es defendible en un proyecto comercial y más mantenible a largo plazo.

### D2 — Stack LoRaWAN: crate `lorawan-device`

Para el nodo sensor, se usa la crate `lorawan-device` (embedded-lora ecosystem) que provee el stack LoRaWAN v1.0.x radio-agnóstico. Se implementa el trait `radio::PhyRxTx` para el LR1121. Esto reemplaza LMIC, que era una dependencia C portada con poca adopción en el ecosistema esp-rs.

**Alternativa evaluada**: Semtech LoRa Basics Modem SDK (C) vía FFI. Incluye el stack LoRaWAN completo integrado con LR1121, pero añade una capa C adicional más opaca. Se prefiere `lorawan-device` para mantener el control en Rust.

### D3 — Canal fijo AU915 sub-band 2 para PoC

AU915 define 64 canales upstream (902.3–914.9 MHz, 200 kHz spacing) + 8 canales upstream 500 kHz + 8 canales downstream. Para el gateway single-channel de la PoC, se fija el canal 8 de sub-band 2: **903.9 MHz SF7BW125**. Este canal es el primero del sub-band 2, el más usado por gateways AU915 comerciales (RAK, Dragino). ChirpStack se configura con sub-band 2 únicamente.

### D4 — Pinout SPI LR1121 en ESP32

El LR1121 requiere SPI + BUSY pin (señal obligatoria ausente en SX1278). Pinout propuesto para nodo sensor (ESP32 clásico, sin conflicto con sensores existentes):

| Señal | GPIO | Nota |
|-------|------|------|
| SCK | 18 | Igual que SX1278 |
| MISO | 19 | Igual que SX1278 |
| MOSI | 23 | Igual que SX1278 |
| NSS/CS | 5 | Igual que SX1278 |
| RESET | 14 | Igual que SX1278 |
| BUSY | 27 | **Nuevo** — GPIO libre en ESP32 |
| DIO1/IRQ | 26 | Reusa DIO0 de SX1278; LR1121 usa DIO1 como IRQ principal |

Para el gateway, mismo pinout (también ESP32 clásico en PoC). La validación contra ESP32-S3 queda en el change `gateway-esp32s3-target`.

### D5 — Antenas

| Dispositivo | Antena | Conector |
|-------------|--------|----------|
| Nodo sensor | Yagi 915 MHz (≥ 9 dBi) | SMA hembra en breakout LR1121 → pigtail SMA |
| Gateway | Omnidireccional 915 MHz (2–5 dBi) | SMA hembra |

Breakout boards LR1121 comerciales incluyen conector U.FL + adaptador SMA — esto resuelve el problema de pigtail del SX1278.

---

## Manejo de errores y reconexiones

| Escenario | Comportamiento |
|-----------|---------------|
| Join OTAA falla (gateway sin WiFi o fuera de rango) | Reintento con backoff exponencial; sensor sigue leyendo y acumulando pulsos |
| Uplink falla tras join exitoso | LMIC/lorawan-device reintenta según política AU915; nodo continúa ciclo |
| Gateway pierde WiFi | Sigue recibiendo LoRa, registra por serial; buffer en RAM (no persistente); reanuda UDP al restaurar WiFi |
| BUSY pin no baja (LR1121 no responde) | Timeout + reset hardware del módulo; registrar error por serial |

---

## Infraestructura: cambios en ChirpStack

`infra/docker-compose.yml` actualiza la variable de band plan de `EU433` → `AU915_AU` en el servicio `chirpstack`. No se modifica la estructura del Compose. El gateway EUI, DevEUI, AppEUI y AppKey en NVS del ESP32 se mantienen (LoRaWAN OTAA no depende de la frecuencia RF para las claves).

---

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| `lorawan-device` no tiene soporte AU915 completo o tiene bugs en sub-band mask | Verificar en la crate antes de implementar; fallback a Basics Modem SDK si necesario |
| Breakgen FFI: `lr11xx_driver` C puede cambiar de API | Pinear versión exacta del SDK en el crate; documentar versión usada |
| LR1121 breakout boards no verificados con ESP32 a 3.3 V SPI | El LR1121 opera a 1.8 V/3.3 V SPI (confirmado en datasheet); validar en banco antes de soldar |
| BUSY pin timeout difícil de debuggear sin osciloscopio | Agregar logging de duración de BUSY en el driver para detectar deadlocks por serial |
| Costo de rehacer código de migrate-lorawan-sx1278 | La arquitectura (OTAA, payload, UDP forwarder, ChirpStack) se preserva — solo cambia la capa de radio |
