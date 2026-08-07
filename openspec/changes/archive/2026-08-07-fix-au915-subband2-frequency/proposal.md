## Why

El band plan AU915 sub-band 2 del proyecto se calculó con la fórmula de canales de **US915** (`902.3 + n×0.2 MHz`), dando 903.9–905.3 MHz para los canales 8–15. La fórmula real de **AU915** es `915.2 + n×0.2 MHz`, que da 916.8–918.2 MHz. El rango usado hoy (903.9–905.3 MHz) cae fuera de la banda 915–928 MHz que exige ENACOM en Argentina — y es, precisamente, la razón regulatoria por la que el proyecto eligió la región AU915 en vez de US915 (`CLAUDE.md`, `openspec/config.yaml`). Hay que corregirlo antes de seguir construyendo sobre el número equivocado (p. ej. antes de migrar `gateway-node-mock` a AU915).

## What Changes

- Corregir las 8 frecuencias de canal de 125 kHz + 1 canal de 500 kHz en `infra/chirpstack/region_au915_2.toml` (network server ChirpStack) de la fórmula US915 a la fórmula AU915 real.
- Corregir la constante `AU915_SUBBAND2_FREQ_HZ` en `firmware/lr1121-transceiver/src/lib.rs` de `903_900_000` a `916_800_000`.
- Corregir logs y comentarios en `firmware/src/bin/gateway-node.rs` y comentario de rango de canales en `firmware/lr1121-modem-e/src/lib.rs`.
- Corregir referencias a "903.9 MHz" / "902–928 MHz" en documentación: `openspec/config.yaml`, `CLAUDE.md`, `hardware/netlist.md`, `infra/chirpstack/chirpstack.toml`, `infra/docker-compose.yml`.
- Corregir las mismas referencias dentro de los artifacts todavía in-progress de la change `migrate-lr1121-au915` (`proposal.md`, `design.md`, `tasks.md` y sus delta specs `lorawan-gateway-au915`, `lorawan-node-au915`, `lr1121-driver`), para que esa change no se archive con el número equivocado.
- Sin cambios de: región LoRaWAN (sigue siendo AU915), sub-banda (sigue siendo sub-band 2 / canales 8–15), formato de payload binario, ni frecuencia de envío (sigue cada 10 min). Es exclusivamente una corrección del valor numérico de frecuencia RF.
- El firmware del nodo sensor (`lr1121-modem-e`) probablemente no requiere cambio funcional: el Modem-E certificado trae la tabla de canales AU915 embebida y solo recibe `Region::Au915` + una máscara de canales por índice (8–15), no una frecuencia manual. Se corrige igual el comentario documental para que no induzca a error.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

(ninguna en `openspec/specs/` — las specs afectadas, `lorawan-gateway-au915`, `lorawan-node-au915` y `lr1121-driver`, son delta specs que viven dentro de la change hermana `migrate-lr1121-au915`, todavía sin sincronizar a specs principales. Esta change corrige esos archivos directamente como parte del Impact, no como delta spec propio.)

## Impact

- **Infra**: `infra/chirpstack/region_au915_2.toml` (frecuencias de canal — afecta comportamiento real del network server), `infra/chirpstack/chirpstack.toml`, `infra/docker-compose.yml` (comentarios).
- **Firmware**: `firmware/lr1121-transceiver/src/lib.rs` (constante usada por `gateway-node`), `firmware/src/bin/gateway-node.rs` (logs), `firmware/lr1121-modem-e/src/lib.rs` (comentario, sin impacto funcional esperado).
- **Docs**: `openspec/config.yaml`, `CLAUDE.md`, `hardware/netlist.md`.
- **Change hermana in-progress**: `openspec/changes/migrate-lr1121-au915/` (proposal.md, design.md, tasks.md, specs/lorawan-gateway-au915, specs/lorawan-node-au915, specs/lr1121-driver) — corrección de contenido, no reabre tareas ya completadas.
- No afecta backend, frontend, Android ni el formato del payload de 14 bytes.
- Sin hardware físico adquirido todavía (LR1121 pendiente, tarea 0.2 de `migrate-lr1121-au915`), por lo que no hay firmware ya desplegado en campo que rollback-ear.
