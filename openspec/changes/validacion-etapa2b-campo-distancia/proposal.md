## Why

Con el link LoRaWAN RF verificado en banco (Etapa 2a), el siguiente paso es la prueba de distancia real en campo abierto. Esta etapa establece el link budget de la PoC: a qué distancia máxima el sistema sigue recibiendo uplinks con RSSI y SNR aceptables, usando el montaje físico definitivo del gateway (antena omni, alimentación de campo, backhaul WiFi o Ethernet) y el nodo mock con antena yagi de 915 MHz.

## What Changes

- Runbook de validación para la prueba de distancia en campo: procedimiento de montaje del gateway completo (sin sensores físicos en el nodo), puntos de medición a distancias crecientes, criterios de aceptación por tramo.
- Registro de resultados: tabla de RSSI/SNR vs. distancia, mapa de cobertura básico, distancia máxima verificada con packet loss ≤ 10%, comparación contra la línea base de banco.
- No se modifica código — se usan los mismos firmwares de Etapa 2a (sensor-node-mock + gateway-node).

## Capabilities

### New Capabilities

- `lorawan-rf-range-validation`: Criterios de aceptación y procedimiento para la prueba de distancia LoRaWAN en campo. Cubre montaje del gateway de campo, puntos de medición a distancias crecientes (50 m, 200 m, 500 m, 1 km, máx), criterios de RSSI/SNR y packet loss por tramo.

### Modified Capabilities

_(ninguna)_

## Impact

- **hardware/**: requiere gateway físico ensamblado con alimentación autónoma (batería o solar) y backhaul (WiFi de largo alcance o Ethernet via W5500) + antena omni SMA 915 MHz. Nodo mock con antena yagi 915 MHz.
- **firmware/**: sin cambios de código. Mismos firmwares que Etapa 2a.
- **infra/**: ChirpStack accesible desde el campo (requiere backhaul del gateway operativo).
- Sin impacto en: backend, frontend, Android app, modelos 3D.
- Impacto energético: primera prueba real de autonomía del gateway en campo.
- Plan de rollback: si la distancia objetivo no se alcanza, documentar el link budget real y ajustar la antena del nodo o la posición del gateway antes de Etapa 3.
