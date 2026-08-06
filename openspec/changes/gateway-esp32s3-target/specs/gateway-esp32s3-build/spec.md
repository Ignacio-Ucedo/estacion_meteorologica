## ADDED Requirements

### Requirement: El gateway compila con target xtensa-esp32s3-espidf

El repositorio SHALL proveer una configuración de build en `firmware/gateway-s3/.cargo/config.toml` que permita compilar el binario `gateway-node` con target `xtensa-esp32s3-espidf` (ESP32-S3 DevKitC 38 pines), sin modificar el `.cargo/config.toml` principal que compila el nodo sensor y el gateway PoC con `xtensa-esp32-espidf`.

El build del nodo sensor y del gateway PoC (ESP32 clásico) SHALL seguir funcionando sin cambios.

#### Scenario: Build del gateway S3 compila sin errores

- **GIVEN** el toolchain `xtensa-esp32s3-espidf` está instalado con `espup`
- **WHEN** se ejecuta `cargo build --bin gateway-node` desde `firmware/gateway-s3/`
- **THEN** la compilación termina sin errores y produce un artefacto ELF para ESP32-S3

#### Scenario: Build del sensor-node no se rompe

- **GIVEN** el `.cargo/config.toml` principal en `firmware/` apunta a `xtensa-esp32-espidf`
- **WHEN** se ejecuta `cargo build --bin sensor-node` desde `firmware/`
- **THEN** la compilación termina sin errores y produce un artefacto ELF para ESP32 clásico

#### Scenario: Flash en ESP32-S3 DevKitC arranca el gateway

- **GIVEN** el artefacto ELF del gateway S3 fue flasheado en un ESP32-S3 DevKitC 38p con `cargo espflash`
- **WHEN** el dispositivo arranca
- **THEN** el log serial muestra `gateway-node starting — single-channel UDP packet forwarder` y el `gateway_eui` derivado de la MAC WiFi del S3, idénticos en formato al comportamiento en el ESP32 clásico
