## 0. Preparación

- [x] 0.1 Archivar el change `migrate-lorawan-sx1278` como cancelado/supersedido. Commit sugerido: `chore(docs): archivar migrate-lorawan-sx1278 supersedido por migrate-lr1121-au915`. *(Ya completado — incluido en commit de propuesta)*
- [ ] 0.2 Obtener módulos LR1121 (breakout boards con conector U.FL/SMA, ej. Waveshare Core1121 o Seeed Wio-LR1121). Verificar tensión SPI 3.3 V compatible con ESP32 antes de conectar. Requiere hardware físico.
- [x] 0.3 Descargar firmware Modem-E v2.1.0 (`lr1121_modem_v2.1.0.bin`) de `Lora-net/radio_firmware_images` y driver host SWDR009 (`lr1121_modemE_driver`). Verificar integridad con MD5 incluido. No requiere hardware.
- [ ] 0.4 Clonar `SWTL001` (referencia de flashing SPI de Semtech) y compilar el flasher para ESP32. Documentar el procedimiento en `hardware/flashing-modem-e.md`. Requiere ESP32 + módulo LR1121 físico.

## 1. Flash del firmware Modem-E en el nodo sensor

- [ ] 1.1 Flashear Modem-E v2.1.0 al LR1121 del nodo usando `SWTL001` desde el ESP32 host. Verificar versión post-flash con `lr1121_modem_get_version()` por serial. Requiere hardware físico. Commit sugerido: `chore(hardware): documentar procedimiento de flash Modem-E v2.1.0 en LR1121`.

## 2. Crate lr1121-modem-e (host driver para nodo sensor)

- [x] 2.1 Crear `firmware/lr1121-modem-e/` como crate biblioteca Rust. Agregar `lr1121_modemE_driver` (SWDR009) como fuente en `vendor/`. Configurar `build.rs` con `bindgen` para generar bindings del SDK C. No requiere hardware. Commit sugerido: `feat(firmware): crear crate lr1121-modem-e con bindings FFI de SWDR009`.
- [ ] 2.2 Implementar el HAL SPI que SWDR009 requiere: las 4 funciones `write`, `read`, `write_read` y `reset` sobre `esp-idf-hal` SPI. Validar con un comando simple (`get_version`) que el chip responde correctamente. Requiere hardware físico con Modem-E flashed. Commit sugerido: `feat(firmware): implementar HAL SPI para lr1121-modem-e sobre esp-idf-hal`.
- [ ] 2.3 Implementar `set_region(AU915)` + `set_channel_mask(SubBand2)`: llamadas a `lr1121_modem_lorawan_set_region` y configuración de máscara de canales 8–15. Verificar por serial que el Modem-E confirma la región. Requiere hardware físico. Commit sugerido: `feat(firmware): configurar región AU915 sub-band 2 en Modem-E`.
- [ ] 2.4 Implementar configuración de credenciales OTAA: `set_dev_eui`, `set_join_eui`, `set_app_key` leyendo valores de NVS del ESP32. Commit sugerido: `feat(firmware): cargar credenciales OTAA desde NVS al Modem-E`.
- [ ] 2.5 Implementar `join()` con espera de evento DIO1: llamada a `lr1121_modem_lorawan_join`, bucle de espera del evento `JOINED` (o error) vía interrupción GPIO26. Validar que ChirpStack registra el join exitoso. Requiere hardware físico (nodo + gateway + ChirpStack). Commit sugerido: `feat(firmware): implementar join OTAA AU915 vía Modem-E en nodo sensor`.
- [ ] 2.6 Implementar `request_uplink(port, payload)` con espera de evento `TX_DONE`. Validar que el uplink llega a ChirpStack y se puede decodificar el payload de 14 bytes. Requiere hardware físico. Commit sugerido: `feat(firmware): implementar uplink LoRaWAN vía Modem-E en nodo sensor`.

## 3. Firmware del nodo sensor: integración con sensores

- [x] 3.1 Reemplazar el bloque de comunicación SX1278+LMIC en `firmware/sensor-node` por el crate `lr1121-modem-e`. Conectar el ciclo de lectura de sensores con el uplink: construir payload de 14 bytes, llamar a `request_uplink`, resetear contadores de pulsos. No requiere hardware para compilación. Commit sugerido: `feat(firmware): integrar lr1121-modem-e en el ciclo principal del nodo sensor`.
- [ ] 3.2 Verificar comportamiento ante pérdida de cobertura: apagar gateway, confirmar que el nodo sigue leyendo sensores y acumulando pulsos, restaurar gateway y confirmar rejoin y reanudación de uplinks. Requiere hardware físico. Commit sugerido: `test(firmware): verificar continuidad ante pérdida de cobertura AU915 Modem-E`.

