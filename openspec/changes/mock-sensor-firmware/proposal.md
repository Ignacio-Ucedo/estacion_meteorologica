## Why

El nodo sensor real (ESP32 + DHT22 + pluviómetro + anemómetro) no puede
validarse en banco porque los sensores físicos todavía no están soldados. El
binario `sensor-node` actual envía valores centinela (`i16::MIN`) dado que
`UnwiredEnvironmentSensor` siempre falla. Para poder ejercitar el flujo
LoRaWAN completo (nodo → gateway → ChirpStack → backend → InfluxDB) sin
hardware de sensores, se necesita un nodo que genere datos plausibles y
transmita uplinks reales por LoRaWAN.

## What Changes

- Nuevo binario `sensor-node-mock` (firmware/src/bin/sensor-node-mock.rs):
  usa el stack LoRaWAN completo (OTAA, payload binario de 14 bytes, CRC-8)
  pero con datos simulados deterministicos en lugar de lecturas GPIO reales.
- `MockEnvironmentSensor` en `sensors.rs`: genera temperatura y humedad con
  un ciclo diario triangular de 144 pasos (≈ 24 h a 10 min/ciclo). Sin GPIO.
- Pulsos simulados basados en `seq` (sin ISR de reed switch ni anemómetro).
- `device_id = 2` para distinguirlo del nodo real (`device_id = 1`) en
  InfluxDB y en los logs del gateway.
- Mismo mecanismo de claves OTAA por NVS que el nodo real. El mock necesita
  ser registrado como dispositivo separado en ChirpStack.
- El gateway (`gateway-node`) es completamente agnóstico al mock.

## Capabilities

### New Capabilities

- `mock-sensor-node`: nodo LoRaWAN que simula lecturas de sensores (sin GPIO
  físico), apto para validación de banco del stack completo.

### Modified Capabilities

_(ninguna)_

## Impact

- **Firmware** (`firmware/`): nuevo binario y nueva struct en sensors.rs.
  Sin impacto en `sensor-node` ni en `gateway-node`.
- **Impacto energético**: idéntico al nodo real (mismo stack LoRaWAN, mismo
  intervalo de 10 min). Pensado para desarrollo en banco conectado a USB, no
  para despliegue en campo.
- **Cambios de formato LoRa**: ninguno. El payload binario de 14 bytes es
  idéntico; solo cambia `device_id` y los valores de los campos.
- **Rollback**: eliminar el binario y la struct MockEnvironmentSensor.
  Sin impacto en nodo real ni en gateway.
- **Backend, frontend, Android, 3D, docs**: sin cambios.

## Rollback Plan

Eliminar `firmware/src/bin/sensor-node-mock.rs` y revertir `sensors.rs`.
No hay firmware desplegado en campo; el rollback no afecta a nada en
producción.
