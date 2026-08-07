## Context

`migrate-lr1121-au915` (archivada, con la corrección posterior
`fix-au915-subband2-frequency`) ya migró los dos binarios "reales"
(`sensor-node.rs`, `gateway-node.rs`) de SX1278/EU433 a LR1121/AU915. Los
binarios "mock" (`gateway-node-mock.rs`, `sensor-node-mock.rs`), pensados
para validar la cadena sin hardware LoRa completo, quedaron fuera de esa
migración porque en ese momento el foco era el hardware real.

`gateway-node-mock.rs` no usa radio LoRa en absoluto (construye el frame
LoRaWAN en software y lo inyecta directo por UDP como RXPK), así que a
nivel de dependencias de hardware está "migrado" — pero comparte
`weather_core::udp_forwarder::build_rxpk_json` con `gateway-node.rs`, y esa
función hardcodea `"freq":433.175` en el JSON RXPK. Esto es un bug real
detectado en auditoría, no solo un comentario desactualizado: el campo
`freq` es lo que ChirpStack usa para resolver a qué canal de la región
configurada (AU915 sub-band 2, `infra/chirpstack/region_au915_2.toml`)
pertenece el paquete. Un valor de 433.175 MHz no matchea ningún canal de
esa región.

`sensor-node-mock.rs`, en cambio, sí depende de hardware de radio — usa
`firmware/src/radio.rs` (`Sx1278`) y las funciones radio-específicas de
`firmware/src/lorawan/mod.rs`, ninguna de las dos tocadas por la migración
LR1121. Es el único consumidor de ambos módulos (confirmado por grep sobre
`firmware/src/`), así que quedan huérfanos en cuanto se migre.

## Goals / Non-Goals

**Goals:**
- Que el JSON RXPK que generan `gateway-node` y `gateway-node-mock` declare
  la frecuencia real configurada en ChirpStack (916.8 MHz, AU915 sub-band 2,
  canal 8), no un valor hardcodeado de otra banda.
- Que `sensor-node-mock.rs` hable LoRaWAN sobre el mismo stack LR1121 que
  `sensor-node.rs`, para que la Etapa 2 (nodo-estación mock + gateway real,
  prueba de distancia) pueda usarlo sin sorpresas de banda/hardware.
- Dejar los artefactos OpenSpec (`gateway-node-mock` spec shipped,
  `mock-sensor-firmware` change activa) consistentes con el código real.

**Non-Goals:**
- No se cambia el formato binario del payload LoRaWAN (14 bytes) ni el
  protocolo Semtech UDP.
- No se implementa multi-canal ni se resuelve la limitación de "single
  fixed channel" del PoC — eso es un problema conocido y aceptado, fuera de
  alcance.
- No se toca `firmware/gateway-mock/` (crate nativo separado que publica
  directo a MQTT, bypaseando ChirpStack) — su etiqueta cosmética
  `"gateway-mock-eu433"` no afecta su función.
- No se corrige `AGENTS.md` ni las notas de hardware históricas
  (`hardware/netlist.md`, `firmware/docs/hardware-assumptions.md`,
  `firmware/README.md`, `docs/hardware-questions.md`) — quedan
  explícitamente fuera, son staleness preexistente y no bloquean nada.
- No se tocan los changes abiertos sin tareas activas que mencionan SX1278
  en contexto de diseño futuro (`gateway-esp32s3-target`,
  `firmware-sensor-drivers`, `veleta-wind-direction`,
  `backend-lorawan-ingestion`, los `operator-flash-*`).

## Decisions

### D1: Parametrizar `freq` en `build_rxpk_json` en vez de hardcodear 916.8

`build_rxpk_json(raw, rssi, snr, tmst_us)` pasa a
`build_rxpk_json(raw, freq_mhz, rssi, snr, tmst_us)`. Alternativa
descartada: hardcodear `916.8` directamente en el `format!` (como estaba
con `433.175`). Se prefiere parametrizar porque la función vive en
`weather-core` (crate compartida, agnóstica de radio) y ya hoy tiene dos
llamadores con necesidades distintas: `gateway-node.rs` puede pasar
`AU915_SUBBAND2_FREQ_HZ` (de `lr1121-transceiver`, convertido a MHz) y
`gateway-node-mock.rs` puede pasar el mismo valor como constante local sin
depender del crate de radio (no tiene radio LoRa). Hardcodear de nuevo un
valor fijo reproduciría el mismo tipo de bug si la banda vuelve a cambiar.

- `gateway-node.rs` (línea ~131): agregar el argumento de frecuencia usando
  `AU915_SUBBAND2_FREQ_HZ` (ya importado de `lr1121_transceiver`, en Hz;
  convertir a MHz en el call site: `AU915_SUBBAND2_FREQ_HZ as f64 / 1e6`).
- `gateway-node-mock.rs` (línea ~177 y ~240, dos call sites: uplink normal y
  join request): agregar una constante local `const CHANNEL_FREQ_MHZ: f64 =
  916.8;` (no puede importar `lr1121-transceiver` — no tiene radio, y ese
  crate depende de hardware LR1121 real vía FFI/build.rs).

