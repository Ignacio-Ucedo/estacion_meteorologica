## Context

El wizard de flash del gateway-node-mock requiere tres intervenciones manuales en ChirpStack que pueden automatizarse completamente desde el operator-app:

1. Registrar el gateway (infraestructura LoRaWAN) con su EUI derivado de la MAC.
2. Registrar el device del gateway-node-mock con OTAA keys reales (en lugar de zeros).
3. Resetear el FCnt tras cada reprovisionamiento.

Este change cierra ese gap. Una vez completados los 5 pasos del wizard, el gateway está operativo sin necesidad de ninguna acción manual en ChirpStack.

## Goals / Non-Goals

**Goals:**
- Leer la MAC WiFi del ESP32 vía `esptool read_mac` (ya disponible como sidecar).
- Derivar el EUI-64 del gateway de forma determinista (EUI-48 → EUI-64).
- Asignar OTAA keys reales del pool ChirpStack para gateways (igual que para nodos).
- Registrar el gateway en ChirpStack (`POST /api/gateways`) en Step 5.
- Registrar el device del gateway-node-mock en ChirpStack (ya existente) con el DevEUI/AppKey del pool.
- Resetear FCnt vía ChirpStack API (`POST /api/devices/{dev_eui}/activate` o equivalente) en Step 5.
- Mostrar el EUI derivado al operario en Step 5 para referencia y verificación.

**Non-Goals:**
- Multi-step retry automático ante fallo de API ChirpStack (el operario reintenta el step).
- Registro en ChirpStack de nodos sensor (este wizard es solo para gateway-node-mock).
- Cambios en el firmware del gateway-node-mock.

## Flujo completo del wizard con este change

```
Step 1: Seleccionar puerto serial
  │  Al confirmar el puerto → esptool read_mac → MAC de 6 bytes
  │  EUI-64 derivado: MAC[0:3] ++ 0xFF ++ 0xFE ++ MAC[3:6]
  │  Mostrado como: "Gateway EUI: AA:BB:CC:FF:FE:DD:EE:FF"
  │  Estado cacheado en WizardState: gatewayEui
  ▼
Step 2: Configuración WiFi + OTAA keys
  │  Para DeviceType.gateway:
  │    - detect_gateway_bridge_host() → chirpstackHost (auto)
  │    - get_device_from_pool() → devEui + appKey (reales, no zeros)
  │  Para DeviceType.node: igual que antes
  ▼
Step 3: Flash firmware (sin cambios)
  ▼
Step 4: Flash NVS (con chirpstack_host + devEui/appKey reales)
  ▼
Step 5: Registro en ChirpStack [NUEVO]
  │  1. register_gateway(gatewayEui, name, chirpstackCreds)
  │     → POST /api/gateways
  │     → idempotente: si ya existe, OK (200 o 409 tratado como OK)
  │  2. register_device(devEui, appKey, chirpstackCreds)
  │     → ya existe la lógica en chirpstack.rs — verificar/reusar
  │  3. reset_fcnt(devEui, chirpstackCreds)
  │     → DELETE /api/devices/{dev_eui}/activation (limpia sesión OTAA)
  │     → FCnt se resetea automáticamente en el próximo join
  │  4. Mostrar: EUI del gateway + DevEUI del device + "Listo para operar"
```

## Derivación del EUI-64

```
MAC WiFi (EUI-48):   AA:BB:CC:DD:EE:FF
                      │  │  │
                      ▼  ▼  ▼
EUI-64:          AA:BB:CC:FF:FE:DD:EE:FF
                         ↑↑↑↑
                    insertar FF:FE en la posición 3-4

Rust:
fn mac_to_eui64(mac: [u8; 6]) -> [u8; 8] {
    [mac[0], mac[1], mac[2], 0xFF, 0xFE, mac[3], mac[4], mac[5]]
}
```

El EUI-64 se representa como hex lowercase sin separadores para la API ChirpStack: `aabbccfffeddeeeff`.

## Comandos Tauri nuevos

### `read_gateway_eui(port: String) -> Result<String, String>`

Ubicación: `operator-app/src-tauri/src/commands/flash.rs`

```
esptool --port {port} read_mac
 → parsear línea "MAC: aa:bb:cc:dd:ee:ff"
 → mac_to_eui64([u8; 6])
 → formato hex string lowercase (16 chars): "aabbccfffeddeeeff"
```

Llamado en Step 1 al confirmar el puerto (solo si DeviceType.gateway).

### `register_gateway(eui: String, name: String, creds: ChirpstackCreds) -> Result<(), String>`

Ubicación: `operator-app/src-tauri/src/commands/chirpstack.rs`

```
POST /api/gateways
Body: { "gateway": { "gatewayId": eui, "name": name, "tenantId": creds.tenant_id } }
Headers: Authorization: Bearer {creds.api_key}
409 → OK (ya registrado)
```

### `reset_device_activation(dev_eui: String, creds: ChirpstackCreds) -> Result<(), String>`

```
DELETE /api/devices/{dev_eui}/activation
Headers: Authorization: Bearer {creds.api_key}
200/204 → OK (sesión OTAA borrada; FCnt se resetea en próximo join)
404 → OK (nunca tuvo sesión activa)
```

## Cambios en WizardState

```typescript
interface WizardState {
  // existentes
  port: string;
  deviceType: DeviceType;
  wifiSsid: string;
  wifiPass: string;
  devEui: string;
  appKey: string;
  chirpstackHost: string;
  chirpstackApiKey: string;
  chirpstackTenantId: string;
  chirpstackAppId: string;

  // NUEVO
  gatewayEui: string;  // hex lowercase 16 chars, solo para gateways
}
```

## Step 5: WizardStep5_Register (nuevo componente)

Solo aparece para DeviceType.gateway. Para DeviceType.node, Step 5 es el "Listo" actual.

**Estados:**
- `idle` → botón "Registrar en ChirpStack"
- `running` → spinner + log de progreso (3 pasos)
- `done` → checkmarks + EUI mostrado + "El gateway está listo para operar"
- `error` → mensaje + botón retry

**Log de progreso:**
```
[✓] Gateway EUI: aabbccfffeaabbcc registrado
[✓] Device aabbccaabbcc0001 registrado / ya existía
[✓] Frame counter reseteado — próximo join limpio
```

## Manejo de errores

| Error | Comportamiento |
|---|---|
| `read_mac` falla (puerto ocupado, no es ESP32) | Step 1 muestra error; no avanza |
| Gateway ya registrado (409) | Tratado como éxito (idempotente) |
| ChirpStack API no accesible | Step 5 error con retry |
| Device no existe en pool | `get_device_from_pool` devuelve error en Step 2 |
| `DELETE /activation` 404 | OK (nunca tuvo sesión) |

## Impacto en tests

- `nvs.rs`: sin cambios (los test params ya tienen el campo `chirpstack_host`).
- `chirpstack.rs`: agregar test unitario para `mac_to_eui64` con vector conocido.
- `nvs_integration.rs`: sin cambios.
