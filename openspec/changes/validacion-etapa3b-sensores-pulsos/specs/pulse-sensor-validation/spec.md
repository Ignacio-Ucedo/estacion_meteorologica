# Spec: pulse-sensor-validation

## ADDED Requirements

### Requirement: Conteo de pulsos del pluviómetro por ISR sin rebote

El firmware SHALL contar los pulsos del reed switch del pluviómetro via ISR GPIO con debounce. El contador SHALL incrementar de 1 en 1 por cada cierre del reed switch (una cucharada). El valor de `lluvia_pulsos` en el payload SHALL ser el acumulado desde el último uplink y resetearse en cada envío.

#### Scenario: N cucharadas manuales generan N pulsos en el log

- **WHEN** el operador agita el pluviómetro manualmente generando N cierres del reed switch (N conocido)
- **THEN** el log serial muestra `lluvia_pulsos=N` en el siguiente ciclo de lectura (N en [1, 20])

#### Scenario: lluvia_pulsos en InfluxDB corresponde a eventos físicos

- **WHEN** se generan manualmente K cucharadas entre dos uplinks consecutivos
- **THEN** el campo `lluvia_pulsos` en InfluxDB para ese uplink es K (tolerancia ±1 por posible rebote residual)


### Requirement: Conteo de pulsos del anemómetro por ISR sin rebote

El firmware SHALL contar los pulsos del reed switch del anemómetro via ISR GPIO con debounce. Cada pulso corresponde a una vuelta completa del anemómetro de copa. El valor de `viento_pulsos` en el payload SHALL ser el acumulado desde el último uplink y resetearse en cada envío.

#### Scenario: N vueltas manuales del anemómetro generan N pulsos

- **WHEN** el operador gira el anemómetro manualmente N vueltas completas (N conocido)
- **THEN** el log serial muestra `viento_pulsos=N` en el siguiente ciclo de lectura (N en [1, 20])

#### Scenario: viento_pulsos en InfluxDB corresponde a vueltas físicas

- **WHEN** se giran manualmente K vueltas del anemómetro entre dos uplinks consecutivos
- **THEN** el campo `viento_pulsos` en InfluxDB para ese uplink es K (tolerancia ±1)
