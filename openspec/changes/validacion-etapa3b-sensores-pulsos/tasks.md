# Tasks: validacion-etapa3b-sensores-pulsos

## 0. Prerrequisitos

- [ ] 0.1 Confirmar que los drivers de ISR (pluviómetro y anemómetro) en `firmware-sensor-drivers` y el driver de veleta en `veleta-wind-direction` están implementados y el binario `sensor-node` compila con todos los sensores activos. Sin esto el resto está bloqueado.
  `chore(firmware): verificar prerequisitos firmware-sensor-drivers y veleta antes de etapa 3b`
- [ ] 0.2 Resolver OQ1 (GPIOs para ISR pluviómetro y anemómetro) y OQ2 (formato de payload para veleta). Actualizar `hardware/netlist.md` con los pines definitivos.
  `docs(hardware): definir GPIOs ISR sensores de pulsos y veleta en netlist`

## 1. Soldadura y verificación del pluviómetro

- [ ] 1.1 Conectar el pluviómetro (reed switch) al GPIO ISR definido en OQ1 con pull-up interno habilitado en el firmware. Verificar continuidad del cable con multímetro. Requiere hardware físico.
  `chore(hardware): conectar pluviómetro al nodo sensor con pull-up GPIO`
- [ ] 1.2 Con el monitor serial abierto, agitar el pluviómetro 5 veces manualmente y verificar `lluvia_pulsos=5` en el log. Repetir con 10 y 20 agitaciones. Confirmar que no hay pulsos falsos por rebote entre mediciones. Requiere hardware físico.
  `test(firmware): verificar conteo ISR pluviómetro con agitación manual`

## 2. Soldadura y verificación del anemómetro

- [ ] 2.1 Conectar el anemómetro (reed switch) al GPIO ISR definido en OQ1 con pull-up interno. Verificar continuidad. Requiere hardware físico.
  `chore(hardware): conectar anemómetro al nodo sensor con pull-up GPIO`
- [ ] 2.2 Girar el anemómetro manualmente 5, 10 y 20 vueltas. Verificar en log serial que `viento_pulsos` coincide. Confirmar ausencia de rebote. Requiere hardware físico.
  `test(firmware): verificar conteo ISR anemómetro con giro manual`

## 3. Conexión y verificación de la veleta

- [ ] 3.1 Conectar la veleta (potenciómetro) al canal ADC1 definido en OQ2. Verificar tensión en los extremos de rotación con multímetro (esperado: 0 V a 3.3 V o similar según el sensor). Requiere hardware físico.
  `chore(hardware): conectar veleta ADC al nodo sensor`
- [ ] 3.2 Posicionar la veleta sucesivamente en N, E, S, O. Verificar en log serial que las 4 posiciones dan lecturas ADC distintas. Anotar los valores para la tabla de calibración. Requiere hardware físico.
  `test(firmware): verificar lecturas ADC veleta en 4 posiciones cardinales`

## 4. Validación end-to-end con LoRa

- [ ] 4.1 Con todos los sensores conectados y el gateway real corriendo, esperar 3 uplinks del nodo sensor real. Verificar en InfluxDB que `lluvia_pulsos` y `viento_pulsos` reflejan los eventos físicos generados manualmente en los pasos anteriores, y que la dirección de veleta es coherente con la posición física. Requiere infra completa + hardware completo.
  `test(backend): verificar sensores de pulsos y veleta en InfluxDB etapa 3b`
- [ ] 4.2 Verificar en el frontend React que las métricas de lluvia, velocidad de viento y dirección de viento se visualizan con valores reales. Requiere frontend corriendo con datos en InfluxDB.
  `test(frontend): verificar sensores de pulsos y veleta visibles en frontend etapa 3b`

## 5. Documentación de resultados y cierre

- [ ] 5.1 Registrar: tabla de calibración básica de la veleta (tensión ADC por sector cardinal), factor pulso/mm del pluviómetro (según spec del sensor), factor pulso/vuelta del anemómetro, cualquier problema y su resolución. Documentar el montaje físico final (fotos si es posible). Archivar el change al completar.
  `docs(docs): registrar resultados integración sensores de pulsos y veleta etapa 3b`
