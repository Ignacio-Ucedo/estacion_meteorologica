### Requirement: Arranque y conectividad WiFi del gateway-node-mock

El firmware `gateway-node-mock` flasheado en el ESP32 SHALL conectarse a la red WiFi configurada, obtener IP por DHCP e imprimir por serial el `gateway_eui` (8 bytes derivados de la MAC WiFi, formato hex) antes de intentar ninguna operación LoRaWAN o UDP. El EUI SHALL ser estable entre reinicios para el mismo dispositivo.

#### Scenario: WiFi conectado y EUI impreso al arrancar

- **WHEN** el ESP32 arranca con SSID/contraseña correctos y el AP está disponible
- **THEN** el log serial muestra `wifi_connected ip=<IP>` y `gateway_eui=<16 hex chars>` dentro de los primeros 10 segundos

#### Scenario: gateway_eui estable entre reinicios

- **WHEN** el ESP32 se reinicia sin cambios de hardware
- **THEN** el `gateway_eui` impreso es idéntico al del arranque anterior


### Requirement: OTAA join exitoso via UDP

El firmware SHALL realizar el proceso OTAA con ChirpStack usando las claves DevEUI/AppEUI/AppKey cargadas desde NVS (`device_id=3`), inyectando el JoinRequest como RXPK via UDP al ChirpStack Gateway Bridge. El join SHALL completarse en menos de 30 segundos desde el envío del primer JoinRequest.

#### Scenario: JoinAccept recibido y sesión establecida

- **WHEN** el device está registrado en ChirpStack con device profile `esp32-sensor-au915` y las claves OTAA coinciden
- **THEN** el log serial muestra `lorawan_join_ok dev_addr=<...>` y ChirpStack UI muestra el device con estado activo y `Last seen` reciente

#### Scenario: Sesión OTAA persistida en NVS

- **WHEN** el ESP32 se reinicia después de un join exitoso
- **THEN** el firmware restaura la sesión desde NVS (`lorawan_session_restored`) sin realizar un nuevo join, y el FCnt continúa desde donde quedó


### Requirement: Uplinks sintéticos AU915 visibles en ChirpStack

El firmware SHALL generar lecturas sintéticas con ciclo triangular de temperatura (15–25 °C, resolución 0.01 °C) y humedad inversamente correlacionada (resolución 0.01 %), construir frames LoRaWAN cifrados con AppSKey y MIC con NwkSKey, empaquetarlos como RXPK con `freq=916.8 MHz`, `datr="SF7BW125"`, `codr="4/5"` y enviarlos al Gateway Bridge cada `SEND_INTERVAL_MS` (30 000 ms en modo test).

#### Scenario: Uplink visible en ChirpStack UI con FCnt incrementando

- **WHEN** la sesión OTAA está activa y han transcurrido 30 s desde el último envío
- **THEN** ChirpStack UI muestra un nuevo uplink para el device con FCnt mayor al anterior, FPort=2, frecuencia 916.8 MHz, SF7BW125

#### Scenario: Payload binario 14 bytes correctamente estructurado

- **WHEN** ChirpStack recibe y descifra el uplink
- **THEN** el FRMPayload tiene exactamente 14 bytes con estructura: device_id=3 (byte 0), seq u16 LE (bytes 1-2), temp_c*100 i16 LE (bytes 3-4), hum*100 u16 LE (bytes 5-6), lluvia_pulsos u16 LE (bytes 7-8), viento_pulsos u16 LE (bytes 9-10), bateria_mv u16 LE (bytes 11-12), crc8 (byte 13)

#### Scenario: seq incrementa monotónicamente y batería constante

- **WHEN** se observan N uplinks consecutivos (N ≥ 3)
- **THEN** el campo `seq` incrementa de 1 en 1 en cada uplink y `bateria_mv = 4200` en todos


### Requirement: Ingesta en InfluxDB y visibilidad en frontend

Las lecturas descifradas por ChirpStack SHALL llegar al backend FastAPI via HTTP webhook (POST a `/integrations/chirpstack/uplink`), ser almacenadas en InfluxDB en el measurement `weather_reading` con los tags `device_id` y `dev_eui`, y ser visibles en el frontend React dentro de los 60 segundos posteriores al uplink.

#### Scenario: Lectura almacenada en InfluxDB con campos correctos

- **WHEN** el backend recibe el evento HTTP de un uplink exitoso
- **THEN** InfluxDB contiene un punto en `weather_reading` con `device_id=3`, `temp_c` en rango [15.0, 25.0], `humidity_rh` en rango [0.0, 100.0], `battery_mv=4200` y timestamp dentro de los últimos 60 s

#### Scenario: Frontend muestra lecturas en tiempo real

- **WHEN** han llegado al menos 3 uplinks exitosos al backend
- **THEN** el frontend React muestra los valores de temperatura y humedad actualizados, sin errores visibles en consola del navegador ni en la UI
