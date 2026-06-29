## ADDED Requirements

### Requirement: El gateway opera como single-channel UDP packet forwarder hacia ChirpStack

El firmware del gateway SHALL recibir tramas LoRaWAN del nodo en un único canal (902.3 MHz, SF7BW125, AU915 sub-banda 2) y reenviarlas a ChirpStack usando el protocolo Semtech UDP Packet Forwarder. Esta implementación es una limitación conocida de prototipo: no es spec-compliant con LoRaWAN (que requiere 8 canales), pero es suficiente para un único nodo operando en el mismo canal fijo.

#### Scenario: El gateway reenvía un uplink recibido a ChirpStack
- **GIVEN** el gateway tiene WiFi activo y ChirpStack está disponible en la red local
- **WHEN** el gateway recibe una trama LoRaWAN válida del nodo en 902.3 MHz SF7BW125
- **THEN** el gateway encapsula la trama en un mensaje UDP Semtech PUSH_DATA y lo envía al servidor ChirpStack configurado, registrando el evento por serial

#### Scenario: El gateway registra paquetes recibidos por serial
- **GIVEN** el gateway está ejecutándose con el forwarder activo
- **WHEN** se recibe cualquier paquete LoRa (válido o no)
- **THEN** el gateway registra por serial el RSSI, SNR, tamaño y contenido hexadecimal del paquete

#### Scenario: El gateway reporta su estado al network server periódicamente
- **GIVEN** el gateway tiene WiFi activo y ChirpStack disponible
- **WHEN** transcurren 30 segundos desde el último heartbeat
- **THEN** el gateway envía un mensaje PUSH_DATA de estadísticas a ChirpStack (rxnb, rxok, txnb) según el protocolo Semtech UDP

---

### Requirement: El gateway maneja pérdida de conectividad WiFi con reconexión automática

El gateway SHALL detectar pérdidas de conectividad WiFi e intentar reconexión automática sin requerir intervención manual ni reinicio del dispositivo.

#### Scenario: El gateway reconecta a WiFi tras una desconexión
- **GIVEN** el gateway pierde la conexión WiFi
- **WHEN** la red WiFi vuelve a estar disponible
- **THEN** el gateway reconecta automáticamente sin reiniciarse y reanuda el reenvío de paquetes a ChirpStack

#### Scenario: El gateway continúa recibiendo LoRa durante outage de WiFi
- **GIVEN** el gateway perdió la conexión WiFi
- **WHEN** el nodo transmite un uplink LoRaWAN
- **THEN** el gateway recibe el paquete (registra por serial) pero no puede reenviarlo a ChirpStack hasta que WiFi se restaure; el paquete se descarta (no hay buffer persistente en este cambio)
