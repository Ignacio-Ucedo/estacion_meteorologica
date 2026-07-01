## 1. Firmware — esqueleto y WiFi

- [x] 1.1 Crear `firmware/src/bin/gateway-node-mock.rs`: arrancar con `esp_idf_svc`, conectar WiFi (reusar `connect_wifi()` de `gateway-node.rs`), imprimir `gateway_eui` derivado de MAC WiFi por serial y hacer loop vacío. No requiere hardware adicional al ESP32. Commit sugerido: `feat(firmware): agregar binario gateway-node-mock con WiFi y EUI derivado de MAC`.
- [x] 1.2 Registrar el binario en `firmware/Cargo.toml` bajo `[[bin]]`. Commit incluido en 1.1.
- [x] 1.3 Agregar constantes de compilación: `WIFI_SSID`, `WIFI_PASS`, `CHIRPSTACK_HOST` (via `env!`), `CHIRPSTACK_GW_BRIDGE_PORT = 1700`, `SEND_INTERVAL_MS = 10 * 60 * 1_000`. Commit incluido en 1.1.

## 2. Firmware — UDP Packet Forwarder (uplinks y keepalive)

- [x] 2.1 Reusar `send_push_data()`, `send_pull_data()`, `build_rxpk_json()`, `build_stat_json()` y `random_token()` de `gateway-node.rs` extrayéndolas a `firmware/src/udp_forwarder.rs` (módulo compartido). Commit sugerido: `refactor(firmware): extraer helpers UDP Packet Forwarder a módulo udp_forwarder`.
- [x] 2.2 Actualizar `gateway-node.rs` para importar desde `udp_forwarder` en lugar de tener las funciones inline. Commit incluido en 2.1.
- [x] 2.3 En `gateway-node-mock.rs`: crear `UdpSocket`, enlazar a `0.0.0.0:0`, enviar `PULL_DATA` inicial y arrancar el bucle de keepalive (PULL_DATA cada 10 s, STAT cada 30 s). Commit incluido en 2.1.

## 3. Firmware — OTAA join via UDP (sin Sx1278)

> Los wrappers `lorawan::otaa_join()` y `lorawan::send_uplink()` dependen de
> `Sx1278`. Se usan directamente los submódulos `lorawan::crypto` y
> `lorawan::frame`, que son agnósticos al transporte.

- [x] 3.1 En `gateway-node-mock.rs`: cargar claves OTAA (`DevEUI`, `AppEUI`, `AppKey`) desde NVS usando `nvs::load_otaa_keys()`. Si no hay sesión en NVS, iniciar join. Commit sugerido: `feat(firmware): agregar carga de claves OTAA desde NVS en gateway-node-mock`.
- [x] 3.2 Implementar `join_via_udp(sock, gateway_eui, keys) -> Result<LorawanSession>`: construir JoinRequest con `crypto::join_request_mic()` + `frame::build_join_request()`, enviarlo como RXPK via `send_push_data()`, y esperar PULL_RESP del Gateway Bridge en el socket UDP (timeout 6 s, hasta 5 reintentos con backoff). Commit sugerido: `feat(firmware): implementar OTAA join via UDP en gateway-node-mock`.
- [x] 3.3 Parsear el PULL_RESP de ChirpStack: deserializar JSON `txpk.data` (base64), aplicar `crypto::decrypt_join_accept()` + `crypto::verify_join_accept_mic()` + `frame::parse_join_accept()` + `crypto::derive_session_keys()` para obtener la `LorawanSession`. Enviar `TX_ACK` (tipo `0x05`) al Gateway Bridge como ACK del downlink. Commit incluido en 3.2.
- [x] 3.4 Persistir la `LorawanSession` en NVS tras join exitoso y restaurarla al arrancar (reusar el mecanismo de `sensor-node-mock.rs`). Commit incluido en 3.2.

## 4. Firmware — generación de datos y construcción de frames

- [x] 4.1 Reusar `MockEnvironmentSensor` de `sensors.rs` y `generate_reading()` equivalente (ciclo triangular 15–25 °C, humedad correlacionada, pulsos basados en `seq`, `battery_mv = 3700`). `device_id = 3`. Commit sugerido: `feat(firmware): agregar generación de lecturas sintéticas en gateway-node-mock`.
- [x] 4.2 Implementar `build_lorawan_frame(session, payload) -> Vec<u8>`: cifrar FRMPayload con `crypto::encrypt_frm_payload()`, calcular MIC con `crypto::uplink_mic()`, construir trama con `frame::build_uplink()`. Commit incluido en 4.1.
- [x] 4.3 En el bucle principal: cada `SEND_INTERVAL_MS` llamar a `build_binary()` de `payload.rs`, pasarlo a `build_lorawan_frame()`, envolver en RXPK y llamar a `send_push_data()`. Incrementar `seq` y persistir en NVS. Commit incluido en 4.1.

## 5. Infraestructura — setup ChirpStack

- [x] 5.1 Documentar en `infra/SETUP.md`: registro del gateway con EUI derivado de la MAC WiFi del ESP32, device profile EU433 para el mock, device con `device_id=3` y claves OTAA propias, provisionado de claves en NVS con `nvs-provision`. No requiere hardware SX1278. Commit sugerido: `docs(infra): documentar setup ChirpStack y provisionado NVS para gateway-node-mock`.

## 6. Validación (requiere ESP32 + docker-compose up)

- [ ] 6.1 Flashear `gateway-node-mock` en un ESP32, confirmar conexión WiFi, envío de PULL_DATA y PUSH_DATA de join por serial. No requiere SX1278. Commit sugerido: ninguno (validación sin código).
- [ ] 6.2 Verificar join OTAA exitoso: el log de ChirpStack debe mostrar el JoinAccept enviado y el log del firmware debe mostrar `lorawan_join_ok dev_addr=…`. Requiere ChirpStack corriendo y device registrado.
- [ ] 6.3 Verificar uplinks end-to-end: esperar al menos 2 uplinks, confirmar que aparecen en `GET /api/stations` con `device_id=3` y valores de temperatura/humedad variables.
- [ ] 6.4 Verificar reconexión WiFi: `docker compose restart` del AP (o usar un punto de acceso controlado), confirmar que el firmware reconecta y los uplinks se reanudan sin reiniciar el ESP32.
