## ADDED Requirements

### Requirement: El nodo completa la activación OTAA al iniciar

El firmware del nodo sensor SHALL inicializar el stack LMIC y completar el proceso de join OTAA con ChirpStack usando DevEUI, AppEUI y AppKey almacenados en NVS antes de comenzar el ciclo de lecturas y transmisiones.

#### Scenario: Activación OTAA exitosa en primer arranque
- **GIVEN** el nodo tiene DevEUI, AppEUI y AppKey correctos en NVS y ChirpStack está disponible en la red
- **WHEN** el firmware inicia
- **THEN** el nodo completa el join OTAA (recibe JoinAccept) y registra el evento por serial antes de enviar el primer uplink

#### Scenario: Reintento automático si el join OTAA falla
- **GIVEN** ChirpStack no responde al JoinRequest (gateway sin WiFi o ChirpStack caído)
- **WHEN** el nodo intenta el join OTAA
- **THEN** el firmware reintenta el join con backoff exponencial sin detener la lectura de sensores

#### Scenario: Rejoin automático tras pérdida de sesión
- **GIVEN** el nodo pierde la sesión LoRaWAN activa (reinicio, corte de energía prolongado)
- **WHEN** el firmware detecta que no tiene sesión válida
- **THEN** el nodo inicia un nuevo proceso de join OTAA automáticamente

---

### Requirement: El nodo transmite uplinks binarios de campos fijos por LoRaWAN AU915

El firmware del nodo sensor SHALL transmitir uplinks no confirmados cada 10 minutos usando el stack LMIC configurado para AU915 sub-banda 2. El FRMPayload SHALL tener exactamente 14 bytes con la siguiente estructura en little-endian:

| Offset | Campo | Tipo | Descripción |
|--------|-------|------|-------------|
| 0 | `device_id` | u8 | Identificador único del nodo (0–255) |
| 1–2 | `seq` | u16 LE | Número de secuencia incremental (wraps en 65535) |
| 3–4 | `temp_c_x100` | i16 LE | Temperatura en °C × 100 (rango: −40.00 a +85.00 °C, resolución 0.01 °C) |
| 5–6 | `hum_x100` | u16 LE | Humedad relativa en %RH × 100 (rango: 0.00–100.00 %RH, resolución 0.01 %RH) |
| 7–8 | `lluvia_pulsos` | u16 LE | Pulsos de pluviómetro acumulados desde el uplink anterior |
| 9–10 | `viento_pulsos` | u16 LE | Pulsos de anemómetro acumulados desde el uplink anterior |
| 11–12 | `bateria_mv` | u16 LE | Tensión de batería en mV (rango: 0–4200 mV) |
| 13 | `crc8` | u8 | CRC-8/MAXIM calculado sobre bytes 0–12 |

#### Scenario: Se transmite un uplink periódico
- **GIVEN** el nodo tiene una sesión OTAA activa y han transcurrido 10 minutos desde el último uplink
- **WHEN** el temporizador de transmisión expira
- **THEN** el nodo construye el payload de 14 bytes, lo entrega al stack LMIC y registra el envío por serial

#### Scenario: El payload contiene los campos en el orden y tamaño correctos
- **GIVEN** el nodo completó al menos un ciclo de lectura de sensores
- **WHEN** se construye el FRMPayload
- **THEN** el payload tiene exactamente 14 bytes en el orden definido, con todos los campos codificados en little-endian y el CRC8 calculado sobre los primeros 13 bytes

#### Scenario: Los contadores de pulsos se resetean tras cada uplink
- **GIVEN** el nodo acumuló pulsos de lluvia y/o viento durante el intervalo entre uplinks
- **WHEN** se transmite el uplink
- **THEN** los contadores `lluvia_pulsos` y `viento_pulsos` se reinician a 0 inmediatamente después de construir el payload

#### Scenario: El nodo respeta el duty cycle de AU915
- **GIVEN** el stack LMIC está configurado para AU915
- **WHEN** el nodo transmite uplinks cada 10 minutos
- **THEN** LMIC no bloquea la transmisión por duty cycle (el intervalo de 10 minutos es compatible con el 1% de duty cycle de AU915 para el tiempo de aire de 14 bytes en SF7BW125)

---

### Requirement: El nodo maneja pérdida de cobertura LoRaWAN sin detener la lectura de sensores

El firmware del nodo SHALL continuar leyendo sensores y acumulando contadores de pulsos durante períodos sin cobertura LoRaWAN. No SHALL almacenar lecturas no transmitidas en memoria no volátil en este cambio (diferido a cambio futuro).

#### Scenario: El nodo continúa operando sin cobertura LoRa
- **GIVEN** el gateway no está disponible o fuera de rango
- **WHEN** LMIC falla al transmitir un uplink
- **THEN** el firmware registra el error por serial, continúa el ciclo de lectura de sensores y acumula pulsos para el próximo intento de transmisión
