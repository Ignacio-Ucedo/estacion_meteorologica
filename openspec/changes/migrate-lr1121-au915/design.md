## Context

El stack de comunicación anterior (SX1278 + LMIC/EU433) queda supersedido. Este change adopta el LR1121 con dos modos de operación distintos según el rol del dispositivo:

- **Nodo sensor**: LR1121 corre **Modem-E v2.1.0** — firmware embebido en el MCU interno del chip que implementa el stack LoRaWAN 1.0.4 certificado. El ESP32 interactúa vía SPI con comandos de alto nivel (join, uplink, configuración de región). No hay stack LoRaWAN en el ESP32.
- **Gateway**: LR1121 en **modo transceiver** (firmware de fábrica) — el ESP32 accede al radio directamente usando el SDK C `lr11xx_driver` (SWDR001) para recepción LoRa raw y reenvío UDP. Modem-E no aplica aquí porque el gateway necesita acceso crudo a la capa física.

Esta separación de roles es la arquitectura habitual en LoRaWAN: los end devices usan stacks certificados, los gateways usan acceso directo al radio.

**Modem-E v2.1.0**: binario disponible en `Lora-net/radio_firmware_images`. Requiere `lr1121_modemE_driver` (SWDR009) como host driver C. El flashing inicial usa la referencia `SWTL001` de Semtech.

---

## Flujo de datos extremo a extremo

```
DHT22 + pluviómetro + anemómetro + ADC batería
        │
   ESP32 nodo sensor (Rust)
   └── lr1121-modem-e (crate Rust: FFI → lr1121_modemE_driver C / SWDR009)
        │  LR1121 corre Modem-E v2.1.0 (LoRaWAN 1.0.4 embebido en chip)
        │  Región AU915, sub-band 2, OTAA
        │  FRMPayload 14 bytes (mismo formato existente)
        │  TX en 903.9 MHz SF7BW125 (canal 8, sub-band 2)
        ▼
   ESP32 gateway (Rust)
   └── lr1121-transceiver (crate Rust: FFI → lr11xx_driver C / SWDR001)
        │  LR1121 en modo transceiver (firmware de fábrica)
        │  Escucha en 903.9 MHz SF7BW125 (canal fijo PoC)
        │  Protocolo Semtech UDP Packet Forwarder (sin cambios de lógica)
        ▼
   ChirpStack v4 (Docker, band plan AU915 sub-band 2)
        │  MQTT: application/{appId}/device/{devEUI}/event/up
        ▼
   FastAPI backend → InfluxDB → Frontend
```

---

## Goals / Non-Goals

**Goals:**
- Nodo sensor: stack LoRaWAN certificado vía Modem-E (sin código LoRaWAN en el ESP32).
- Gateway: acceso raw al radio LR1121 para recepción en AU915 canal fijo.
- Habilitar AU915 en ChirpStack (reemplaza EU433).
- Mantener el formato de payload binario de 14 bytes sin cambios.

**Non-Goals:**
- Soporte multi-canal en el gateway (sigue siendo single-channel, limitación de PoC documentada).
- Usar LR-FHSS o el puerto 2.4 GHz del LR1121.
- Implementar downlinks desde ChirpStack al nodo (no requerido para PoC).
- Migrar a gateway hardware dedicado.
- Cambiar el formato de payload (eso es responsabilidad de `veleta-wind-direction`).

---

## Decisions

### D1 — Driver nodo sensor: Modem-E (Path primario)

El LR1121 del nodo corre el firmware **Modem-E v2.1.0** (binario Semtech). El ESP32 usa el host driver C `lr1121_modemE_driver` (SWDR009) vía FFI (`bindgen`). La interfaz expuesta por Modem-E al host es de alto nivel:
- `lr1121_modem_lorawan_set_region(AU915)` + `lr1121_modem_lorawan_set_enabled_channels(sub-band 2 mask)`
- `lr1121_modem_lorawan_set_join_eui()` / `lr1121_modem_lorawan_set_dev_eui()` / `lr1121_modem_lorawan_set_app_key()`
- `lr1121_modem_lorawan_join()` → espera evento `JOINED` por DIO9/IRQ
- `lr1121_modem_lorawan_request_uplink(payload, len)` → espera evento `TX_DONE`

El ESP32 implementa el HAL SPI de 4 funciones que SWDR009 requiere: `write`, `read`, `write_read` y `reset`. Esto es significativamente más simple que implementar un driver transceiver completo.

**Por qué Modem-E sobre lorawan-device + FFI transceiver (Path alternativo):**
- Modem-E es LoRaWAN 1.0.4 certificado — relevante para un producto comercial.
- Elimina el stack LoRaWAN del ESP32; el ESP32 es solo orquestador de sensores y comandos.
- Menor superficie de bugs en la capa más crítica (protocolo de red).
- El `lr1121_modemE_driver` C tiene una API más pequeña y estable que el driver transceiver full.

**Fallback documentado (Path A)**: si Modem-E presenta incompatibilidades con ChirpStack/AU915 en la práctica, se puede revertir al transceiver driver (SWDR001) + `lorawan-device` implementando `PhyRxTx`. El mismo pinout es compatible.

### D2 — Driver gateway: transceiver SWDR001

