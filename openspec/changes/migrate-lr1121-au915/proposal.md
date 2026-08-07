## Why

Los módulos SX1278 disponibles no tienen conector pigtail para antena externa, y no se consiguen antenas yagi para 433 MHz en Argentina a nivel comercial. El LR1121 resuelve ambos problemas: opera en AU915 (915–928 MHz), la banda LoRaWAN regulatoria de Argentina (ENACOM) con ecosistema de antenas maduro (yagi, omnidireccional SMA estándar), y sus breakout boards comerciales incluyen conector U.FL/SMA. Para un producto comercial, operar en AU915 es la decisión correcta y evita rehacer el hardware al escalar.

## What Changes

- **BREAKING** — Hardware de RF: SX1278 (433 MHz) → LR1121 (sub-GHz HF port, 915–928 MHz AU915). Aplica tanto al nodo sensor como al gateway.
- **BREAKING** — Band plan LoRaWAN: EU433 → AU915 (915–928 MHz). Cambia configuración de ChirpStack, stack LoRaWAN en firmware del nodo y configuración de canal en gateway.
- **BREAKING** — Driver de radio: el stack LMIC configurado para SX1278/EU433 es reemplazado por un driver LR1121 sobre el SDK C oficial de Semtech (`lr11xx_driver`), expuesto a Rust vía FFI, con la crate `lorawan-device` para el stack LoRaWAN AU915.
- El formato binario del payload (14 bytes, estructura fija) **no cambia** — solo el transporte RF. El campo `bateria_mv` usa rango correcto 0–15 000 mV (corregido en fix previo).
- Nodo sensor (firmware): reemplazar bloque SX1278+LMIC por LR1121+lorawan-device, configurar AU915 sub-band 2 (canal fijo para PoC single-channel).
- Gateway (firmware): reemplazar SX1278 listener por LR1121 en modo recepción AU915, mantener protocolo Semtech UDP Packet Forwarder hacia ChirpStack sin cambios de lógica.
- Infraestructura: reconfigurar ChirpStack de EU433 → AU915 en `infra/docker-compose.yml` y configuración del network server.
- Change `migrate-lorawan-sx1278` queda **supersedido** y debe archivarse como cancelado — el código implementado para SX1278 no es reutilizable para LR1121.
- Documentación: actualizar `openspec/config.yaml`, `CLAUDE.md` y `hardware/netlist.md` con el nuevo stack de hardware.

## Capabilities

### New Capabilities

- `lr1121-driver`: driver Rust para LR1121 sobre `lr11xx_driver` C SDK de Semtech vía FFI (`esp-idf-sys` binding), expone primitivas de TX/RX LoRa para el firmware del nodo y del gateway.
- `lorawan-node-au915`: stack LoRaWAN AU915 en el nodo sensor — activación OTAA, payload binario de 14 bytes, duty cycle AU915, hardware LR1121. Reemplaza y supersede la spec `lorawan-node` del change `migrate-lorawan-sx1278`.
- `lorawan-gateway-au915`: gateway single-channel UDP packet forwarder para AU915 con LR1121, protocolo Semtech UDP hacia ChirpStack. Reemplaza y supersede `lorawan-gateway` de `migrate-lorawan-sx1278`.

### Modified Capabilities

_(ninguna — `lorawan-node` y `lorawan-gateway` están solo en delta specs del change `migrate-lorawan-sx1278` que se archiva; no existen en `openspec/specs/` aún)_

## Impact

- **Firmware** (`firmware/`): reemplazo completo del bloque de comunicación LoRa; sensores (DHT22, pluviómetro, anemómetro, batería ADC) no se tocan — sus changes (`firmware-sensor-drivers`) siguen vigentes.
- **Gateway** (`gateway/`): reemplazo del bloque SX1278; la lógica UDP Packet Forwarder se conserva sin cambios.
- **Infraestructura** (`infra/`): cambio de band plan en ChirpStack — solo configuración, no código.
- **Cambios de hardware que NO cambian**: `gateway-esp32s3-target` sigue siendo válido (la migración a ESP32-S3 es independiente del módulo de radio; el pinout SPI del LR1121 deberá validarse contra el S3 como parte de ese change). `veleta-wind-direction` sigue vigente (payload y sensores no cambian).
- **Impacto energético (firmware)**: el LR1121 tiene consumo TX comparable al SX1278 (~120 mA); el consumo en RX es algo menor. Sin impacto material en el presupuesto de batería del nodo.
- **Rollback**: no hay firmware desplegado en campo. Rollback = mantener SX1278 y `migrate-lorawan-sx1278` sin archivar. Requiere recompra/retención de módulos SX1278.
