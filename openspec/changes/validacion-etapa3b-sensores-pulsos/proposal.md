# Proposal: validacion-etapa3b-sensores-pulsos

## Why

Con los sensores ambientales (DHT22, ADC batería) validados en Etapa 3a, el paso final es integrar los sensores de movimiento: pluviómetro, anemómetro y veleta. Estos sensores requieren verificación física (agitar el pluviómetro para generar pulsos, girar el anemómetro manualmente) y son los últimos componentes que convierten el prototipo en una estación meteorológica completa.

## What Changes

- Runbook de validación para la integración de pluviómetro, anemómetro y veleta: procedimiento de soldadura, verificación de pulsos ISR por serial, y confirmación de datos reales en InfluxDB.
- Los campos `lluvia_pulsos` y `viento_pulsos` del payload pasan de 0 a valores reales generados por los sensores físicos.
- El campo de dirección de viento (veleta ADC) se integra al payload si `veleta-wind-direction` está implementado.
- Registro de resultados: pulsos por cucharada/vuelta verificados contra especificación del sensor, lecturas de veleta por sector cardinal.

## Capabilities

### New Capabilities

- `pulse-sensor-validation`: Criterios de aceptación para la integración de pluviómetro y anemómetro (conteo de pulsos ISR). Cubre resolución de pulsos (pluviómetro: 0.2794 mm/pulso típico; anemómetro: según factor de calibración del sensor), conteo correcto por ISR sin rebote, y llegada de valores a InfluxDB.
- `wind-direction-validation`: Criterios de aceptación para la integración de la veleta resistiva (ADC). Cubre rango de tensión por sector cardinal, resolución angular, y llegada de valores a InfluxDB.

### Modified Capabilities

_(ninguna)_

## Impact

- **firmware/**: flash del binario `sensor-node` con drivers de pulsos ISR y ADC veleta activos. Prerequisito: drivers implementados en `firmware-sensor-drivers` y `veleta-wind-direction`.
- **hardware/**: soldadura de pluviómetro (reed switch, GPIO ISR), anemómetro (reed switch, GPIO ISR) y veleta (potenciómetro resistivo, ADC1). Cables de campo de longitud real (varios metros).
- **infra/**: sin cambios.
- Impacto energético: ISRs de pulsos no tienen impacto significativo. El ADC de veleta consume ~0.1 mA adicional. Sin cambio en autonomía.
- Plan de rollback: si un sensor falla, deshabilitar solo ese sensor en el firmware (flags en `config.rs`) y continuar operando con los demás. El payload sigue siendo válido con campos en 0.
