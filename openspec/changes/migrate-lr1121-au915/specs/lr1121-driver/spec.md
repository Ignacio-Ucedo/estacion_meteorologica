## ADDED Requirements

### Requirement: El crate lr1121-driver expone primitivas SPI para LR1121 sobre lr11xx_driver C SDK

El crate `firmware/lr1121-driver` SHALL envolver el SDK C oficial de Semtech (`lr11xx_driver`) mediante bindings FFI generados con `bindgen`, y exponer una interfaz Rust segura para inicialización, transmisión y recepción LoRa con el módulo LR1121.

- Unidad de frecuencia: Hz (u32), rango válido 400 000 000–960 000 000 Hz (puerto HF sub-GHz del LR1121).
- Spreading Factor: SF5–SF12 (u8).
- Bandwidth: 125 kHz, 250 kHz, 500 kHz.
- Potencia de transmisión: configurable en el rango soportado por el hardware (típico −9 a +22 dBm en puerto HF).
- El crate maneja el BUSY pin con timeout configurable antes de cada comando SPI; si el pin no baja en el timeout, retorna error.

#### Scenario: Inicialización del módulo LR1121
- **GIVEN** el ESP32 tiene el LR1121 conectado por SPI con NSS, RESET, BUSY y DIO1 configurados
- **WHEN** se llama a `Lr1121::new(spi, pins, config)` y luego `init()`
- **THEN** el driver ejecuta el reset hardware, espera BUSY, verifica la versión del chip por SPI y configura el modo LoRa en el puerto HF; retorna `Ok(())` si el chip responde correctamente

#### Scenario: Transmisión de un buffer LoRa
- **GIVEN** el LR1121 está inicializado en modo LoRa con frecuencia y parámetros configurados
- **WHEN** se llama a `transmit(payload: &[u8])`
- **THEN** el driver carga el payload en el FIFO del chip, configura TX y espera la interrupción DIO1 (TX_DONE); retorna `Ok(())` al completar o `Err` en timeout

#### Scenario: Recepción continua de paquetes LoRa
- **GIVEN** el LR1121 está inicializado en modo LoRa con frecuencia y parámetros configurados
- **WHEN** se llama a `start_rx()` y llega un paquete
- **THEN** el driver señaliza vía DIO1 (RX_DONE), lee el payload del FIFO y retorna `RxPacket { payload, rssi_dbm: i16, snr_db: i8 }`

#### Scenario: Timeout de BUSY pin
- **GIVEN** el LR1121 no responde (módulo sin alimentación o SPI desconectado)
- **WHEN** el driver intenta enviar un comando SPI y espera el BUSY pin
- **THEN** retorna `Err(Lr1121Error::BusyTimeout)` después del timeout configurado; no bloquea el firmware indefinidamente

---

### Requirement: El crate implementa el trait PhyRxTx de lorawan-device para el nodo sensor

El crate `lr1121-driver` SHALL implementar el trait `radio::PhyRxTx` de la crate `lorawan-device` para que el stack LoRaWAN pueda usar el LR1121 como capa física sin conocer detalles del chip.

#### Scenario: El stack LoRaWAN usa el LR1121 como radio
- **GIVEN** una instancia de `lorawan_device::Device` configurada con AU915 y una instancia `Lr1121` como radio
- **WHEN** el stack inicia el join OTAA o transmite un uplink
- **THEN** el stack invoca los métodos de `PhyRxTx` del driver sin errores de compilación; el LR1121 ejecuta TX/RX en la frecuencia y parámetros indicados por el stack
