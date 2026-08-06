## 1. Infraestructura (ChirpStack + InfluxDB)

- [x] 1.1 Crear `infra/docker-compose.yml` con ChirpStack v4 configurado para band plan EU433, Mosquitto y InfluxDB. Commit sugerido: `chore(infra): agregar docker-compose con ChirpStack EU433 Mosquitto e InfluxDB`.
- [x] 1.2 Registrar gateway ESP32 en ChirpStack con el EUI del hardware (generar GatewayEUI único). Requiere ChirpStack corriendo en Docker. Commit sugerido: `chore(infra): documentar registro de gateway en ChirpStack EU433`.
- [x] 1.3 Registrar dispositivo nodo en ChirpStack: generar DevEUI, AppEUI, AppKey; crear Application y Device Profile con OTAA y EU433. Requiere hardware ESP32 con firmware previo para leer DevEUI fijo o generar uno. Commit sugerido: `chore(infra): documentar registro de nodo OTAA en ChirpStack`.

## 2. Firmware del Nodo Sensor (LoRaWAN EU433)

- [x] 2.1 Agregar dependencia LMIC al firmware del nodo (`arduino-lmic` o equivalente para ESP-IDF) y configurar región EU433 (`LMIC_REGION_eu433`). Requiere prueba de compilación; commit sugerido: `feat(firmware): integrar stack LMIC para LoRaWAN EU433`.
- [x] 2.2 Almacenar DevEUI, AppEUI y AppKey en NVS del ESP32; leerlos al iniciar y pasarlos al stack LMIC. Requiere ESP32 físico con NVS; commit sugerido: `feat(firmware): almacenar claves OTAA en NVS`.
- [x] 2.3 Implementar flujo de join OTAA con reintento automático con backoff exponencial; registrar eventos de join por serial. Requiere ChirpStack activo y nodo físico con gateway; commit sugerido: `feat(firmware): implementar join OTAA con reintento`.
- [x] 2.4 Implementar serialización del FRMPayload binario de 14 bytes (little-endian) con los campos definidos en la spec `lorawan-node` y CRC-8/MAXIM sobre los primeros 13 bytes. Requiere prueba con valores conocidos por serial; commit sugerido: `feat(firmware): serializar payload binario de 14 bytes con CRC8`.
- [x] 2.5 Implementar ciclo de transmisión: construir payload, entregar a LMIC, resetear contadores de pulsos, esperar 10 minutos. Requiere sesión OTAA activa; commit sugerido: `feat(firmware): transmitir uplink LoRaWAN cada 10 minutos`.
- [x] 2.6 Verificar que el nodo continúa leyendo sensores y acumulando pulsos durante fallo de transmisión LoRa. Requiere prueba con gateway apagado; commit sugerido: `fix(firmware): continuar lectura de sensores ante fallo LoRa`.

## 3. Firmware del Gateway (Single-Channel Packet Forwarder)

- [x] 3.1 Implementar inicialización SX1278 en modo escucha continua en 433.175 MHz SF7BW125 sobre SPI en el ESP32 gateway. Requiere hardware físico; commit sugerido: `feat(gateway): configurar SX1278 en escucha LoRa 433.175 MHz SF7BW125`.
- [x] 3.2 Implementar el protocolo Semtech UDP Packet Forwarder (mensajes PUSH_DATA, PULL_DATA, PULL_RESP) para reenviar tramas LoRaWAN recibidas a ChirpStack. Requiere WiFi activo y ChirpStack corriendo; commit sugerido: `feat(gateway): implementar single-channel UDP packet forwarder hacia ChirpStack`.
- [x] 3.3 Implementar heartbeat de estadísticas PUSH_DATA cada 30 segundos hacia ChirpStack (campos rxnb, rxok, txnb). Commit sugerido: `feat(gateway): enviar heartbeat de estadisticas a ChirpStack`.
- [x] 3.4 Implementar reconexión WiFi automática sin reinicio del dispositivo; registrar pérdidas y restauraciones de conectividad por serial. Requiere prueba con corte de WiFi; commit sugerido: `feat(gateway): reconexion automatica de WiFi`.
- [x] 3.5 Registrar por serial RSSI, SNR, tamaño y contenido hexadecimal de cada paquete LoRa recibido (válido o no). Commit sugerido: `feat(gateway): registrar metadata de paquetes LoRa por serial`.

## 4. Validación de Banco

- [ ] 4.1 Validar flujo completo de extremo a extremo: nodo → LoRaWAN → gateway → ChirpStack → MQTT → FastAPI → InfluxDB. Requiere ambos ESP32 físicos, ChirpStack y FastAPI corriendo. Commit sugerido: `test(firmware): validar flujo extremo a extremo LoRaWAN EU433`.
- [ ] 4.2 Verificar que el payload almacenado en InfluxDB coincide con los valores leídos por el nodo (temperatura, humedad, contadores de pulsos). Requiere prueba con sensores físicos.
- [ ] 4.3 Verificar que el nodo completa el join OTAA exitosamente y que ChirpStack registra el dispositivo activo.
- [ ] 4.4 Verificar comportamiento ante pérdida de WiFi del gateway: el nodo continúa transmitiendo, el gateway registra paquetes por serial, se reanuda el reenvío al restaurar WiFi.

## 6. Documentación

- [x] 6.1 Actualizar `openspec/config.yaml` (bloque de stack tecnológico): reemplazar descripción de LoRa P2P por LoRaWAN EU433 con ChirpStack, documentar decisión de mantener SX1278 y limitación de single-channel gateway. Commit sugerido: `docs(docs): actualizar config.yaml con stack LoRaWAN EU433 y SX1278`.
- [x] 6.2 Actualizar `CLAUDE.md` (sección de arquitectura): reflejar topología LoRaWAN estrella, EU433, ChirpStack, single-channel gateway como limitación de prototipo. Commit sugerido: `docs(docs): actualizar CLAUDE.md con arquitectura LoRaWAN EU433`.
