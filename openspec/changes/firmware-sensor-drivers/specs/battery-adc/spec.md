## ADDED Requirements

### Requirement: El firmware mide el voltaje de batería por ADC en GPIO35

El firmware del nodo sensor SHALL leer el voltaje de batería desde GPIO35 (pin input-only, ADC1) con atenuación 11 dB (rango ~0–3.9 V) y convertirlo a milivoltios usando el divisor resistivo R1=100 kΩ / R2=33 kΩ (ratio 0.248), reemplazando el placeholder `bateria_mv = 0`.

Rango objetivo del sistema: 10 000–14 600 mV (12 V SLA o LiFePO4).
Resolución esperada: mejor que 50 mV (≈ 0.4 % del rango).

La lectura SHALL publicarse en el campo `bateria_mv` del `BinaryMeasurement` de cada uplink.

#### Scenario: Lectura ADC dentro de rango

- **GIVEN** la batería está conectada al divisor resistivo y GPIO35 tiene la atenuación correcta configurada
- **WHEN** el firmware toma una lectura ADC single-shot antes de construir el payload
- **THEN** `bateria_mv` en el payload es ≥ 10 000 y ≤ 15 000 (rango del campo u16 LE según spec del payload binario)

#### Scenario: Lectura ADC fuera de rango o fallo de periférico

- **GIVEN** el ADC falla o la lectura cruda está fuera del rango esperable
- **WHEN** el firmware intenta leer GPIO35
- **THEN** `bateria_mv` se fija en 0 como valor centinela, se registra un error por serial, y el uplink se envía igualmente con el resto de campos válidos

#### Scenario: El campo bateria_mv no modifica el formato del payload

- **GIVEN** el driver ADC está activo
- **WHEN** se construye el payload binario de 14 bytes
- **THEN** `bateria_mv` ocupa los bytes 11–12 (little-endian) igual que antes y el CRC-8/MAXIM es correcto — ningún otro campo se desplaza
