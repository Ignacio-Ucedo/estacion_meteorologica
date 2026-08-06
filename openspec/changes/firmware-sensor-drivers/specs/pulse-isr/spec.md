## ADDED Requirements

### Requirement: ISR de pluviómetro cuenta pulsos en GPIO32

El firmware del nodo sensor SHALL registrar una interrupción edge-falling en GPIO32 (pull-up interno ESP32) que incrementa `PulseCounters::record_rain_pulse()` ante cada pulso del pluviómetro de cubeta basculante (contacto reed switch, contacto seco).

El debounce SHALL ignorar pulsos con separación menor a 50 ms respecto al pulso anterior, usando timestamp atómico en la ISR.

#### Scenario: Pulso de lluvia incrementa el contador

- **GIVEN** la ISR de GPIO32 está registrada y el pluviómetro está conectado
- **WHEN** ocurre un flanco descendente válido (separación > 50 ms del pulso anterior) en GPIO32
- **THEN** `PulseCounters.rain` se incrementa en 1 y el siguiente `snapshot_and_reset()` reporta el incremento en `lluvia_pulsos`

#### Scenario: Rebote de contacto no genera conteo doble

- **GIVEN** la ISR de GPIO32 está registrada
- **WHEN** ocurren dos flancos descendentes con separación < 50 ms (rebote de contacto)
- **THEN** solo se cuenta 1 pulso

#### Scenario: Pulsos acumulados entre transmisiones

- **GIVEN** el nodo sensor está en el loop de 10 minutos entre uplinks
- **WHEN** ocurren N pulsos válidos de lluvia en ese intervalo
- **THEN** el payload del siguiente uplink contiene `lluvia_pulsos = N` y el contador se resetea a 0

### Requirement: ISR de anemómetro cuenta pulsos en GPIO33

El firmware del nodo sensor SHALL registrar una interrupción edge-falling en GPIO33 que incrementa `PulseCounters::record_wind_pulse()`. El tipo de salida del anemómetro (NPN open-collector con pull-up R5 10 kΩ, o push-pull) SHALL confirmarse con multímetro antes de implementar — esta confirmación es prerrequisito bloqueante.

El debounce SHALL ignorar pulsos con separación menor a 50 ms.

#### Scenario: Pulso de viento incrementa el contador

- **GIVEN** la ISR de GPIO33 está registrada, el tipo de salida del anemómetro fue confirmado y el circuito de pull-up es correcto
- **WHEN** ocurre un flanco descendente válido (separación > 50 ms) en GPIO33
- **THEN** `PulseCounters.wind` se incrementa en 1

#### Scenario: Pulsos acumulados entre transmisiones (viento)

- **GIVEN** el nodo sensor está en el loop de 10 minutos entre uplinks
- **WHEN** ocurren N pulsos válidos de viento en ese intervalo
- **THEN** el payload del siguiente uplink contiene `viento_pulsos = N` y el contador se resetea a 0

#### Scenario: GPIO33 no configurado bloquea arranque hasta confirmar tipo de salida

- **GIVEN** el tipo de salida del anemómetro (NPN vs. push-pull) no ha sido confirmado en campo
- **WHEN** se intenta registrar la ISR en GPIO33
- **THEN** la tarea queda bloqueada y se documenta como prerrequisito pendiente de campo; no se flashea hasta resolver OQ2
