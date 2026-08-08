## Why

Con la cadena de datos validada en Etapa 1 (sin radio), el siguiente paso es verificar que el link LoRaWAN RF sobre hardware LR1121 real funciona antes de exponer el sistema a las condiciones de campo. Un test de banco (misma habitación, 1–5 m) permite diagnosticar problemas de hardware, pinout, Modem-E y configuración AU915 con el mínimo costo operacional, sin necesidad de antenas definitivas ni de salir al campo.

## What Changes

- Runbook de validación para el primer link LoRaWAN RF: procedimiento de flash de ambos ESP32 (nodo mock + gateway real), verificación de OTAA join via RF, y confirmación de uplinks llegando a ChirpStack e InfluxDB.
- Registro de resultados: RSSI y SNR observados en banco (línea base de referencia), porcentaje de pérdida de paquetes en 5 uplinks consecutivos, cualquier ajuste de configuración necesario.
- No se modifica código — los firmwares `sensor-node-mock` y `gateway-node` ya existen. El foco está en el bring-up del hardware LR1121 y en la verificación del stack LoRaWAN RF extremo a extremo.

## Capabilities

### New Capabilities

- `lorawan-rf-bench-validation`: Criterios de aceptación y procedimiento de validación para el primer link LoRaWAN RF en banco (distancia corta). Cubre OTAA join via RF AU915, recepción de uplinks con RSSI/SNR esperados para corta distancia, e ingesta en InfluxDB.

### Modified Capabilities

_(ninguna — ningún requisito existente cambia)_

## Impact

- **firmware/**: flash de `sensor-node-mock` (nodo, device_id=2) y `gateway-node` (gateway, modo transceiver). Sin cambios de código — prerequisito es que `migrate-lr1121-au915` tareas 2.2 y 4.2 estén completas (HAL SPI funcional en ambos crates).
- **hardware/**: requiere LR1121 físicos adquiridos, Modem-E v2.1.0 flasheado en el LR1121 del nodo (tarea 1.1 de `migrate-lr1121-au915`), SPI cableado según netlist (SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, BUSY=27, DIO1=26), antenas genéricas 915 MHz conectadas.
- **infra/**: ChirpStack AU915 debe estar corriendo (validado en Etapa 1). Device profile `esp32-sensor-au915` ya existe.
- Sin impacto en: frontend, Android app, modelos 3D.
- Impacto energético: ambos ESP32 alimentados por USB durante el test de banco. Sin implicancias de batería en esta etapa.
- Plan de rollback: si el link RF no funciona, diagnosticar en orden: (1) SPI cableado, (2) versión Modem-E, (3) configuración AU915/región, (4) antenas. Abrir sub-task en `migrate-lr1121-au915` según corresponda.
