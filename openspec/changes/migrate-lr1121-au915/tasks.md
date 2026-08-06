## 0. Preparación y archivado

- [ ] 0.1 Archivar el change `migrate-lorawan-sx1278` como cancelado/supersedido: `openspec archive migrate-lorawan-sx1278` con nota de que es reemplazado por este change. Commit sugerido: `chore(docs): archivar migrate-lorawan-sx1278 supersedido por migrate-lr1121-au915`.
- [ ] 0.2 Verificar disponibilidad de la crate `lorawan-device` en crates.io y confirmar soporte AU915 sub-band mask configurable. Documentar versión en `firmware/Cargo.toml`. No requiere hardware.
- [ ] 0.3 Obtener módulos LR1121 (breakout boards con conector U.FL/SMA) y verificar nivel de tensión SPI (3.3 V compatible con ESP32) con multímetro antes de conectar. Requiere hardware físico.

## 1. Crate lr1121-driver (FFI wrapper)

- [ ] 1.1 Crear `firmware/lr1121-driver/` como crate de biblioteca Rust. Agregar `lr11xx_driver` de Semtech como submódulo git o fuente en `vendor/`. Configurar `build.rs` con `bindgen` para generar bindings del SDK C. No requiere hardware. Commit sugerido: `feat(firmware): crear crate lr1121-driver con bindings FFI del SDK C de Semtech`.
- [ ] 1.2 Implementar `Lr1121::new(spi, pins, config)` e `init()`: reset hardware (pulso en RESET pin), espera BUSY, verificación de versión de chip por SPI (`GetVersion`), configuración de modo LoRa en puerto HF sub-GHz. Requiere hardware LR1121 físico para validar. Commit sugerido: `feat(firmware): implementar init LR1121 con reset y verificación de chip`.
- [ ] 1.3 Implementar `transmit(payload: &[u8])`: configurar frecuencia, SF, BW y potencia; cargar payload en FIFO; ejecutar SetTx; esperar DIO1 (TX_DONE) con timeout. Requiere hardware físico. Commit sugerido: `feat(firmware): implementar transmisión LoRa en lr1121-driver`.
- [ ] 1.4 Implementar `start_rx()` y `read_packet()`: configurar modo RX continuo; esperar DIO1 (RX_DONE); leer payload del FIFO; retornar `RxPacket { payload, rssi_dbm, snr_db }`. Requiere hardware físico. Commit sugerido: `feat(firmware): implementar recepción LoRa en lr1121-driver`.
- [ ] 1.5 Implementar el trait `radio::PhyRxTx` de `lorawan-device` para `Lr1121`. Verificar compilación con los tipos del trait. No requiere hardware físico para compilación; validación funcional en tarea 2.3. Commit sugerido: `feat(firmware): implementar trait PhyRxTx de lorawan-device para LR1121`.

## 2. Firmware del Nodo Sensor (LoRaWAN AU915)

- [ ] 2.1 Actualizar `firmware/sensor-node/Cargo.toml`: reemplazar dependencia LMIC por `lorawan-device` + `lr1121-driver`; agregar configuración de pines para BUSY (GPIO27) y DIO1 (GPIO26). No requiere hardware. Commit sugerido: `feat(firmware): migrar dependencias nodo de LMIC/SX1278 a lorawan-device/LR1121`.
- [ ] 2.2 Reemplazar el bloque de inicialización del radio SX1278 por inicialización de `Lr1121` con el pinout definido en el design (SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, BUSY=27, DIO1=26). Configurar `lorawan-device` con AU915 sub-band 2 (máscara de canales 8–15). Requiere hardware físico. Commit sugerido: `feat(firmware): inicializar LR1121 y stack lorawan-device AU915 en nodo sensor`.
- [ ] 2.3 Implementar flujo de join OTAA: leer DevEUI/AppEUI/AppKey de NVS, iniciar join, manejar JoinAccept y reintentos con backoff exponencial. Validar que ChirpStack registra el dispositivo activo. Requiere hardware físico (nodo + gateway + ChirpStack). Commit sugerido: `feat(firmware): implementar join OTAA AU915 con lorawan-device en nodo sensor`.
- [ ] 2.4 Conectar el ciclo de transmisión existente (payload 14 bytes) al stack `lorawan-device`: construir payload, llamar a `uplink()`, resetear contadores. Verificar que el payload llega a ChirpStack y se puede decodificar. Requiere hardware físico. Commit sugerido: `feat(firmware): transmitir uplink LoRaWAN AU915 desde nodo sensor con LR1121`.
- [ ] 2.5 Verificar comportamiento ante pérdida de cobertura: apagar gateway, confirmar que el nodo sigue leyendo sensores y acumulando pulsos, restaurar gateway y confirmar join y reanudación. Requiere hardware físico. Commit sugerido: `test(firmware): verificar continuidad de lectura ante pérdida de cobertura AU915`.

