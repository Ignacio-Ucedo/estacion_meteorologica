## Purpose

Especificaciones del firmware `gateway-node-mock`: un binario ESP32 que simula
un gateway LoRaWAN enviando lecturas meteorológicas sintéticas al ChirpStack
Gateway Bridge vía WiFi + UDP, sin usar hardware SX1278. Actúa como segundo
dispositivo de prueba de extremo a extremo junto con `sensor-node-mock`.

## Requirements

### Requirement: Conectividad WiFi y arranque

El binario `gateway-node-mock` SHALL conectarse a la red WiFi configurada
(SSID y contraseña) al arrancar, obtener IP por DHCP, e imprimir por serial
el gateway EUI derivado de la MAC WiFi antes de intentar ninguna operación
LoRaWAN o UDP.

#### Scenario: Arranque exitoso con WiFi disponible

- **WHEN** el ESP32 arranca con SSID/contraseña correctos y el AP está disponible
- **THEN** el firmware obtiene IP por DHCP, imprime `gateway_eui=<EUI>` por serial y continúa al bucle principal

#### Scenario: WiFi no disponible al arrancar

- **WHEN** el AP no está disponible o las credenciales son incorrectas
- **THEN** el firmware reintenta la conexión indefinidamente con backoff (mín 1 s, máx 30 s) sin entrar al bucle principal

#### Scenario: Desconexión WiFi durante operación

- **WHEN** la conexión WiFi se pierde mientras el firmware está en el bucle principal
- **THEN** el firmware detecta la desconexión, omite el envío del uplink de ese ciclo, reconecta y reanuda el bucle normal


### Requirement: OTAA join con ChirpStack

El firmware SHALL realizar el proceso OTAA (Over-The-Air Activation) con
ChirpStack usando claves AppKey/AppEUI/DevEUI propias del `gateway-node-mock`
(`device_id = 3`), distintas de las del nodo real (`device_id = 1`) y del
`sensor-node-mock` (`device_id = 2`). Las claves SHALL cargarse desde NVS
usando el mismo mecanismo que `sensor-node-mock`.

#### Scenario: Join OTAA exitoso

- **WHEN** el device está registrado en ChirpStack con las claves OTAA correctas
- **THEN** ChirpStack responde con JoinAccept y el firmware obtiene AppSKey/NwkSKey para cifrar uplinks

#### Scenario: Join OTAA fallido (device no registrado)

- **WHEN** el device no está registrado en ChirpStack o las claves no coinciden
- **THEN** el firmware registra el error por serial y reintenta el join en el siguiente ciclo

#### Scenario: Sesión OTAA persistida en NVS

- **WHEN** el firmware ya tiene una sesión OTAA válida almacenada en NVS
- **THEN** el firmware reutiliza la sesión sin realizar un nuevo join, manteniendo el contador de frames


### Requirement: Generación de lecturas sintéticas

El firmware SHALL generar lecturas meteorológicas sintéticas con el mismo
patrón determinístico que `sensor-node-mock`: temperatura en ciclo
triangular 15–25 °C, humedad inversamente correlacionada, pulsos de lluvia
basados en `seq`, pulsos de viento basados en `seq`, `battery_mv = 3700`
constante. `device_id` SHALL ser `3`.

#### Scenario: Lectura generada en cada ciclo

- **WHEN** el timer de envío expira
- **THEN** el firmware genera una lectura sintética con los campos dentro de rango válido (temp −40–85 °C, humidity 0–100 %, battery 0–5000 mV)

#### Scenario: Secuencia incrementa monotónicamente

- **WHEN** se generan lecturas consecutivas
- **THEN** el campo `seq` incrementa de 1 en 1 en cada uplink y se persiste en NVS para sobrevivir reinicios


### Requirement: Construcción de frame LoRaWAN y envío via UDP

El firmware SHALL construir frames LoRaWAN reales (payload binario de 14
bytes, CRC-8/MAXIM sobre los primeros 13, cifrado con AppSKey, MIC con
NwkSKey) y enviarlos al ChirpStack Gateway Bridge en el formato RXPK del
protocolo Semtech UDP Packet Forwarder v2. El envío SHALL ocurrir sobre
WiFi; no se usa SX1278 en ningún momento.

#### Scenario: Frame enviado exitosamente

- **WHEN** la sesión OTAA está activa y WiFi disponible
- **THEN** el firmware construye el RXPK JSON con `freq=433.175`, `datr="SF7BW125"`, `codr="4/5"` y envía PUSH_DATA al host configurado en el puerto 1700/UDP

#### Scenario: PUSH_DATA con payload correcto

- **WHEN** el firmware construye el RXPK
- **THEN** el campo `data` contiene el frame LoRaWAN cifrado en base64, y `size` refleja la longitud del frame

#### Scenario: Heartbeat PULL_DATA periódico

- **WHEN** han transcurrido 10 s desde el último PULL_DATA
- **THEN** el firmware envía PULL_DATA al Gateway Bridge para mantener la sesión UDP activa

#### Scenario: STAT periódico

- **WHEN** han transcurrido 30 s desde el último STAT
- **THEN** el firmware envía un PUSH_DATA con JSON de estadísticas (`rxnb`, `rxok`, `rxfw`)


### Requirement: Intervalo de envío configurable

El firmware SHALL enviar uplinks cada 10 minutos por defecto. El intervalo
SHALL ser ajustable en tiempo de compilación mediante una constante
`SEND_INTERVAL_MS`.

#### Scenario: Intervalo por defecto

- **WHEN** el firmware se compila sin modificar `SEND_INTERVAL_MS`
- **THEN** los uplinks se envían cada 600 000 ms (10 minutos)

#### Scenario: Intervalo reducido para pruebas

- **WHEN** `SEND_INTERVAL_MS` se reduce a 10 000 ms en tiempo de compilación
- **THEN** los uplinks se envían cada 10 segundos, permitiendo validar el flujo completo sin esperar 10 minutos
