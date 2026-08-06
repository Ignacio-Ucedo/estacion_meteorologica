## ADDED Requirements

### Requirement: El firmware lee dirección de viento por ADC en GPIO34

El firmware del nodo sensor SHALL leer el voltaje analógico de la veleta desde GPIO34 (ADC1, atenuación 11 dB) con el divisor R4=100 kΩ / R7=33 kΩ (ratio 0.248), mapear el voltaje a un ángulo de dirección en décimas de grado (0–3599, donde 0 = Norte / 0.0° y 3599 = 359.9°), y publicarlo como campo `veleta_dir` (u16 LE) en bytes 11–12 del payload binario de 16 bytes.

La implementación está bloqueada hasta confirmar pinout y rango de tensión de salida de la veleta con multímetro (prerrequisito de campo).

El mapeo SHALL asumir relación lineal entre voltaje ADC y ángulo: `veleta_dir = ((V_adc / V_max) × 3600.0) as u16`, con `V_max` configurable en `firmware/src/config.rs`.

Unidades: décimas de grado, rango 0–3599, resolución 0.1°.

#### Scenario: Lectura ADC dentro de rango produce ángulo válido

- **GIVEN** la veleta está conectada a GPIO34, alimentada, y el divisor R4/R7 está operativo
- **WHEN** el firmware lee GPIO34 antes de construir el payload
- **THEN** `veleta_dir` es un valor en [0, 3599] que se incluye en bytes 11–12 del payload de 16 bytes

#### Scenario: Fallo ADC produce valor centinela

- **GIVEN** el periférico ADC falla o la lectura está fuera de rango
- **WHEN** el firmware intenta leer GPIO34
- **THEN** `veleta_dir` se fija en `0xFFFF` (65535) como valor centinela de error, el log registra el error, y el uplink se envía igualmente

#### Scenario: El payload pasa de 14 a 16 bytes con veleta_dir

- **GIVEN** el driver ADC de veleta está activo
- **WHEN** se construye el payload binario
- **THEN** el resultado tiene exactamente 16 bytes: campos en posiciones documentadas (bytes 11–12 = `veleta_dir`, 13–14 = `bateria_mv`, 15 = CRC-8/MAXIM sobre bytes 0–14)

#### Scenario: Build sin hardware usa valor cero para veleta_dir

- **GIVEN** el proyecto se compila sin feature `hardware` (modo simulación o mock)
- **WHEN** el nodo sensor construye el payload
- **THEN** `veleta_dir` es `0` y el payload de 16 bytes es structuralmente válido
