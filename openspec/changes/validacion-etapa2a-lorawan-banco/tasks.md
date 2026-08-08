## 0. Prerrequisitos (verificar antes de arrancar)

- [ ] 0.1 Confirmar que las tareas 2.2 (HAL SPI lr1121-modem-e) y 4.2 (HAL SPI lr1121-transceiver) del change `migrate-lr1121-au915` están completas y los crates compilan. Sin esto, el resto está bloqueado. No requiere hardware LR1121 para compilar.
  `chore(firmware): verificar prerequisitos migrate-lr1121-au915 antes de etapa 2a`
- [ ] 0.2 Confirmar que los módulos LR1121 físicos (breakout boards) están disponibles, que Modem-E v2.1.0 está flasheado en el módulo del nodo (tarea 1.1 de `migrate-lr1121-au915`), y que el módulo del gateway tiene factory firmware (transceiver). Requiere hardware físico.
  `chore(hardware): verificar módulos LR1121 y versión de firmware antes de etapa 2a`
- [ ] 0.3 Cablear ambos ESP32 al LR1121 según netlist: SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, BUSY=27, DIO1=26. Conectar antenas genéricas 915 MHz. Requiere hardware físico.
  `chore(hardware): cablear ESP32+LR1121 para banco etapa 2a`

## 1. Flash y bring-up del gateway

- [ ] 1.1 Compilar y flashear `gateway-node` en el ESP32 del gateway: `cargo build --bin gateway-node && cargo espflash flash --bin gateway-node`. Abrir monitor serial y verificar `lr1121_init_ok mode=transceiver` y `wifi_connected`. Requiere hardware físico.
  `chore(firmware): flashear gateway-node y verificar init LR1121 transceiver`
- [ ] 1.2 Verificar que el gateway aparece como `Online` en ChirpStack UI (puede tardar hasta 30 s desde el primer PULL_DATA). Anotar el `gateway_eui` del log serial para registro. Requiere gateway corriendo + infra corriendo.
  `chore(infra): verificar gateway-node visible en ChirpStack UI etapa 2a`

## 2. Flash y bring-up del nodo mock

- [ ] 2.1 Provisionar NVS del ESP32 del nodo con las claves OTAA del `sensor-node-mock` (device_id=2, distintas a las del gateway-node-mock). Borrar partición NVS previa con `cargo espflash erase-flash`. Requiere hardware físico.
  `chore(firmware): provisionar NVS del nodo sensor-node-mock para etapa 2a`
- [ ] 2.2 Compilar y flashear `sensor-node-mock`: `cargo build --bin sensor-node-mock && cargo espflash flash --bin sensor-node-mock`. Abrir monitor serial y verificar `modem_version=2.1.0` (o similar). Requiere hardware físico.
  `chore(firmware): flashear sensor-node-mock y verificar versión Modem-E`

## 3. Validación del join OTAA via RF

- [ ] 3.1 Con ambos dispositivos encendidos y el monitor serial del nodo abierto, esperar hasta 60 s. Verificar `lorawan_join_ok dev_addr=<...>` en el serial del nodo. Simultáneamente verificar en el serial del gateway `packet_received rssi=<R> snr=<S>` correspondiente al JoinRequest. Requiere ambos ESP32 + infra corriendo.
  `test(firmware): verificar OTAA join via RF en banco etapa 2a`
- [ ] 3.2 Verificar en ChirpStack UI → Devices → `sensor-node-mock` que el device está activo y `Last seen` se actualizó. Confirmar que el JoinRequest fue procesado con las claves correctas (sin error de MIC). Requiere ChirpStack accesible.
  `test(infra): verificar join OTAA sensor-node-mock en ChirpStack UI etapa 2a`

## 4. Validación de uplinks y métricas de señal

- [ ] 4.1 Esperar 5 ciclos de uplink del nodo (intervalo de producción: 10 min; si se usa intervalo de test reducido, ajustar SEND_INTERVAL_MS antes de flashear). Registrar en tabla: FCnt, RSSI (dBm) y SNR (dB) de cada uplink desde el log del gateway. Requiere ambos ESP32 corriendo.
  `test(firmware): registrar RSSI/SNR de 5 uplinks consecutivos en banco etapa 2a`
- [ ] 4.2 Verificar que al menos 4 de los 5 uplinks llegaron a ChirpStack (FCnt visible en UI, sin saltos inesperados). Calcular y registrar el porcentaje de pérdida de paquetes en banco. Requiere ChirpStack accesible.
  `test(infra): verificar recepción de 5 uplinks en ChirpStack y medir packet loss etapa 2a`
- [ ] 4.3 Confirmar que las lecturas de temperatura y humedad son variables (ciclo triangular, no valores fijos) y que `bateria_mv=3700` en todos los uplinks. Verificar en InfluxDB o via REST API del backend.
  `test(backend): verificar ingesta de lecturas sensor-node-mock en InfluxDB etapa 2a`

## 5. Documentación de resultados

- [ ] 5.1 Registrar los resultados de banco: tabla RSSI/SNR por uplink, packet loss observado, versión de firmware de ambos dispositivos (git commit), cualquier problema encontrado y su resolución. Estos valores son la línea base de referencia para comparar contra etapa 2b. Archivar el change al completar.
  `docs(docs): registrar resultados y línea base RSSI/SNR de banco etapa 2a`
