## Why

El wizard de aprovisionamiento del gateway-node-mock tiene tres problemas que impiden que el dispositivo funcione en campo sin intervención manual adicional:

1. **OTAA keys zeros**: el wizard escribe `0000000000000000` como DevEUI y 32 ceros como AppKey para gateways. El firmware lee estas claves de NVS y las usa para el join OTAA. ChirpStack rechaza el join porque no existe ningún device registrado con DevEUI todo-ceros. El gateway nunca obtiene sesión LoRaWAN y nunca envía datos.

2. **FCnt reset silencioso**: al reprovisionarse (re-flash de NVS), el contador de frames LoRaWAN (FCnt) en NVS se resetea a 0. ChirpStack rechaza frames con FCnt decreciente como protección anti-replay. El resultado es que el dispositivo reprovisado envía uplinks que ChirpStack descarta silenciosamente hasta que el operario resetea manualmente el contador en la UI de ChirpStack.

3. **Gateway EUI manual**: el EUI del gateway (derivado de su MAC WiFi) se conoce solo después del primer boot. El operario debe leer el log serial, copiar el EUI y registrarlo a mano en ChirpStack. Sin este registro, ChirpStack descarta todos los paquetes reenviados por el gateway.

## What Changes

- **OTAA keys reales para gateways**: el wizard asigna un par DevEUI/AppKey del pool (igual que para nodos) cuando el `DeviceType` es gateway. Pasan a NVS y se registran en ChirpStack.
- **Gateway EUI read vía esptool**: en Step 1, tras seleccionar el puerto, el operator-app lee la MAC WiFi del ESP32 con `esptool read_mac` y deriva el EUI-64 del gateway. El EUI se muestra al operario y se usa en Step 5 para el registro automático en ChirpStack.
- **Registro de gateway en ChirpStack**: Step 5 llama a `POST /api/gateways` con el EUI derivado para registrar el gateway como infraestructura LoRaWAN.
- **FCnt reset automático**: Step 5, tras el registro del device, llama a la API de ChirpStack para resetear el frame counter, garantizando que ChirpStack acepta el primer uplink post-reprovisionamiento.

## Capabilities

### Modified Capabilities

- `operator-flash-gateway-mock`: el wizard pasa a ser completamente autónomo. Después de seguir los 5 pasos, el gateway está listo para enviar datos sin ninguna intervención manual adicional en ChirpStack.

## Impact

- **Operator-app** (`operator-app/`): cambios en Step 1 (leer MAC), Step 2 (asignar OTAA keys del pool para gateways), Step 5 (registro gateway + FCnt reset). Nuevos comandos Tauri en `chirpstack.rs` y `flash.rs`.
- **Firmware**: sin cambios. El firmware ya lee las claves OTAA de NVS correctamente.
- **Backend, frontend, 3D, Android, docs**: sin cambios.
- **Rollback**: los cambios son aditivos. Revertir a zeros en NVS restaura el comportamiento anterior (no funcional en producción, pero no rompe nada).
