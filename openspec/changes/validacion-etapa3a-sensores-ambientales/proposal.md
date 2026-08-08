# Proposal: validacion-etapa3a-sensores-ambientales

## Why

Con el link LoRaWAN RF validado (Etapa 2a/2b), el siguiente paso es reemplazar los datos sintéticos del nodo con lecturas reales de sensores, en orden de complejidad creciente. DHT22 y ADC de batería son los sensores más simples (no requieren movimiento físico, lecturas en ambiente controlado), por lo que se integran primero para verificar que el pipeline de datos funciona con valores reales antes de agregar los sensores de viento y lluvia.

## What Changes

- El firmware del nodo sensor pasa de `sensor-node-mock` (datos sintéticos) al binario `sensor-node` (datos reales) con DHT22 y ADC de batería activos.
- Runbook de validación: procedimiento de soldadura del DHT22 y circuito ADC, verificación de lecturas por serial, y confirmación de datos reales en InfluxDB.
- Registro de resultados: valores de temperatura y humedad medidos en ambiente controlado (comparación contra termómetro/higrómetro de referencia), tensión de batería medida vs. tensión real.

## Capabilities

### New Capabilities

- `ambient-sensor-validation`: Criterios de aceptación para la integración del DHT22 y ADC de batería en el nodo sensor real. Cubre rango de temperatura (−40–80 °C, resolución 0.1 °C), rango de humedad (0–100 %, resolución 0.1 %), rango de batería (0–4200 mV) y llegada de valores reales a InfluxDB.

### Modified Capabilities

_(ninguna)_

## Impact

- **firmware/**: primer flash del binario `sensor-node` (producción) en lugar de `sensor-node-mock`. Prerequisito: driver DHT22 y driver ADC batería implementados en `firmware-sensor-drivers` (tareas correspondientes de ese change).
- **hardware/**: soldadura del DHT22 al nodo (pin de datos + resistencia pull-up 10 kΩ) y circuito divisor de tensión para ADC de batería. Sin otros periféricos nuevos.
- **infra/**: sin cambios — ChirpStack y backend ya corriendo desde etapas anteriores.
- **frontend/**: sin cambios de código — solo verificación visual de valores reales.
- **android/**: sin cambios.
- **3d/**: sin cambios.
- **docs/**: registro de resultados de validación y actualización del netlist con pines definitivos.
- Impacto energético: el DHT22 consume ~1.5 mA en medición; el ADC interno del ESP32 es despreciable. Sin cambio significativo en autonomía.
- Plan de rollback: si el DHT22 da lecturas inválidas, verificar soldadura y pull-up. Si el ADC da valores fuera de rango, verificar el divisor de tensión. Volver a `sensor-node-mock` si es necesario diagnosticar el link LoRaWAN.
