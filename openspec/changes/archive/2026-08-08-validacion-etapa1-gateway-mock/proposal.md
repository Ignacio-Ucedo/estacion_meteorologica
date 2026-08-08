## Why

El stack completo (firmware → ChirpStack → backend → frontend) nunca fue validado de extremo a extremo sobre hardware real. Antes de introducir hardware LoRa (LR1121, antenas) conviene comprobar que la cadena de datos funciona correctamente con el montaje más sencillo posible: un solo ESP32 que actúa como gateway sintético vía WiFi, sin radio LoRa.

## What Changes

- Runbook de validación documentado para Etapa 1: procedimiento paso a paso para flashear el ESP32, configurar la infra y verificar que los datos llegan al frontend.
- Registro de resultados al completar la validación: latencia observada end-to-end, cualquier ajuste de configuración necesario, evidencia de funcionamiento (capturas de ChirpStack UI / InfluxDB / frontend).
- No se modifica ningún código — el firmware `gateway-node-mock` ya está implementado y la infra AU915 ya está corregida.

## Capabilities

### New Capabilities

- `gateway-mock-e2e-validation`: Criterios de aceptación y procedimiento de validación para el escenario de gateway sintético (Etapa 1). Cubre arranque WiFi, OTAA join via UDP, uplinks sintéticos AU915, ingesta en backend e influxDB y visualización en frontend.

### Modified Capabilities

_(ninguna — ningún requisito existente cambia)_

## Impact

- **firmware/**: solo flash de `gateway-node-mock` sobre un ESP32 existente. Sin cambios de código.
- **infra/**: ChirpStack AU915 + Gateway Bridge `au915_2` + backend deben estar corriendo (todos ya configurados correctamente).
- **docs/**: se documenta el resultado de la validación como artifact del change antes de archivarlo.
- Sin impacto en: gateway hardware, sensores, frontend (solo lectura), Android app, modelos 3D.
- Impacto energético: ninguno (el ESP32 corre alimentado por USB durante la validación).
- Formato de payload LoRa: sin cambio (14 bytes, FRMPayload fijo, `device_id=3`).
- Plan de rollback: no aplica — no se despliega código nuevo. Si la validación falla, se diagnostica y se abre un change de fix.
