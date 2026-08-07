## ADDED Requirements

### Requirement: lr1121-modem-e expone comandos Modem-E al ESP32 del nodo sensor

El crate `firmware/lr1121-modem-e` SHALL envolver el host driver C `lr1121_modemE_driver` (SWDR009 v2.0.0, compatible con Modem-E v2.1.0) mediante bindings FFI y exponer una interfaz Rust segura para configuración LoRaWAN, join OTAA y envío de uplinks.

El ESP32 implementa las 4 funciones HAL SPI que SWDR009 requiere: `write`, `read`, `write_read` y `reset` (señal NRESET del LR1121). El crate envuelve la inicialización, la configuración de región/sub-band y el ciclo de eventos vía DIO1/IRQ.

#### Scenario: Configuración de región AU915 sub-band 2
- **GIVEN** el LR1121 corre Modem-E v2.1.0 y el ESP32 tiene el crate inicializado
- **WHEN** se llama a `set_region(AU915)` y `set_channel_mask(SubBand2)`
- **THEN** el Modem-E configura internamente los canales 8–15 como activos y confirma la configuración; el crate retorna `Ok(())`

#### Scenario: Configuración de credenciales OTAA
- **GIVEN** el crate está inicializado con el LR1121 en modo Modem-E
- **WHEN** se llama a `set_dev_eui`, `set_join_eui` y `set_app_key` con los valores leídos de NVS
- **THEN** el Modem-E almacena las credenciales internamente y confirma; el crate retorna `Ok(())`

#### Scenario: Join OTAA y espera de evento
- **GIVEN** las credenciales OTAA están configuradas y ChirpStack está disponible con AU915 sub-band 2
- **WHEN** se llama a `join()` y el ESP32 espera el evento en DIO1/IRQ
- **THEN** el Modem-E completa el join, activa la interrupción DIO1 con evento `JOINED`, y el crate retorna `Ok(JoinedEvent)`; en caso de fallo retorna el evento de error correspondiente para que el caller implemente el retry

#### Scenario: Envío de uplink
- **GIVEN** el Modem-E tiene sesión OTAA activa
- **WHEN** se llama a `request_uplink(port, payload: &[u8])` con el FRMPayload de 14 bytes
- **THEN** el Modem-E encripta y transmite el uplink, activa DIO1 con evento `TX_DONE`; el crate retorna `Ok(TxDoneEvent { status })`

#### Scenario: Timeout de BUSY pin
- **GIVEN** el LR1121 no responde (sin alimentación o SPI desconectado)
- **WHEN** el crate intenta enviar un comando SPI y el BUSY pin no baja
- **THEN** retorna `Err(ModemEError::BusyTimeout)` después del timeout configurado; no bloquea el firmware indefinidamente

---

### Requirement: lr1121-transceiver expone RX raw LoRa para el gateway

El crate `firmware/lr1121-transceiver` SHALL envolver el driver C `lr11xx_driver` (SWDR001) mediante bindings FFI y exponer al gateway ESP32 las primitivas de configuración y recepción LoRa en modo transceiver (sin stack LoRaWAN en el chip).

#### Scenario: Inicialización en modo transceiver
- **GIVEN** el ESP32 tiene el LR1121 conectado por SPI con NSS, RESET, BUSY y DIO1 configurados
- **WHEN** se llama a `Lr1121Transceiver::init(spi, pins, config)`
- **THEN** el driver ejecuta reset hardware, verifica la versión del chip y confirma que el chip corre en modo transceiver (no Modem-E); retorna `Ok(())` o `Err` si el chip está en modo Modem-E

#### Scenario: Configuración de recepción y escucha continua
- **GIVEN** el LR1121 está inicializado en modo transceiver
- **WHEN** se llama a `set_rx_config(freq_hz: 916_800_000, sf: SF7, bw: BW125)` seguido de `start_rx_continuous()`
- **THEN** el LR1121 entra en modo RX continuo en 916.8 MHz SF7BW125 y señaliza paquetes recibidos vía DIO1

#### Scenario: Lectura de paquete recibido
- **GIVEN** el LR1121 está en RX continuo y llega un paquete LoRa
- **WHEN** se activa DIO1 (RX_DONE) y se llama a `read_packet()`
- **THEN** el driver retorna `RxPacket { payload: Vec<u8>, rssi_dbm: i16, snr_db: i8 }`
