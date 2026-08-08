## ADDED Requirements

### Requirement: Bring-up del hardware LR1121 en ambos dispositivos

Antes del test RF, ambos ESP32 SHALL confirmar por serial que el LR1121 respondió correctamente al init SPI: el nodo SHALL reportar la versión de Modem-E (≥ v2.1.0) y el gateway SHALL reportar el modo transceiver (factory firmware). Si alguno falla el init, el procedimiento de validación se interrumpe.

#### Scenario: Nodo reporta versión Modem-E correcta

- **WHEN** el firmware `sensor-node-mock` arranca con el LR1121 conectado
- **THEN** el log serial muestra la versión de Modem-E (ej. `modem_version=2.1.0`) dentro de los primeros 5 segundos

#### Scenario: Gateway reporta modo transceiver activo

- **WHEN** el firmware `gateway-node` arranca con el LR1121 conectado
- **THEN** el log serial muestra `lr1121_init_ok mode=transceiver` y no reporta ningún error de Modem-E inesperado


### Requirement: OTAA join via RF AU915

El nodo sensor mock SHALL realizar el proceso OTAA con ChirpStack transmitiendo el JoinRequest por RF en 916.8 MHz SF7BW125. El gateway SHALL recibir el JoinRequest y reenviarlo a ChirpStack via UDP. El join SHALL completarse en menos de 60 segundos desde el encendido del nodo.

#### Scenario: JoinRequest recibido por el gateway y reenviado a ChirpStack

- **WHEN** el nodo transmite el JoinRequest y el gateway está en RX continuo
- **THEN** el log serial del gateway muestra `packet_received rssi=<dBm> snr=<dB> freq=916800000` y ChirpStack UI registra el JoinRequest entrante

#### Scenario: JoinAccept enviado por ChirpStack y recibido por el nodo

- **WHEN** ChirpStack procesa el JoinRequest con las claves correctas
- **THEN** el log serial del nodo muestra `lorawan_join_ok dev_addr=<...>` y ChirpStack UI muestra el device `sensor-node-mock` con estado activo y `Last seen` reciente


### Requirement: Uplinks RF recibidos en banco con calidad de señal aceptable

El gateway en RX continuo SHALL recibir los uplinks del nodo con RSSI superior a −80 dBm y SNR superior a 5 dB cuando la separación entre dispositivos es ≤ 5 m sin obstáculos. Se validan al menos 5 uplinks consecutivos; la pérdida de paquetes SHALL ser ≤ 1 de 5 (≤ 20%).

#### Scenario: Uplink recibido con RSSI y SNR de banco

- **WHEN** el nodo transmite un uplink a ≤ 5 m sin obstáculos del gateway
- **THEN** el log serial del gateway muestra `packet_received rssi=<R> snr=<S>` con R > −80 dBm y S > 5 dB

#### Scenario: 5 uplinks consecutivos sin pérdida relevante

- **WHEN** el nodo envía 5 uplinks sucesivos (FCnt 1 a 5)
- **THEN** el gateway recibe al menos 4 de los 5 y ChirpStack UI muestra 4 o más uplinks del device con FCnt incrementando

#### Scenario: RSSI y SNR registrados como línea base

- **WHEN** se completan los 5 uplinks de banco
- **THEN** los valores de RSSI y SNR de cada uplink están registrados (log serial o notes del change) para comparación con etapa 2b


### Requirement: Lecturas del nodo mock visibles en InfluxDB

Los uplinks recibidos por el gateway SHALL fluir por el mismo pipeline que en Etapa 1 (ChirpStack → MQTT → backend → InfluxDB), almacenando lecturas con `device_id=2` y valores de temperatura en rango [15.0, 25.0] °C (ciclo triangular, resolución 0.01 °C) y batería constante 3700 mV.

#### Scenario: Lectura de nodo mock almacenada en InfluxDB

- **WHEN** un uplink del nodo mock llega exitosamente a ChirpStack
- **THEN** InfluxDB contiene un punto en `weather_reading` con `device_id=2`, `temp_c` en [15.0, 25.0], `battery_mv=3700` y timestamp dentro de los últimos 2 min
