## 1. Configuración de build para ESP32-S3

- [ ] 1.1 Crear directorio `firmware/gateway-s3/` con `.cargo/config.toml` apuntando a target `xtensa-esp32s3-espidf`, `MCU = "esp32s3"`, `ESP_IDF_VERSION = "v5.2.2"` (misma versión que el build actual — verificar compatibilidad S3), y linker `ldproxy`. Incluir comentario de las variables de entorno necesarias (WIFI_SSID, WIFI_PASS, CHIRPSTACK_HOST).
  `build(gateway): agregar firmware/gateway-s3 con target xtensa-esp32s3-espidf`
- [ ] 1.2 Verificar que el build del gateway S3 compila sin errores ejecutando `cargo build --bin gateway-node` desde `firmware/gateway-s3/` (sin hardware S3 disponible aún — solo validar que el toolchain acepta el target y que `esp-idf-hal 0.46` soporta ESP32-S3). Documentar cualquier ajuste necesario en el `Cargo.toml` o en el código fuente.
  `build(gateway): verificar compilación gateway-node para xtensa-esp32s3-espidf`
- [ ] 1.3 Verificar que `cargo build --bin sensor-node` y `cargo build --bin gateway-node` desde el `firmware/` original (ESP32 clásico) siguen compilando sin cambios.
  `test(firmware): confirmar que builds ESP32 clásico no se rompen`

## 2. Documentación de pinout y reserva de GPIOs

- [ ] 2.1 Agregar sección "Gateway ESP32-S3 DevKitC" en `hardware/netlist.md` con tabla de pinout SX1278 (SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, DIO0=26) y nota explícita de que GPIO5 no es strapping pin en el ESP32-S3 (a diferencia del ESP32 clásico).
  `docs(hardware): documentar pinout SX1278 en ESP32-S3 DevKitC con nota GPIO5`
- [ ] 2.2 Agregar tabla de GPIOs reservados para W5500 (CS=GPIO10, INT=GPIO9), SIM7000G (TX=GPIO17, RX=GPIO16, PWR_KEY=GPIO15) y ADC de alimentación (VIN_MON=GPIO4) en la sección de `hardware/netlist.md` del gateway S3. Incluir nota de que son reservas sin driver implementado.
  `docs(hardware): reservar GPIOs W5500, SIM7000G y ADC alimentación en ESP32-S3`
- [ ] 2.3 Agregar nota sobre GPIO23 (MOSI): verificar si el modelo concreto de ESP32-S3 DevKitC 38p a adquirir tiene GPIO23 libre o conectado a LED onboard, y documentar la alternativa MOSI=GPIO11 (HSPI S3) en caso de conflicto. Dejar como OQ1 pendiente hasta tener el hardware.
  `docs(hardware): documentar OQ1 GPIO23 vs GPIO11 para MOSI en ESP32-S3`

## 3. Validación en hardware (requiere hardware real — ESP32-S3 DevKitC)

- [ ] 3.1 *(Bloqueado hasta adquirir ESP32-S3)* Flashear `gateway-node` compilado para `xtensa-esp32s3-espidf` en el ESP32-S3 DevKitC 38p con `cargo espflash`. Verificar que el log serial muestra `gateway-node starting`, el `gateway_eui` correcto derivado de la MAC WiFi, y que el SX1278 inicializa correctamente en modo RX continuo.
  `test(gateway): validar arranque gateway-node en ESP32-S3 DevKitC real`
- [ ] 3.2 *(Bloqueado hasta adquirir ESP32-S3)* Conectar el nodo sensor (ESP32 clásico) y verificar que el gateway S3 recibe y reenvía uplinks a ChirpStack correctamente. Confirmar que el cambio de SoC no afecta al comportamiento del protocolo UDP.
  `test(gateway): validar recepción y forwarding de uplinks LoRaWAN en ESP32-S3`
- [ ] 3.3 *(Bloqueado hasta adquirir ESP32-S3)* Confirmar en hardware que GPIO23 está libre en el modelo adquirido (o usar GPIO11 si hay conflicto con LED). Resolver OQ1 y actualizar `hardware/netlist.md` con el MOSI definitivo.
  `docs(hardware): resolver OQ1 MOSI definitivo en ESP32-S3 DevKitC adquirido`
