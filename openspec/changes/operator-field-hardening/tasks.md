## 1. Lectura de MAC y derivación de EUI-64 (Step 1)

- [x] 1.1 Agregar función `mac_to_eui64(mac: [u8; 6]) -> [u8; 8]` en `operator-app/src-tauri/src/commands/flash.rs`. Test unitario con vector conocido `AA:BB:CC:DD:EE:FF → AA:BB:CC:FF:FE:DD:EE:FF`.
  Necesita hardware real: no (es manipulación de bytes).
  Commit: `feat(operator-app): derivar EUI-64 de gateway desde MAC WiFi (EUI-48→EUI-64)`

- [x] 1.2 Agregar comando Tauri `read_gateway_eui(port: String) -> Result<String, String>` que invoca `esptool --port {port} read_mac`, parsea la línea `MAC: ...` y retorna el EUI-64 como hex string de 16 chars en lowercase.
  Necesita hardware real: sí (para prueba de integración; la lógica de parseo no).
  Commit: `feat(operator-app): comando Tauri read_gateway_eui via esptool read_mac`

- [x] 1.3 En `WizardStep1_Port.tsx`: al confirmar el puerto con `DeviceType.gateway`, llamar `read_gateway_eui` y almacenar el resultado en `WizardState.gatewayEui`. Mostrar el EUI al operario como texto informativo: `"EUI del gateway: AA:BB:CC:FF:FE:DD:EE:FF"`. Si falla, mostrar error inline sin bloquear el avance (el EUI puede ser vacío y el Step 5 lo manejará).
  Commit: `feat(operator-app): mostrar EUI de gateway en Step 1 tras leer MAC`

## 2. OTAA keys reales para gateways (Step 2)

- [x] 2.1 En `WizardStep2_Config.tsx`: para `DeviceType.gateway`, llamar `get_device_from_pool` en el `useEffect` de init (junto con `detect_gateway_bridge_host`). Poblar `state.devEui` y `state.appKey` con las keys del pool. Mostrar los valores como texto de solo lectura (igual que en la UI de nodos, pero no editable para gateways: el DevEUI del pool es la identidad LoRaWAN del device en el gateway-node-mock).
  Commit: `feat(operator-app): asignar OTAA keys del pool a gateways en Step 2`

- [x] 2.2 Verificar que `WizardStep4_NVS.tsx` ya escribe `devEui` y `appKey` correctamente en NVS para gateways (debería funcionar sin cambios dado que `nvsParams` ya los incluye). Confirmar con un test de NVS si existe.
  Commit: `test(operator-app): verificar que NVS gateway incluye devEui/appKey del pool`

## 3. Registro en ChirpStack (Step 5)

- [x] 3.1 Agregar comando Tauri `register_gateway(eui: String, name: String, creds: ChirpstackCreds) -> Result<(), String>` en `chirpstack.rs`. Llama `POST /api/gateways`. Trata 409 como OK.
  Commit: `feat(operator-app): comando Tauri para registrar gateway en ChirpStack`

- [x] 3.2 Agregar comando Tauri `reset_device_activation(dev_eui: String, creds: ChirpstackCreds) -> Result<(), String>` en `chirpstack.rs`. Llama `DELETE /api/devices/{dev_eui}/activation`. Trata 404 como OK.
  Commit: `feat(operator-app): comando Tauri para resetear activación OTAA (FCnt reset)`

- [x] 3.3 Crear `operator-app/src/components/wizard/WizardStep5_Register.tsx`. Solo activo para `DeviceType.gateway`. Estados: `idle` → `running` (3 pasos con log de progreso) → `done` | `error`. Invoca: (a) `register_gateway`, (b) `register_device` (existente), (c) `reset_device_activation`. Botón retry en `error`.
  Commit: `feat(operator-app): Step 5 wizard — registro automático gateway + FCnt reset`

- [x] 3.4 Actualizar `FlashWizard.tsx` para insertar `WizardStep5_Register` en el flujo de gateways. Para nodos, Step 5 sigue siendo la pantalla "Listo" actual. Actualizar `StepIndicator` para reflejar el paso adicional.
  Commit: `feat(operator-app): integrar Step 5 registro en FlashWizard para gateways`

## 4. Integración lib.rs

- [x] 4.1 Registrar los nuevos comandos Tauri (`read_gateway_eui`, `register_gateway`, `reset_device_activation`) en `operator-app/src-tauri/src/lib.rs` (`invoke_handler`).
  Commit: `chore(operator-app): registrar nuevos comandos Tauri en invoke_handler`
