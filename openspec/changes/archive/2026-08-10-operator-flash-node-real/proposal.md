## Why

El node real (ESP32 + SX1278 + DHT22 + pluviómetro + anemómetro) es el dispositivo final de campo. Flashearlo hoy requiere toolchain Rust completo. Una tab en operator-app permite al técnico de campo provisionar nuevos nodos sin entorno de desarrollo.

## What Changes

- Nueva tab "Flash Node Real" en el operator-app
- Wizard: seleccionar puerto USB → configurar DevEUI/AppKey → flashear firmware de producción → registrar en ChirpStack → verificar primer uplink recibido

## Capabilities

### New Capabilities

- `operator-flash-node-real`: Tab en operator-app para flashear el nodo meteorológico completo. Incluye verificación post-flash: espera el primer uplink en ChirpStack para confirmar que el dispositivo quedó operativo.

### Modified Capabilities

- `operator-app`: nueva sección en sidebar.

## Impact

- Solo afecta `operator-app/`
- Requiere firmware production compilado (change `migrate-lorawan-sx1278` completo)
- Las pruebas de campo requieren hardware real y cobertura LoRaWAN
- Power/battery impact: el firmware production usa deep sleep — documentar ciclo de arranque inicial
