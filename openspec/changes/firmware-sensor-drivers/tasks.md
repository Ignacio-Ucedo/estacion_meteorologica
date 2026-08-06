## 1. Preparación y prerrequisitos de campo

- [ ] 1.1 Medir pinout del cable XLR 5p hembra del DHT22 con multímetro: identificar VCC, GND y DATA entre los 5 pines; los 2 NC no deben conectarse. Documentar resultado en `hardware/netlist.md`. (**Prerrequisito bloqueante** para tarea 2.x — no implementar hasta resolver OQ1.)
  `docs(hardware): documentar pinout XLR 5p DHT22 nodo sensor`
- [ ] 1.2 Medir el tipo de salida del anemómetro con multímetro: verificar si es NPN open-collector (confirma pull-up R5 10 kΩ poblada) o push-pull (R5 DNP). Documentar en `hardware/netlist.md`. (**Prerrequisito bloqueante** para tarea 3.3 — no conectar ISR hasta resolver OQ2.)
  `docs(hardware): documentar tipo de salida anemómetro y estado R5`

## 2. Driver DHT22 (GPIO4) — requiere hardware real

- [ ] 2.1 Agregar dependencia `esp-idf-hal` RMT en `Cargo.toml` de `firmware/` para lectura DHT22. Verificar que no haya conflicto de versión con `esp-idf-hal` existente.
  `chore(firmware): agregar soporte RMT para driver DHT22`
- [ ] 2.2 Implementar `Dht22EnvironmentSensor` en `weather-core/src/sensors.rs` bajo feature flag `hardware`: protocolo 1-wire DHT22 vía RMT, con timeout explícito y verificación CRC. Devuelve `Err(SensorError::Dht22Unavailable)` en timeout y `Err(SensorError::InvalidReading)` en CRC inválido. El campo `pressure_hpa` se fija en `0.0`.
  `feat(firmware): implementar Dht22EnvironmentSensor vía RMT en GPIO4`
- [ ] 2.3 Reemplazar `UnwiredEnvironmentSensor` por `Dht22EnvironmentSensor` en `firmware/src/bin/sensor-node.rs` cuando feature `hardware` está activa; mantener `MockEnvironmentSensor` para feature `mock-sensors`.
  `feat(firmware): conectar Dht22EnvironmentSensor en sensor-node`
- [ ] 2.4 Validar en hardware: flashear sensor-node, observar log serial con `idf.py monitor`. Confirmar lecturas de temperatura y humedad plausibles (±1 °C y ±3 %RH respecto a referencia). Confirmar que el firmware continúa si se desconecta el DHT22 durante la ejecución. **Requiere hardware real.**
  `test(firmware): validar driver DHT22 en banco con hardware`

## 3. ISRs de contadores de pulsos — requieren hardware real

- [ ] 3.1 Registrar ISR edge-falling en GPIO32 (pull-up interno ESP32) conectada a `PulseCounters::record_rain_pulse()` en `firmware/src/bin/sensor-node.rs`. Implementar debounce de 50 ms con timestamp atómico en el handler.
  `feat(firmware): conectar ISR pluviómetro GPIO32 con debounce 50 ms`
- [ ] 3.2 Validar ISR pluviómetro en hardware: simular pulsos manuales con cable volante en GPIO32 y verificar incremento de `lluvia_pulsos` en el log y en el payload del siguiente uplink. **Requiere hardware real.**
  `test(firmware): validar ISR pluviómetro GPIO32 en banco`
- [ ] 3.3 *(Bloqueado por 1.2)* Registrar ISR edge-falling en GPIO33 conectada a `PulseCounters::record_wind_pulse()`, con debounce de 50 ms. Configurar pull-up interno o externo según tipo de salida confirmado en tarea 1.2.
  `feat(firmware): conectar ISR anemómetro GPIO33 con debounce 50 ms`
- [ ] 3.4 Validar ISR anemómetro en hardware: simular pulsos manuales en GPIO33 y verificar `viento_pulsos`. **Requiere hardware real.**
  `test(firmware): validar ISR anemómetro GPIO33 en banco`

## 4. ADC de batería (GPIO35) — requiere hardware real

- [ ] 4.1 Implementar función `read_battery_mv()` en `firmware/src/` que lee ADC1 en GPIO35 con atenuación 11 dB y aplica el factor de conversión (ratio divisor 0.248): `bat_mv = raw_mv / 0.248`. Retornar 0 en caso de error de periférico.
  `feat(firmware): leer ADC batería GPIO35 con divisor R1/R2`
- [ ] 4.2 Integrar `read_battery_mv()` en el loop de `sensor-node.rs` reemplazando el placeholder `bateria_mv = 0`.
  `feat(firmware): integrar lectura batería en loop sensor-node`
- [ ] 4.3 Validar en hardware: medir voltaje real de la batería con multímetro de referencia y comparar con `bateria_mv` reportado en log. Calcular y documentar offset de corrección ADC en `firmware/src/config.rs` si el error supera 100 mV. **Requiere hardware real.**
  `test(firmware): calibrar offset ADC batería vs multímetro referencia`

## 5. Integración y validación end-to-end — requiere hardware real

- [ ] 5.1 Validar uplink completo con todos los subsistemas activos: temperatura, humedad, lluvia, viento y batería con valores reales en el payload. Verificar en ChirpStack que el payload decodificado contiene los campos correctos y que el CRC-8/MAXIM es válido.
  `test(firmware): validar uplink LoRaWAN con sensores reales end-to-end`
- [ ] 5.2 Actualizar `hardware/netlist.md` con los pinouts definitivos confirmados en campo (DHT22, pluviómetro, anemómetro, ADC batería) y el factor de corrección ADC si aplica.
  `docs(hardware): actualizar netlist con pinouts confirmados y corrección ADC`
