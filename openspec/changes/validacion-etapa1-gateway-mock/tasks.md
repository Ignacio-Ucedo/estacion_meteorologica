## 1. Preparación de infraestructura

- [x] 1.1 Levantar el stack de infra: `docker compose -f infra/docker-compose.yml up -d`. Verificar que ChirpStack UI responde en `http://localhost:8080` y que el Gateway Bridge está corriendo. No requiere hardware LoRa.
  `chore(infra): levantar stack AU915 para validación etapa 1`
- [x] 1.2 Correr `python3 infra/chirpstack-provision.py` (con `--gateway-eui` obtenido en el paso 2.1 o sin él para provisionar solo el device). Verificar que el device profile `esp32-sensor-au915` existe en ChirpStack UI y la application `weather-station` tiene el HTTP integration configurado. No requiere hardware LoRa.
  `chore(infra): provisionar ChirpStack AU915 para gateway-node-mock`
- [x] 1.3 Verificar que el backend FastAPI está corriendo y el subscriber paho-mqtt está suscrito al topic de ChirpStack. Revisar logs del backend en busca de `mqtt_connected` o similar. No requiere hardware LoRa.
  `chore(infra): verificar backend MQTT subscriber activo`

## 2. Iniciar el Gateway Virtual (Operator App)

- [x] 2.1 Compilar `gateway-node-mock` para el ESP32 desde `firmware/`: `cargo build --bin gateway-node-mock`. Verificar que compila sin errores. No requiere hardware LoRa para compilar.
  `build(firmware): compilar gateway-node-mock para validación etapa 1`
- [ ] 2.2 Abrir la Operator App en modo Gateway Virtual: `cd operator-app && cargo tauri dev`. En el panel "Gateway Virtual", clic en "Cargar desde nvs_mock.csv" → navegar a `firmware/nvs_mock.csv`. Verificar que DevEUI y AppKey se completan automáticamente. Confirmar que "ChirpStack host" es `127.0.0.1:1700`. No requiere ESP32.
  `chore(infra): abrir Operator App y cargar claves OTAA del mock`
- [ ] 2.3 Clic en ▶ Iniciar en el panel Gateway Virtual. Verificar en el log de la app que aparecen `PULL_DATA → 127.0.0.1:1700`, `JoinRequest enviado attempt=1` y `JoinAccept ok dev_addr=[...]`. El gateway_eui del Virtual Gateway es siempre `aabbccfffeddeeff`. No requiere ESP32.
  `chore(firmware): iniciar gateway virtual y verificar arranque`

## 3. Registro del gateway en ChirpStack

- [ ] 3.1 Registrar el gateway `aabbccfffeddeeff` en ChirpStack si no fue registrado en el paso 1.2 (re-correr `python3 infra/chirpstack-provision.py --gateway-eui aabbccfffeddeeff --backend-url http://localhost:8000`, o manualmente: Gateways → Add gateway → ID = `aabbccfffeddeeff`). Verificar que el gateway aparece como `Online` en la UI dentro de los 30 s del primer PULL_DATA. No requiere ESP32.
  `chore(infra): registrar gateway virtual aabbccfffeddeeff en ChirpStack`

## 4. Validación OTAA y uplinks

- [ ] 4.1 Observar el log de la Operator App y confirmar `JoinAccept ok dev_addr=[...]` dentro de los 30 s. Verificar en ChirpStack UI → Devices → device `gateway-node-mock` que el estado es `active` y `Last seen` se actualizó. No requiere ESP32.
  `test(firmware): verificar OTAA join exitoso gateway-node-mock en ChirpStack`
- [ ] 4.2 Esperar al menos 3 ciclos de uplink (≥ 90 s con intervalo=30 s). Verificar en ChirpStack UI → Device → LoRaWAN frames que los uplinks tienen FCnt incrementando y frecuencia 916.8 MHz. Anotar FCnt inicial y final. No requiere ESP32.
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

- [ ] 7.1 Registrar en este change (agregar `results.md`) los siguientes datos observados: latencia end-to-end observada (timestamp uplink en log Operator App → timestamp lectura visible en frontend), FCnt de inicio y fin de la sesión, cualquier error encontrado y su resolución. Archivar el change al completar.
  `docs(docs): registrar resultados de validación etapa 1 gateway-node-mock`
