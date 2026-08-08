# Spec: wind-direction-validation

## ADDED Requirements

### Requirement: Lectura de veleta ADC cubre rango de sectores cardinales

El firmware SHALL leer la tensión del potenciómetro de la veleta via ADC1 y convertirla a dirección en grados (0–360°) o sector cardinal (N/NE/E/SE/S/SO/O/NO). El rango de tensión SHALL cubrir al menos 8 posiciones distintas dentro del rango ADC (0–3.3 V). La lectura SHALL ser estable (variación < 5°) cuando la veleta está inmóvil.

#### Scenario: Veleta en posición Norte da lectura diferente a posición Sur

- **WHEN** la veleta se posiciona manualmente en Norte (0°) y luego en Sur (180°)
- **THEN** los valores de ADC correspondientes son distinguibles (diferencia > 20% del rango total)

#### Scenario: Los 4 puntos cardinales principales dan lecturas distintas

- **WHEN** la veleta se posiciona sucesivamente en N, E, S, O
- **THEN** las 4 lecturas ADC son distintas entre sí (no hay degeneración de sectores) y los valores se registran en InfluxDB
