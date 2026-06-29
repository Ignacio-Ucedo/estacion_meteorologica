## 1. Firmware

- [x] 1.1 Agregar `MockEnvironmentSensor` a `firmware/src/sensors.rs`: ciclo
  triangular de temperatura 15–25°C, humedad inversamente correlacionada.
  Sin GPIO. Commit sugerido: `feat(firmware): agregar MockEnvironmentSensor con ciclo diario simulado`.
- [x] 1.2 Crear `firmware/src/bin/sensor-node-mock.rs`: usa `MockEnvironmentSensor`,
  pulsos basados en `seq`, `device_id=2`, mismo stack LoRaWAN y NVS que el
  nodo real. No requiere hardware de sensores. Commit sugerido:
  `feat(firmware): agregar binario sensor-node-mock para pruebas sin sensores`.
- [x] 1.3 Registrar el binario `sensor-node-mock` en `firmware/Cargo.toml`.
  Commit incluido en 1.2.

## 2. Infraestructura

- [x] 2.1 Documentar en `infra/SETUP.md` el registro de un segundo dispositivo
  en ChirpStack para el mock (DevEUI/AppEUI/AppKey distintos, `device_id=2`)
  y el provisioning de NVS. Requiere ChirpStack corriendo. Commit sugerido:
  `docs(infra): documentar registro y provisioning del sensor-node-mock`.

## 3. Validación

- [ ] 3.1 Flashear `sensor-node-mock` en un ESP32, confirmar join OTAA exitoso
  y uplinks visibles en ChirpStack con `device_id=2`. Requiere hardware ESP32
  + SX1278 + gateway corriendo.
- [ ] 3.2 Verificar que los uplinks del mock llegan a InfluxDB con temperatura
  y humedad variables y CRC válido. Requiere stack de infra completo.
