## Why

Una auditoría de consistencia previa al inicio de las Etapas 1 y 2 del plan de
desarrollo (gateway mock standalone, luego nodo-estación mock + gateway real
para prueba de distancia) encontró que el firmware "mock" nunca terminó de
migrar de EU433/SX1278 a AU915/LR1121. El hallazgo más grave es un bug
funcional: `weather-core/src/udp_forwarder.rs::build_rxpk_json` — compartida
por `gateway-node` (real) y `gateway-node-mock` — hardcodea `"freq":433.175`
en el JSON RXPK enviado a ChirpStack. Con la región ya migrada a AU915
sub-band 2 (canales 916.8–918.2 MHz), ese valor no matchea ningún canal
configurado y ChirpStack descartaría el uplink como "unknown channel",
rompiendo la cadena end-to-end que la Etapa 1 necesita validar. Además,
`firmware/src/bin/sensor-node-mock.rs` (necesario para la Etapa 2) sigue
atado al driver legacy `radio::Sx1278`, nunca migrado al patrón que ya usa
`sensor-node.rs` con `lr1121-modem-e`. Corregir esto ahora, antes de empezar
a flashear hardware, evita descubrir el bug recién en banco de pruebas.

## What Changes

- **BREAKING** (comportamiento, no formato de payload) — `build_rxpk_json` deja
  de hardcodear `433.175` y recibe la frecuencia como parámetro; los
  llamadores (`gateway-node`, `gateway-node-mock`) pasan `916.8` MHz
  (mismo valor que `AU915_SUBBAND2_FREQ_HZ`).
- Corregir el escenario de `openspec/specs/gateway-node-mock/spec.md` que
  exige literalmente `freq=433.175` → `freq=916.8`.
- Corregir logs cosméticos en `firmware/src/bin/gateway-node-mock.rs`
  ("433.175MHz (EU433)" → "916.8MHz (AU915 sub-band 2)").
- Corregir `infra/SETUP.md` §5 (setup del device profile de
  `gateway-node-mock` en ChirpStack): EU433 → AU915.
- Corregir in-place el change hermano `mock-sensor-firmware` (activo,
  no archivado): su `design.md` y la delta spec `specs/mock-sensor-node/`
  siguen documentando EU433/SX1278/433.175 MHz — mismo patrón que la
  corrección aplicada anteriormente a `migrate-lr1121-au915`.
- Migrar `firmware/src/bin/sensor-node-mock.rs` del driver legacy
  `radio::Sx1278` al crate `lr1121-modem-e`, siguiendo el mismo patrón ya
  aplicado en `sensor-node.rs` (integración vía `ModemE`), preservando sin
  cambios la generación de lecturas sintéticas (`MockEnvironmentSensor`).
- Evaluar y, si corresponde, eliminar el código legacy que quede huérfano
  tras la migración (`firmware/src/radio.rs` y las partes SX1278-específicas
  de `firmware/src/lorawan/mod.rs`), si ningún otro binario las usa.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `gateway-node-mock`: el escenario "Frame enviado exitosamente" pasa de
  exigir `freq=433.175` a exigir `freq=916.8` (AU915 sub-band 2, canal fijo
  PoC), reflejando la corrección del bug de frecuencia hardcodeada.

## Impact

- **Firmware compartido**: `weather-core/src/udp_forwarder.rs` (cambio de
  firma de `build_rxpk_json`), afecta a los dos binarios que la consumen
  (`gateway-node`, `gateway-node-mock`).
- **Firmware del nodo sensor mock**: `firmware/src/bin/sensor-node-mock.rs`
  reemplaza su dependencia de radio (Sx1278 → lr1121-modem-e); posible
  eliminación de `firmware/src/radio.rs` y partes de
  `firmware/src/lorawan/mod.rs` si quedan sin uso.
- **Infraestructura**: ninguna (ChirpStack ya está en AU915); solo se
  corrige documentación de setup (`infra/SETUP.md`).
- **Documentación/specs**: `openspec/specs/gateway-node-mock/spec.md`
  (shipped) y `openspec/changes/mock-sensor-firmware/` (change hermana
  activa, corregida in-place, sin afectar sus tareas pendientes).
- **Sin impacto en hardware desplegado en campo**: no hay firmware mock
  flasheado en campo todavía; no se requiere plan de rollback.
- **Sin cambio en el formato binario del payload LoRa** (14 bytes,
  estructura sin modificar).
