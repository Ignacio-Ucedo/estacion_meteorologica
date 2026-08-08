## 1. Preparación de infraestructura

- [x] 1.1 Levantar el stack de infra: `docker compose -f infra/docker-compose.yml up -d`. Verificar que ChirpStack UI responde en `http://localhost:8080` y que el Gateway Bridge está corriendo. No requiere hardware LoRa.
  `chore(infra): levantar stack AU915 para validación etapa 1`
- [x] 1.2 Correr `python3 infra/chirpstack-provision.py` (con `--gateway-eui` obtenido en el paso 2.1 o sin él para provisionar solo el device). Verificar que el device profile `esp32-sensor-au915` existe en ChirpStack UI y la application `weather-station` tiene el HTTP integration configurado. No requiere hardware LoRa.
  `chore(infra): provisionar ChirpStack AU915 para gateway-node-mock`
- [x] 1.3 Verificar que el backend FastAPI está corriendo y el subscriber paho-mqtt está suscrito al topic de ChirpStack. Revisar logs del backend en busca de `mqtt_connected` o similar. No requiere hardware LoRa.
  `chore(infra): verificar backend MQTT subscriber activo`

## 2. Flash del firmware

- [x] 2.1 Compilar `gateway-node-mock` para el ESP32 desde `firmware/`: `cargo build --bin gateway-node-mock`. Verificar que compila sin errores. Anotar el `gateway_eui` que se imprimirá (se puede calcular de la MAC o esperar al paso 2.3). No requiere hardware LoRa para compilar.
  `build(firmware): compilar gateway-node-mock para validación etapa 1`
- [ ] 2.2 Provisionar NVS del ESP32 con las claves OTAA del mock (`device_id=3`): correr `cargo espflash erase-flash` para limpiar NVS previo, luego flashear el CSV de NVS con `espflash write-bin`. Usar `firmware/nvs_mock.csv` con DevEUI/AppKey distintos a los del nodo real. Requiere ESP32 físico conectado por USB.
  `chore(firmware): provisionar NVS del ESP32 con claves OTAA gateway-node-mock`
- [ ] 2.3 Flashear `gateway-node-mock` en el ESP32: `cargo espflash flash --bin gateway-node-mock`. Abrir monitor serial (`cargo espflash monitor`) y anotar el `gateway_eui` impreso. Verificar que aparece `wifi_connected ip=<IP>`. Requiere ESP32 físico.
  `chore(firmware): flashear gateway-node-mock y verificar arranque WiFi`

## 3. Registro del gateway en ChirpStack

- [ ] 3.1 Registrar el gateway en ChirpStack UI con el EUI obtenido en el paso 2.3 (si no fue provisionado en 1.2). Verificar que el gateway aparece como `Online` en la UI dentro de los 30 s del primer PULL_DATA enviado por el ESP32. Requiere ESP32 corriendo.
  `chore(infra): registrar gateway-node-mock EUI en ChirpStack`

## 4. Validación OTAA y uplinks

- [ ] 4.1 Observar el log serial del ESP32 y confirmar `lorawan_join_ok dev_addr=<...>` dentro de los 30 s. Verificar en ChirpStack UI → Devices → device `gateway-node-mock` que el estado es `active` y `Last seen` se actualizó. Requiere ESP32 corriendo + infra corriendo.
  `test(firmware): verificar OTAA join exitoso gateway-node-mock en ChirpStack`
- [ ] 4.2 Esperar al menos 3 ciclos de uplink (≥ 90 s con SEND_INTERVAL_MS=30 000). Verificar en ChirpStack UI → Device → LoRaWAN frames que los uplinks tienen FCnt incrementando y frecuencia 916.8 MHz. Anotar FCnt inicial y final. Requiere ESP32 corriendo.
  `test(firmware): verificar uplinks AU915 con FCnt incrementando en ChirpStack`
- [ ] 4.3 En ChirpStack UI → Device → Events, abrir un uplink y confirmar que el FRMPayload decodificado tiene 14 bytes, `device_id=3`, `seq` correcto, temperatura en [15.0, 25.0] °C, `bateria_mv=3700`. Requiere al menos un uplink exitoso.
  `test(firmware): verificar estructura del payload 14 bytes en uplink gateway-node-mock`

## 5. Validación backend e InfluxDB

- [ ] 5.1 Consultar InfluxDB y verificar que existen puntos en `weather_reading` con `device_id=3` y timestamp dentro de los últimos 5 min. Comando sugerido: consulta Flux/InfluxQL directa o via la API REST del backend (`GET /readings?device_id=3`). Requiere infra completa corriendo.
  `test(backend): verificar ingesta de lecturas gateway-node-mock en InfluxDB`

## 6. Validación frontend

- [ ] 6.1 Abrir el frontend React en el navegador. Verificar que las métricas de temperatura y humedad muestran valores variables (ciclo triangular, no mock estático). Verificar que no hay errores en consola de DevTools ni en la UI. Requiere frontend corriendo y backend con datos en InfluxDB.
  `test(frontend): verificar visualización de lecturas gateway-node-mock en frontend`

## 7. Documentación de resultados

- [ ] 7.1 Registrar en este change (editar `tasks.md` o agregar `results.md`) los siguientes datos observados: latencia end-to-end observada (timestamp uplink serial → timestamp lectura en frontend), FCnt de inicio y fin de la sesión, cualquier error encontrado y su resolución, versión del firmware flasheado (git commit). Archivar el change al completar.
  `docs(docs): registrar resultados de validación etapa 1 gateway-node-mock`
