# Delta spec: operator-flash-gateway-mock
# Change: operator-field-hardening

## Cambios respecto a la spec principal

### EUI-64 del gateway derivado de MAC en Step 1

**GIVEN** el operario selecciona un puerto serial con `DeviceType.gateway`
**WHEN** confirma el puerto en Step 1
**THEN** el operator-app lee la MAC WiFi del ESP32 vía `esptool read_mac` y muestra el EUI-64 derivado (`MAC[0:3] ++ 0xFF ++ 0xFE ++ MAC[3:6]`, hex lowercase con separadores)

**GIVEN** `read_mac` falla (ESP32 no encontrado, puerto ocupado)
**WHEN** el operario confirma el puerto
**THEN** se muestra un error inline en Step 1; el wizard puede avanzar igualmente (EUI vacío, Step 5 lo reportará como error de registro)

### OTAA keys reales para gateways en Step 2

**GIVEN** `DeviceType.gateway`
**WHEN** el operario llega a Step 2
**THEN** el wizard llama `get_device_from_pool` y pre-rellena `devEui` y `appKey` con un par real del pool de ChirpStack (igual que para nodos)

**THEN** `devEui` y `appKey` se muestran como texto de solo lectura (no editables para gateways)

**GIVEN** el pool está vacío o ChirpStack no accesible
**WHEN** el wizard intenta obtener keys del pool
**THEN** se muestra error en Step 2 y el operario no puede avanzar hasta resolver

### Flash NVS con keys reales (Step 4)

**GIVEN** las OTAA keys del pool están en `WizardState`
**WHEN** Step 4 escribe la partición NVS
**THEN** `lorawan/dev_eui` y `lorawan/app_key` en NVS contienen las keys reales (no zeros)
**AND** `config/gw_host` contiene `{ip}:1700` detectado automáticamente

### Registro automático en ChirpStack (Step 5 — solo gateways)

**GIVEN** `DeviceType.gateway` y steps 1-4 completados
**WHEN** el operario llega a Step 5 y activa el registro
**THEN** el operator-app ejecuta en secuencia:
  1. `POST /api/gateways` con el EUI derivado (idempotente: 409 = OK)
  2. `register_device` con DevEUI/AppKey del pool
  3. `DELETE /api/devices/{dev_eui}/activation` para resetear FCnt (idempotente: 404 = OK)

**THEN** Step 5 muestra un log de progreso con resultado de cada sub-paso
**THEN** al completarse, muestra el Gateway EUI y DevEUI para verificación del operario

**GIVEN** cualquier sub-paso falla con error no-idempotente
**WHEN** Step 5 recibe el error
**THEN** muestra el error con botón "Reintentar" que repite la secuencia desde el inicio

### Invariantes de identidad

- El Gateway EUI (infraestructura LoRaWAN) es distinto del DevEUI del device que corre en el mismo ESP32.
- El Gateway EUI es determinista: derivado de la MAC WiFi. Puede derivarse nuevamente en cualquier momento.
- El DevEUI del device viene del pool ChirpStack y persiste en NVS.