### D2: Migrar `sensor-node-mock.rs` reemplazando `Sx1278` por `ModemE`, sin tocar la generación de datos sintéticos

Mismo patrón que ya se usó en `sensor-node.rs` (`lr1121_modem_e::{ModemE,
JOIN_TIMEOUT_MS}`): inicializar el Modem-E, hacer join OTAA vía el propio
firmware del chip (no vía el software join manual que usa
`gateway-node-mock.rs`), y enviar el payload de 14 bytes con
`request_uplink`. La única diferencia respecto a `sensor-node.rs` es el
origen de la lectura: `MockEnvironmentSensor` (ciclo triangular
determinístico) en vez de `EnvironmentSensor` real sobre DHT22 + pulsos
GPIO. Alternativa descartada: mantener el software LoRaWAN stack (cifrado
manual + MIC, como hace `gateway-node-mock.rs`) también en
`sensor-node-mock.rs` — se descarta porque el Modem-E ya resuelve eso en
el chip y usar dos mecanismos de join distintos entre los tres binarios
mock/real sería más difícil de mantener, no menos.

### D3: Eliminar `firmware/src/radio.rs` y las funciones SX1278-específicas de `firmware/src/lorawan/mod.rs` tras la migración

Confirmado por grep que `sensor-node-mock.rs` es el único consumidor de
`crate::radio::Sx1278` fuera de `firmware/src/lorawan/mod.rs` mismo. Una
vez migrado D2, ambos quedan sin ningún caller. Alternativa descartada:
dejarlos como código "legacy, no usado" con un comentario — se descarta
porque el proyecto no tiene hardware SX1278 desplegado en campo que
dependa de este código (confirmado en `fix-au915-subband2-frequency`), y
mantener un driver de radio completo sin ningún caller ni test es deuda
pura. Si `firmware/src/lorawan/mod.rs` queda con solo las partes
radio-agnósticas (que gateway-node-mock.rs ya usa: `crypto`, `frame`,
`session`), esas se conservan.

### D4: Corregir `mock-sensor-firmware` in-place, sin reabrir sus tareas ya completadas

Mismo patrón que `fix-au915-subband2-frequency` aplicó sobre
`migrate-lr1121-au915`: se corrigen los textos de `design.md` y de la delta
spec `specs/mock-sensor-node/spec.md` dentro del change activo
`mock-sensor-firmware` (referencias a SX1278/EU433/433.175 → LR1121/AU915/
916.8), sin modificar el estado de sus tareas (4/6, 2 pendientes) ni asumir
responsabilidad por completarlas — esa change sigue siendo dueña de su
propio scope.

## Risks / Trade-offs

- [Cambiar la firma de `build_rxpk_json` rompe compilación si queda algún
  otro caller no identificado] → Mitigación: `build_rxpk_json` solo tiene
  dos callers en todo el repo (confirmado por grep), ambos parte de esta
  change; se verifica con `cargo check` tras el cambio (mismo entorno
  usado en `fix-au915-subband2-frequency`, toolchain `esp` ya instalado).
- [Migrar `sensor-node-mock.rs` a `ModemE` sin hardware LR1121 físico para
  probar el join OTAA de extremo a extremo] → Mitigación: la Etapa 2, que
  es donde este binario se usa por primera vez con hardware real, ya está
  planeada como una etapa de prueba de campo separada; esta change solo
  garantiza que compile y siga el mismo patrón validado en `sensor-node.rs`.
- [Eliminar `radio.rs` y quedarse sin referencia de cómo se programaba un
  SX1278 por SPI, por si hiciera falta en el futuro] → Mitigación: el
  código queda en el historial de git (recuperable), y el proyecto ya
  decidió formalmente no volver a SX1278 (ver `migrate-lr1121-au915/
  proposal.md`, rollback plan).

## Migration Plan

1. Firmware compartido: parametrizar `build_rxpk_json` (D1) y actualizar
   ambos call sites.
2. Firmware gateway mock: corregir logs cosméticos en
   `gateway-node-mock.rs`.
3. Firmware sensor mock: migrar `sensor-node-mock.rs` a `lr1121-modem-e`
   (D2); eliminar `radio.rs` y las funciones SX1278 de `lorawan/mod.rs`
   (D3) una vez confirmado que compila sin ellas.
4. Specs/docs: corregir `openspec/specs/gateway-node-mock/spec.md`,
   `openspec/changes/mock-sensor-firmware/` in-place (D4), e
   `infra/SETUP.md` §5.
5. Verificación: `cargo check` sobre los binarios afectados (mismo
   procedimiento que `fix-au915-subband2-frequency`: toolchain `esp`,
   ruta corta si el path del repo excede el límite de ESP-IDF en Windows).

No aplica rollback de campo: no hay firmware mock desplegado en hardware
todavía.

## Open Questions

_(ninguna — el alcance y las decisiones técnicas quedaron resueltos en la
auditoría previa a esta propuesta)_