El LR1121 del gateway corre en modo transceiver estándar. Se crea un crate `lr1121-transceiver` con FFI sobre `lr11xx_driver` (SWDR001, activo, última actualización octubre 2025). El gateway solo necesita: `init`, `set_rx_config(903.9 MHz, SF7, BW125)`, `start_rx_continuous()`, `get_rx_payload() → (buf, rssi, snr)`.

**Por qué no Modem-E en el gateway**: Modem-E es un stack para end devices LoRaWAN (OTAA, uplinks, downlinks). Un gateway necesita acceso crudo a la capa física para capturar cualquier trama LoRa y reenviarla sin procesamiento de protocolo. No existe un modo "gateway" en Modem-E.

### D3 — Canal fijo AU915 sub-band 2 para PoC

AU915 define 64 canales upstream 125 kHz (902.3–914.9 MHz) + 8 canales 500 kHz + 8 downstream. Para el gateway single-channel de la PoC se usa el canal 8 de sub-band 2: **903.9 MHz SF7BW125** — el primero del sub-band 2, más compatible con gateways AU915 comerciales (RAK, Dragino). Modem-E se configura con la máscara de sub-band 2 (canales 8–15 habilitados). ChirpStack se configura con sub-band 2 únicamente.

### D4 — Pinout SPI LR1121 en ESP32

El LR1121 usa comandos SPI de 2 bytes de opcode + busy pin obligatorio (ausente en SX1278). Mismo pinout para nodo y gateway:

| Señal | GPIO | Nota |
|-------|------|------|
| SCK | 18 | Igual que SX1278 |
| MISO | 19 | Igual que SX1278 |
| MOSI | 23 | Igual que SX1278 |
| NSS/CS | 5 | Igual que SX1278 |
| RESET | 14 | Igual que SX1278 |
| BUSY | 27 | **Nuevo** — GPIO libre en ESP32 |
| DIO1/IRQ | 26 | Reusa DIO0 de SX1278; en Modem-E es el pin de eventos del host |

La validación contra ESP32-S3 queda en el change `gateway-esp32s3-target`.

### D5 — Antenas

| Dispositivo | Antena | Conector |
|-------------|--------|----------|
| Nodo sensor | Yagi 915 MHz (≥ 9 dBi) | U.FL en breakout LR1121 → pigtail SMA |
| Gateway | Omnidireccional 915 MHz (2–5 dBi) | SMA hembra |

Breakout boards LR1121 comerciales (ej. Waveshare Core1121, Seeed Wio-LR1121) incluyen conector U.FL + adaptador SMA.

---

## Flashing del firmware Modem-E en el nodo

El LR1121 del nodo necesita el firmware Modem-E v2.1.0 flashed una única vez antes de operar. Proceso:

1. Descargar binario `lr1121_modem_v2.1.0.bin` de `Lora-net/radio_firmware_images`.
2. Usar la referencia `SWTL001` de Semtech (implementación de upgrade por SPI desde el host ESP32) para escribir el binario al LR1121.
3. Verificar versión post-flash con el comando `lr1121_modem_get_version()`.

Este es un paso de inicialización de hardware, no parte del ciclo de firmware habitual.

---

## Manejo de errores y reconexiones

| Escenario | Comportamiento |
|-----------|---------------|
| Modem-E: join OTAA falla | Modem-E reintenta internamente con backoff; el ESP32 continúa leyendo sensores y acumulando pulsos mientras espera el evento `JOINED` |
| Modem-E: uplink falla | Modem-E reintenta según política AU915; el ESP32 registra el error por serial al recibir evento `TX_DONE` con status de error |
| Gateway pierde WiFi | Continúa recibiendo LoRa raw, registra por serial; descarta paquetes (sin buffer persistente); reanuda UDP al restaurar WiFi |
| BUSY pin no baja en timeout | Reset hardware del módulo LR1121; registrar por serial; en Modem-E esto activa el fallback de reinicio del stack |
| Modem-E no arranca tras flash | Verificar integridad del binario (MD5 incluido en repo); re-flashear |

---

## Infraestructura: cambios en ChirpStack

`infra/docker-compose.yml`: variable de band plan `EU433` → `AU915_AU`. Configurar sub-band 2 en la región AU915 del network server. DevEUI, AppEUI y AppKey en NVS del ESP32 se mantienen — las credenciales OTAA son independientes de la frecuencia RF.

---

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| Modem-E v2.1.0 tiene bugs en AU915 sub-band mask | Validar con ejemplo `simple_lorawan` de SWSD022 antes de integrar; fallback a Path A (SWDR001 + `lorawan-device`) |
| FFI sobre SWDR009: API puede cambiar entre versiones del driver | Pinear versión exacta del driver C en el crate; documentar versión usada |
| LR1121 requiere flashing previo de Modem-E (dependencia de hardware extra) | SWTL001 es la referencia oficial; el proceso está documentado y es reproducible |
| LR1121 a 3.3 V SPI: validar con el breakout board específico adquirido | Confirmar con datasheet del breakout; el LR1121 soporta 1.8 V y 3.3 V SPI natively |
| `lora-phy` no soporta LR1121 (confirmado) | No se usa `lora-phy`; el Path A usa `lorawan-device` + `PhyRxTx` manual, el Path primario usa Modem-E directamente |
| Gateway (SWDR001 transceiver) es más complejo de implementar que el nodo Modem-E | El gateway es el componente más crítico — priorizar banco de pruebas con señal de referencia antes de la prueba de rango |