## 3. Firmware del Gateway (Single-Channel AU915)

- [ ] 3.1 Actualizar `firmware/gateway-node/Cargo.toml`: reemplazar dependencia SX1278 por `lr1121-driver`; mismo pinout que el nodo. Actualizar configuración de canal a 903.9 MHz SF7BW125. No requiere hardware para compilación. Commit sugerido: `feat(gateway): migrar gateway de SX1278/EU433 a LR1121/AU915 903.9 MHz`.
- [ ] 3.2 Reemplazar el bloque de inicialización SX1278 por `Lr1121::new(...).init()` con modo RX continuo en 903.9 MHz SF7BW125. Verificar que el módulo inicia sin errores por serial. Requiere hardware físico. Commit sugerido: `feat(gateway): inicializar LR1121 en modo RX continuo 903.9 MHz en gateway`.
- [ ] 3.3 Verificar que el protocolo Semtech UDP Packet Forwarder funciona sin cambios con el nuevo radio: el gateway recibe un paquete del nodo LR1121 y ChirpStack lo procesa correctamente. Requiere ambos ESP32 físicos y ChirpStack. Commit sugerido: `test(gateway): verificar UDP packet forwarder con LR1121/AU915`.

## 4. Infraestructura (ChirpStack AU915)

- [ ] 4.1 Actualizar `infra/docker-compose.yml`: cambiar variable de band plan de `EU433` → `AU915_AU` en el servicio ChirpStack. Configurar sub-band 2 en la región AU915. Levantar con `docker compose up` y verificar que ChirpStack arranca con band plan AU915. No requiere hardware LoRa. Commit sugerido: `chore(infra): migrar ChirpStack de EU433 a AU915 sub-band 2`.

## 5. Validación de Banco y Rango

- [ ] 5.1 Validar flujo completo en banco (distancia corta): nodo → LoRaWAN AU915 → gateway → ChirpStack → MQTT → FastAPI → InfluxDB. Verificar payload almacenado contra valores leídos por el nodo. Requiere ambos ESP32, ChirpStack y FastAPI corriendo. Commit sugerido: `test(firmware): validar flujo extremo a extremo LoRaWAN AU915 LR1121 en banco`.
- [ ] 5.2 Validar join OTAA exitoso y que ChirpStack registra el dispositivo activo (DevEUI visible en consola ChirpStack, uplinks con FCnt incrementando). Requiere hardware físico.
- [ ] 5.3 Prueba de rango PoC: transmitir paquetes mock desde varios km, verificar RSSI/SNR por serial del gateway y recepción en ChirpStack. Registrar distancia, RSSI y SNR como línea base para el informe. Requiere hardware físico, antenas yagi (nodo) y omnidireccional SMA (gateway), espacio abierto.
- [ ] 5.4 Verificar comportamiento ante pérdida de WiFi del gateway: nodo continúa transmitiendo, gateway registra por serial, reanuda reenvío al restaurar WiFi.

## 6. Documentación

- [ ] 6.1 Actualizar `openspec/config.yaml` (bloque de stack tecnológico): reemplazar SX1278/EU433 por LR1121/AU915, documentar sub-band 2 y canal fijo 903.9 MHz para PoC, actualizar descripción del driver. Commit sugerido: `docs(docs): actualizar config.yaml con stack LR1121 AU915`.
- [ ] 6.2 Actualizar `CLAUDE.md` (sección de arquitectura): reflejar LR1121, AU915, `lorawan-device`, canal fijo 903.9 MHz SF7BW125, crate `lr1121-driver`. Commit sugerido: `docs(docs): actualizar CLAUDE.md con arquitectura LR1121 AU915`.
- [ ] 6.3 Actualizar `hardware/netlist.md`: agregar tabla de pinout LR1121 para nodo sensor (con BUSY GPIO27 y DIO1 GPIO26), antenas recomendadas por rol (yagi 915 MHz para nodo, omnidireccional SMA para gateway). Commit sugerido: `docs(hardware): actualizar netlist con pinout LR1121 y antenas AU915`.
