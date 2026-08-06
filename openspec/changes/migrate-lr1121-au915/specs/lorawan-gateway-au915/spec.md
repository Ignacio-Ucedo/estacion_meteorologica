## ADDED Requirements

### Requirement: El gateway opera como single-channel UDP packet forwarder AU915 hacia ChirpStack

El firmware del gateway SHALL recibir tramas LoRaWAN del nodo en el canal fijo de la PoC (903.9 MHz SF7BW125, AU915 sub-band 2, canal 8) usando el módulo LR1121 vía `lr1121-driver`, y reenviarlas a ChirpStack usando el protocolo Semtech UDP Packet Forwarder. La lógica del forwarder (mensajes PUSH_DATA, PULL_DATA, PULL_RESP, heartbeat de estadísticas) no cambia respecto a la implementación anterior.

**Limitación de PoC documentada**: gateway single-channel, no spec-compliant con LoRaWAN completo (AU915 estándar requiere hardware multi-canal). Suficiente para validar el enlace de rango con un único nodo en canal fijo. Para producción: reemplazar con gateway multi-canal dedicado.

#### Scenario: El gateway reenvía un uplink recibido a ChirpStack
- **GIVEN** el gateway tiene WiFi activo y ChirpStack está disponible con band plan AU915 sub-band 2
- **WHEN** el gateway recibe una trama LoRaWAN válida del nodo en 903.9 MHz SF7BW125
- **THEN** el gateway encapsula la trama en un mensaje UDP Semtech PUSH_DATA y lo envía a ChirpStack, registrando el evento por serial con RSSI y SNR

#### Scenario: El gateway registra todos los paquetes recibidos por serial
- **GIVEN** el gateway está ejecutándose con el forwarder activo
- **WHEN** se recibe cualquier paquete LoRa (válido o no)
- **THEN** el gateway registra por serial: frecuencia, SF, RSSI (dBm), SNR (dB), tamaño y contenido hexadecimal del paquete

#### Scenario: El gateway reporta estadísticas periódicamente a ChirpStack
- **GIVEN** el gateway tiene WiFi activo y ChirpStack disponible
- **WHEN** transcurren 30 segundos desde el último heartbeat
- **THEN** el gateway envía un PUSH_DATA de estadísticas (rxnb, rxok, txnb) a ChirpStack

---

### Requirement: El gateway maneja pérdida de WiFi con reconexión automática

El gateway SHALL detectar pérdidas de conectividad WiFi e intentar reconexión automática sin reinicio del dispositivo.

#### Scenario: El gateway reconecta a WiFi tras desconexión
- **GIVEN** el gateway pierde la conexión WiFi
- **WHEN** la red WiFi vuelve a estar disponible
- **THEN** el gateway reconecta automáticamente y reanuda el reenvío de paquetes a ChirpStack

#### Scenario: El gateway descarta paquetes durante outage de WiFi
- **GIVEN** el gateway perdió la conexión WiFi
- **WHEN** el nodo transmite un uplink LoRaWAN
- **THEN** el gateway recibe el paquete y lo registra por serial, pero no puede reenviarlo; el paquete se descarta (no hay buffer persistente en este cambio)
