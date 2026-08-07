## ADDED Requirements

### Requirement: El nodo completa la activación OTAA con ChirpStack AU915

El firmware del nodo sensor SHALL inicializar el stack `lorawan-device` configurado para AU915 sub-band 2 y completar el proceso de join OTAA con ChirpStack usando DevEUI, AppEUI y AppKey almacenados en NVS antes de comenzar el ciclo de transmisiones.

- Band plan: AU915, sub-band 2 (canales 8–15 upstream 125 kHz + canal 0 upstream 500 kHz + canal 0 downstream 500 kHz).
- Canal fijo PoC: 916.8 MHz SF7BW125 (canal 8, primer canal sub-band 2).

#### Scenario: Activación OTAA exitosa en primer arranque
- **GIVEN** el nodo tiene DevEUI, AppEUI y AppKey correctos en NVS y ChirpStack está disponible en la red con band plan AU915 sub-band 2
- **WHEN** el firmware inicia
- **THEN** el nodo completa el join OTAA (recibe JoinAccept) en 916.8 MHz y registra el evento por serial antes de enviar el primer uplink

#### Scenario: Reintento automático si el join OTAA falla
- **GIVEN** ChirpStack no responde al JoinRequest (gateway sin WiFi o ChirpStack caído)
- **WHEN** el nodo intenta el join OTAA
- **THEN** el firmware reintenta el join con backoff exponencial sin detener la lectura de sensores ni el conteo de pulsos

#### Scenario: Rejoin automático tras pérdida de sesión
- **GIVEN** el nodo pierde la sesión LoRaWAN activa (reinicio o corte de energía)
- **WHEN** el firmware detecta que no tiene sesión válida
- **THEN** el nodo inicia un nuevo proceso de join OTAA automáticamente

---

### Requirement: El nodo transmite uplinks binarios de 14 bytes por LoRaWAN AU915

El firmware del nodo sensor SHALL transmitir uplinks no confirmados cada 10 minutos usando `lorawan-device` configurado para AU915. El FRMPayload SHALL tener exactamente 14 bytes con la siguiente estructura en little-endian:

| Offset | Campo | Tipo | Descripción |
|--------|-------|------|-------------|
| 0 | `device_id` | u8 | Identificador único del nodo (0–255) |
| 1–2 | `seq` | u16 LE | Número de secuencia incremental (wraps en 65535) |
| 3–4 | `temp_c_x100` | i16 LE | Temperatura en °C × 100 (−40.00 a +85.00 °C, res. 0.01 °C) |
| 5–6 | `hum_x100` | u16 LE | Humedad relativa en %RH × 100 (0.00–100.00 %RH, res. 0.01 %RH) |
| 7–8 | `lluvia_pulsos` | u16 LE | Pulsos de pluviómetro acumulados desde uplink anterior |
| 9–10 | `viento_pulsos` | u16 LE | Pulsos de anemómetro acumulados desde uplink anterior |
| 11–12 | `bateria_mv` | u16 LE | Tensión de batería en mV (rango: 0–15 000 mV) |
| 13 | `crc8` | u8 | CRC-8/MAXIM calculado sobre bytes 0–12 |

#### Scenario: Se transmite un uplink periódico
- **GIVEN** el nodo tiene una sesión OTAA activa y han transcurrido 10 minutos desde el último uplink
- **WHEN** el temporizador de transmisión expira
- **THEN** el nodo construye el payload de 14 bytes, lo entrega al stack `lorawan-device` y registra el envío por serial (canal, SF, RSSI del último RX)

#### Scenario: El payload tiene la estructura y tamaño correctos
- **GIVEN** el nodo completó al menos un ciclo de lectura de sensores
- **WHEN** se construye el FRMPayload
- **THEN** el payload tiene exactamente 14 bytes, todos los campos en little-endian, CRC-8/MAXIM sobre bytes 0–12 en byte 13

#### Scenario: Los contadores de pulsos se resetean tras cada uplink
- **GIVEN** el nodo acumuló pulsos de lluvia y/o viento durante el intervalo
- **WHEN** se transmite el uplink
- **THEN** los contadores `lluvia_pulsos` y `viento_pulsos` se reinician a 0 inmediatamente después de construir el payload

---

### Requirement: El nodo mantiene la lectura de sensores ante pérdida de cobertura LoRaWAN

El firmware SHALL continuar leyendo sensores y acumulando pulsos durante períodos sin cobertura. No almacena lecturas no transmitidas en NVS en este cambio (diferido).

#### Scenario: El nodo continúa operando sin cobertura LoRa
- **GIVEN** el gateway no está disponible o fuera de rango
- **WHEN** `lorawan-device` falla al transmitir un uplink
- **THEN** el firmware registra el error por serial, continúa el ciclo de lectura y acumula pulsos para el próximo intento
