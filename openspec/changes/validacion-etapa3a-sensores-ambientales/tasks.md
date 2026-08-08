# Tasks: validacion-etapa3a-sensores-ambientales

## 0. Prerrequisitos

- [ ] 0.1 Confirmar que el driver DHT22 y el driver ADC de batería están implementados en `firmware-sensor-drivers` y que el binario `sensor-node` compila sin errores. Sin esto el resto está bloqueado. No requiere hardware.
  `chore(firmware): verificar prerequisito firmware-sensor-drivers antes de etapa 3a`

- [ ] 0.2 Resolver OQ1 (GPIO para DHT22) y OQ2 (canal ADC para batería). Actualizar `hardware/netlist.md` con los pines definitivos. Requiere revisar el netlist y el datasheet del ESP32.
  `docs(hardware): definir y documentar GPIO DHT22 y canal ADC batería en netlist`

## 1. Soldadura y verificación de hardware

- [ ] 1.1 Soldar el DHT22 al nodo: VCC→3.3V, GND→GND, DATA→GPIO (según OQ1), pull-up 10 kΩ entre DATA y VCC. Verificar continuidad con multímetro antes de encender. Requiere hardware físico.
  `chore(hardware): soldar DHT22 al nodo sensor con pull-up 10kΩ`

- [ ] 1.2 Soldar el divisor de tensión para ADC de batería: R1=100 kΩ entre VBat y ADC pin, R2=100 kΩ entre ADC pin y GND. Verificar con multímetro que la tensión en el pin ADC es ~2.1 V con batería cargada (4.2 V). Requiere hardware físico.
  `chore(hardware): soldar divisor de tensión ADC batería al nodo sensor`

## 2. Verificación de lecturas por serial (sin LoRa)

- [ ] 2.1 Flashear `sensor-node` con log verbose habilitado. En el monitor serial, verificar 3 lecturas consecutivas del DHT22 sin error de checksum. Anotar los valores de temperatura y compararlos contra un termómetro de referencia (diferencia esperada ≤ 1.0 °C). Requiere hardware físico.
  `test(firmware): verificar lecturas DHT22 por serial sin error de checksum`

- [ ] 2.2 Verificar lectura ADC de batería por serial: anotar el valor de `bateria_mv` y compararlo contra la tensión medida con multímetro directamente en los bornes de la batería. Diferencia esperada ≤ 100 mV. Requiere hardware físico.
  `test(firmware): verificar lectura ADC batería contra multímetro`

## 3. Validación end-to-end con LoRa

- [ ] 3.1 Con el gateway real corriendo (firmware `gateway-node`), esperar el OTAA join del nodo sensor real (device_id=1). Verificar en ChirpStack UI que el device aparece activo. Requiere ambos ESP32 + infra corriendo.
  `test(firmware): verificar OTAA join sensor-node real en ChirpStack etapa 3a`

- [ ] 3.2 Esperar 3 uplinks consecutivos. Verificar en InfluxDB que los puntos tienen `device_id=1`, `temp_c` correspondiente al ambiente real, `humidity_rh` real, `battery_mv` en rango LiPo, `lluvia_pulsos=0`, `viento_pulsos=0`. Requiere infra completa corriendo.
  `test(backend): verificar lecturas reales DHT22 y ADC en InfluxDB etapa 3a`

- [ ] 3.3 Verificar en el frontend React que las métricas de temperatura y humedad muestran los valores reales del ambiente (no el ciclo triangular sintético). Requiere frontend corriendo.
  `test(frontend): verificar lecturas reales DHT22 visibles en frontend etapa 3a`

## 4. Documentación de resultados

- [ ] 4.1 Registrar: valores de temperatura DHT22 vs. referencia, humedad DHT22 vs. referencia, tensión batería ADC vs. multímetro, FCnt de inicio y fin de la sesión, cualquier problema y su resolución. Archivar el change al completar.
  `docs(docs): registrar resultados validación sensores ambientales etapa 3a`
