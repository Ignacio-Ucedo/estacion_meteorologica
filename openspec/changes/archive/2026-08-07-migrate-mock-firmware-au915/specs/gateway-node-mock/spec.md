## MODIFIED Requirements

### Requirement: Construcción de frame LoRaWAN y envío via UDP

El firmware SHALL construir frames LoRaWAN reales (payload binario de 14
bytes, CRC-8/MAXIM sobre los primeros 13, cifrado con AppSKey, MIC con
NwkSKey) y enviarlos al ChirpStack Gateway Bridge en el formato RXPK del
protocolo Semtech UDP Packet Forwarder v2. El envío SHALL ocurrir sobre
WiFi; no se usa hardware de radio LoRa en ningún momento. El campo `freq`
del RXPK SHALL reflejar el canal fijo PoC de AU915 sub-band 2 configurado
en ChirpStack (916.8 MHz, canal 8), no un valor de otra banda regulatoria.

#### Scenario: Frame enviado exitosamente

- **WHEN** la sesión OTAA está activa y WiFi disponible
- **THEN** el firmware construye el RXPK JSON con `freq=916.8`, `datr="SF7BW125"`, `codr="4/5"` y envía PUSH_DATA al host configurado en el puerto 1700/UDP

#### Scenario: PUSH_DATA con payload correcto

- **WHEN** el firmware construye el RXPK
- **THEN** el campo `data` contiene el frame LoRaWAN cifrado en base64, y `size` refleja la longitud del frame

#### Scenario: Heartbeat PULL_DATA periódico

- **WHEN** han transcurrido 10 s desde el último PULL_DATA
- **THEN** el firmware envía PULL_DATA al Gateway Bridge para mantener la sesión UDP activa

#### Scenario: STAT periódico

- **WHEN** han transcurrido 30 s desde el último STAT
- **THEN** el firmware envía un PUSH_DATA con JSON de estadísticas (`rxnb`, `rxok`, `rxfw`)