## 4. Crate lr1121-transceiver (driver para gateway)

- [x] 4.1 Crear `firmware/lr1121-transceiver/` como crate biblioteca Rust. Agregar `lr11xx_driver` (SWDR001) como fuente en `vendor/`. Configurar `build.rs` con `bindgen`. No requiere hardware. Commit sugerido: `feat(gateway): crear crate lr1121-transceiver con bindings FFI de SWDR001`.
- [ ] 4.2 Implementar `Lr1121Transceiver::init()`: reset hardware, verificación de versión de chip y confirmación de modo transceiver (no Modem-E). Si el chip está en modo Modem-E retornar error claro. Requiere hardware físico (módulo LR1121 sin Modem-E). Commit sugerido: `feat(gateway): implementar init de LR1121 en modo transceiver`.
- [ ] 4.3 Implementar `set_rx_config(916_800_000 Hz, SF7, BW125)` y `start_rx_continuous()`. Verificar que el chip entra en RX activo (corriente de consumo y registro de estado). Requiere hardware físico. Commit sugerido: `feat(gateway): configurar RX continuo en 916.8 MHz SF7BW125 en lr1121-transceiver`.
- [ ] 4.4 Implementar `read_packet()`: leer payload, RSSI y SNR del chip vía SPI tras evento DIO1. Requiere hardware físico. Commit sugerido: `feat(gateway): implementar lectura de paquete recibido en lr1121-transceiver`.

## 5. Firmware del gateway: integración

- [x] 5.1 Reemplazar el bloque SX1278 en `firmware/gateway-node` por el crate `lr1121-transceiver`. Verificar que el protocolo Semtech UDP Packet Forwarder (sin cambios de lógica) funciona con el nuevo radio: recibir un uplink del nodo y verlo llegar a ChirpStack. Requiere ambos ESP32 físicos y ChirpStack. Commit sugerido: `feat(gateway): integrar lr1121-transceiver en gateway UDP forwarder AU915`.

## 6. Infraestructura (ChirpStack AU915)

- [x] 6.1 Actualizar `infra/docker-compose.yml`: variable de band plan `EU433` → `AU915_AU`, configurar sub-band 2. Verificar que ChirpStack arranca con AU915 y registra el gateway correctamente. No requiere hardware LoRa. Commit sugerido: `chore(infra): migrar ChirpStack de EU433 a AU915 sub-band 2`.

## 7. Validación de banco y rango

- [ ] 7.1 Validar flujo completo en banco: nodo (Modem-E AU915) → gateway (transceiver AU915) → ChirpStack → MQTT → FastAPI → InfluxDB. Verificar payload almacenado contra valores leídos por el nodo. Requiere ambos ESP32, ChirpStack y FastAPI corriendo. Commit sugerido: `test(firmware): validar flujo extremo a extremo LR1121 AU915 Modem-E en banco`.
- [ ] 7.2 Verificar join OTAA exitoso en ChirpStack (DevEUI visible, uplinks con FCnt incrementando). Verificar que el sub-band 2 queda configurado correctamente (Modem-E no usa canales fuera de la máscara).
- [ ] 7.3 Prueba de rango PoC: transmitir desde varios km, registrar RSSI/SNR por serial del gateway y recepción en ChirpStack. Documentar distancia, RSSI y SNR como línea base para el informe. Requiere hardware físico, antena yagi 915 MHz en nodo, omnidireccional SMA en gateway, espacio abierto.
- [ ] 7.4 Verificar comportamiento ante pérdida de WiFi del gateway: nodo continúa uplinks (Modem-E reintenta), gateway registra por serial, reanuda reenvío al restaurar WiFi.

## 8. Documentación

- [x] 8.1 Actualizar `openspec/config.yaml`: LR1121/AU915, Modem-E v2.1.0 en nodo, transceiver en gateway, canal fijo 916.8 MHz SF7BW125 para PoC. Commit sugerido: `docs(docs): actualizar config.yaml con stack LR1121 AU915 Modem-E`. *(Frecuencia corregida de 903.9 a 916.8 MHz por `fix-au915-subband2-frequency`.)*
- [x] 8.2 Actualizar `CLAUDE.md` (sección arquitectura): reflejar LR1121, AU915, Modem-E en nodo, transceiver en gateway, crates `lr1121-modem-e` y `lr1121-transceiver`. Commit sugerido: `docs(docs): actualizar CLAUDE.md con arquitectura LR1121 AU915`.
- [x] 8.3 Actualizar `hardware/netlist.md`: pinout LR1121 (BUSY GPIO27, DIO1 GPIO26), antenas recomendadas, nota sobre flashing Modem-E como prerequisito del nodo. Commit sugerido: `docs(hardware): actualizar netlist con pinout LR1121 y antenas AU915`.
