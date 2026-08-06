## Why

El gateway actual se compila con target `xtensa-esp32-espidf` (ESP32 clásico 30 pines, el que tenemos en el banco). El hardware target definitivo del gateway es un **ESP32-S3 DevKitC 38 pines** porque el diseño del gateway contempla expansión a Ethernet W5500 (SPI adicional) y cellular SIM7000G (UART), más ADC de monitoreo de alimentación — todo lo cual requiere más GPIOs de los que el ESP32 clásico puede proveer sin conflictos (ADC2 vs. WiFi). El S3 también elimina el conflicto ADC2/WiFi del ESP32 clásico y tiene USB-C onboard útil para depuración en campo.

La PoC sigue compilando y funcionando en el ESP32 clásico (TENEMOS hardware); el ESP32-S3 se comprará para el diseño final. Este change separa las build configs para que ambos targets coexistan, y reserva los GPIOs del S3 para los módulos futuros sin implementar los drivers.

## What Changes

- **build config**: añadir `firmware/gateway-s3/` (o feature de Cargo) con target `xtensa-esp32s3-espidf`, variables de entorno MCU/ESP_IDF propias, y script `build-gateway-s3.sh`. El `.cargo/config.toml` principal sigue apuntando a `xtensa-esp32-espidf` (sensor-node + gateway PoC).
- **verificación de pinout SPI SX1278 en S3**: los pines actuales del gateway (SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, DIO0=26) se validan contra el ESP32-S3 DevKitC 38 pines. GPIO5 no es strapping pin en el S3 (el S3 usa GPIO0, GPIO3, GPIO45, GPIO46), por lo que NSS=5 es seguro. Resultado documentado en `hardware/netlist.md`.
- **reserva de GPIOs para módulos futuros**: asignar y documentar en `hardware/netlist.md` los GPIOs TBD del S3 para W5500 (CS, INT) y SIM7000G (TX, RX, PWR_KEY), sin implementar los drivers.
- **docs**: actualizar `hardware/netlist.md` con la tabla de pinout del gateway para ESP32-S3 DevKitC.

No se implementan los drivers W5500 ni SIM7000G. No se modifica la lógica de `gateway-node.rs`. No se rompe el build PoC del ESP32 clásico.

## Capabilities

### New Capabilities

- `gateway-esp32s3-build`: configuración de build separada para compilar `gateway-node` con target `xtensa-esp32s3-espidf` (ESP32-S3 DevKitC 38 pines), coexistiendo con la build PoC del ESP32 clásico.
- `gateway-gpio-plan`: tabla de asignación de GPIOs del ESP32-S3 para el gateway definitivo — SX1278 SPI (existente), W5500 CS+INT (reservados), SIM7000G TX/RX/PWR_KEY (reservados), ADC de alimentación (reservado) — sin implementar drivers.

### Modified Capabilities

_(ninguna — la lógica del gateway y los specs de comportamiento no cambian)_

## Impact

- **firmware/**: nuevo directorio o feature para build del gateway S3; `.cargo/config.toml` puede necesitar ajuste o un config local para el S3.
- **hardware/netlist.md**: tabla de pinout del gateway ESP32-S3 DevKitC con pines SX1278, reservas W5500 y SIM7000G.
- Sin impacto en: nodo sensor, backend, frontend, Android, modelos 3D.
- Sin cambio en el formato del payload ni en la frecuencia de uplinks.
- Impacto energético: ninguno (la lógica del firmware no cambia; el S3 tiene consumo similar al ESP32 clásico en modo activo con WiFi).
- Plan de rollback: la build del ESP32 clásico no se modifica; el rollback es simplemente no comprar ni usar el S3. El change es puramente aditivo y documental.
