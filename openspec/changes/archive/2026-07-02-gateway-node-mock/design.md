## Context

El stack actual tiene tres piezas de testing:

| Pieza | Qué simula | Qué omite |
|---|---|---|
| `gateway-mock` (Docker) | Lecturas → MQTT | Todo ChirpStack (OTAA, MIC, device profile) |
| `sensor-node-mock` (firmware) | Sensores → frame LoRaWAN real | Requiere SX1278 TX + gateway real |
| `gateway-node` (firmware) | Gateway LoRa → UDP → ChirpStack | Requiere SX1278 RX + nodo transmisor |

El `gateway-node-mock` cierra el hueco: un solo ESP32 sin SX1278 que genera
datos sintéticos, construye frames LoRaWAN reales y los inyecta en
ChirpStack vía UDP, ejercitando la configuración de ChirpStack que ninguna
de las otras piezas valida.

Archivos existentes que se reusan directamente:
- `firmware/src/bin/gateway-node.rs` — WiFi, UdpSocket, `send_push_data()`, `build_rxpk_json()`, `build_stat_json()`, `send_pull_data()`, `compute_gateway_eui()`
- `firmware/src/bin/sensor-node-mock.rs` — `MockEnvironmentSensor`, lógica de `seq` y `battery_mv`
- `firmware/src/lorawan/` — OTAA join, frame encryption (AppSKey), MIC (NwkSKey)
- `firmware/src/nvs.rs` — carga de claves OTAA y persistencia de sesión
- `firmware/src/payload.rs` — `build_binary()` y `BinaryMeasurement`

## Goals / Non-Goals

**Goals:**
- Validar la cadena completa ESP32→WiFi→UDP→ChirpStack→MQTT→Backend→Frontend sin SX1278
- Ejercitar la configuración de ChirpStack (gateway registrado, device profile EU433, OTAA, MIC)
- Reusar el módulo `lorawan/` existente sin modificarlo
- Un solo ESP32 sin hardware adicional

**Non-Goals:**
- Reemplazar el `gateway-mock` Docker (sigue siendo útil para CI y desarrollo sin hardware)
- Transmisión RF real (ningún SX1278 involucrado)
- Soporte multi-canal (canal único 433.175 MHz SF7BW125, igual que `gateway-node`)
- Modificaciones al backend, frontend, Android o 3D

## Decisions

### D1 — Nuevo binario independiente, sin modificar los existentes

`firmware/src/bin/gateway-node-mock.rs` es un binario nuevo. No se toca
`gateway-node.rs` ni `sensor-node-mock.rs`. La reutilización es por
referencia al mismo módulo `weather_firmware::lorawan` y a las funciones
helper; no hay extracción a nuevos módulos.

**Alternativa descartada**: modificar `gateway-node` para añadir un modo
mock. Añadiría lógica condicional compleja y mezclaría responsabilidades.

### D2 — OTAA join real a través de ChirpStack (no ABP)

El binario realiza el join OTAA completo, no usa ABP con session keys
hardcodeadas. Esto valida exactamente la parte más frágil del setup de
ChirpStack.

**Alternativa descartada**: ABP con claves fijas en código. Más simple de
implementar, pero no valida el flujo OTAA que usará el hardware real.

### D3 — Claves OTAA cargadas desde NVS (mismo mecanismo que sensor-node-mock)

Las claves `AppKey`, `AppEUI`, `DevEUI` del mock se provisionan en NVS con
la misma herramienta que los otros nodos. `device_id = 3`. El gateway EUI
se deriva de la MAC WiFi del ESP32 (igual que `gateway-node`).

**Alternativa descartada**: claves hardcodeadas como constantes. Más fácil
para una primera iteración pero no válido para flujo de provisionado real.

### D4 — Intervalo 10 min por defecto, reducible a 10 s para pruebas

`SEND_INTERVAL_MS = 10 * 60 * 1_000` como constante de compilación.
Para hacer pruebas rápidas se puede recompilar con 10_000. No se añade
configuración en NVS para mantener simplicidad.

### D5 — RXPK con RSSI/SNR fijos plausibles

Los campos `rssi` y `lsnr` del RXPK JSON se fijan en `-80 dBm` y `9.5 dB`
respectivamente (valores realistas para un link de banco). ChirpStack no
requiere valores dinámicos para procesar el uplink.

## Flujo de datos

```
[gateway-node-mock]
  WiFi connect → IP obtenida
  OTAA join via UDP (JoinRequest wrapped en PUSH_DATA)
  ← ChirpStack responde JoinAccept (via PULL_RESP UDP)
  Loop:
    generate_reading(seq)  ← MockEnvironmentSensor / seq
    build_binary()         ← payload.rs (14 bytes, CRC-8)
    lorawan::encrypt()     ← AppSKey cifra FRMPayload
    lorawan::mic()         ← NwkSKey firma el frame
    build_rxpk_json()      ← wrapping Semtech UDP RXPK
    send_push_data()       ← UDP 1700 → ChirpStack GW Bridge
    seq += 1; sleep(SEND_INTERVAL_MS)
  Every 10 s: send_pull_data()
  Every 30 s: send_push_data(stat_json)

[ChirpStack GW Bridge] → [ChirpStack NS]
  Verifica MIC, descifra FRMPayload, publica evento `up` MQTT

[Backend] → PostgreSQL → REST API → Frontend
```

## Risks / Trade-offs

- **OTAA join falla si ChirpStack no está configurado correctamente** → este es el comportamiento deseado: el mock sirve precisamente para detectar estos problemas. El firmware registra el error por serial y reintenta.
- **El módulo `lorawan/` fue diseñado para correr sobre SX1278; puede tener dependencias de hal implícitas** → revisar dependencias en `lorawan/mod.rs` antes de implementar; si hay dependencias de radio hay que abstraerlas o duplicar la lógica de frame building.
- **El join OTAA requiere que el Gateway Bridge esté alcanzable y que el gateway esté registrado en ChirpStack** → documentar el setup requerido en `infra/SETUP.md`.
- **Una sesión OTAA expirada en NVS causaría uplinks silenciosamente rechazados** → borrar NVS y hacer re-join si el backend no recibe datos tras un minuto.

## Migration Plan

1. Implementar `gateway-node-mock.rs`
2. Documentar en `infra/SETUP.md`: registro del gateway (EUI de MAC WiFi), device profile EU433, device con `device_id=3` y claves OTAA propias
3. Provisionado de claves OTAA en NVS del ESP32 de prueba
4. Flashear, verificar join OTAA en logs de ChirpStack, confirmar uplinks en backend

**Rollback**: eliminar `firmware/src/bin/gateway-node-mock.rs` y su entrada en `Cargo.toml`. Sin impacto en otros binarios ni en producción.

## Open Questions

- ¿El módulo `lorawan/` tiene dependencias directas de `Sx1278` o es agnóstico al transporte? (verificar en `firmware/src/lorawan/mod.rs` antes de implementar)
- ¿Provisionamos claves OTAA del mock como constantes de compilación en una primera iteración para simplificar el setup, o vamos directo a NVS?
