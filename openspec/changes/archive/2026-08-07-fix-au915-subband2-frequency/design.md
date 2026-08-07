## Context

El band plan LoRaWAN AU915 define canales uplink de 125 kHz con la fórmula `frecuencia = 915.2 + n×0.2 MHz` para `n = 0..63`, y canales de 500 kHz con `frecuencia = 915.9 + (n−64)×1.6 MHz` para `n = 64..71` (LoRaWAN Regional Parameters). El proyecto usa **sub-band 2** (canales 8–15 de 125 kHz + canal 65 de 500 kHz), que en AU915 real cae en **916.8–918.2 MHz**.

El código y la infraestructura actuales calcularon esos mismos índices de canal con la fórmula de **US915** (`915.2` reemplazado por `902.3`, y `915.9` por `903.0`), dando 903.9–905.3 MHz. Ese rango:
- Está fuera de la banda 915–928 MHz asignada por ENACOM en Argentina para este uso.
- No es lo que reportan los comentarios/documentación del propio repo, que dicen "AU915 (902–928 MHz)" — una descripción que en realidad corresponde a la extensión combinada de US915, no a AU915.

El bug está aislado a **valores de frecuencia hardcodeados** en config y comentarios. No afecta:
- La selección de región en el LR1121 Modem-E del nodo sensor (`Region::Au915`, un enum, no un número de frecuencia).
- La máscara de canales por índice (bits 8–15), que es independiente de a qué frecuencia física mapea cada índice — el mapeo lo resuelve la tabla de canales AU915 embebida en el firmware certificado Modem-E.

## Goals / Non-Goals

**Goals:**
- Reemplazar todos los valores de frecuencia derivados de la fórmula US915 por los valores correctos de AU915 en: config de ChirpStack, constante Rust del gateway, logs/comentarios de firmware, y documentación (`CLAUDE.md`, `openspec/config.yaml`, `hardware/netlist.md`).
- Corregir los mismos valores dentro de los artifacts todavía in-progress de `migrate-lr1121-au915`, para que esa change no se archive con el número equivocado.
- Dejar un rastro explícito (comentario "fórmula AU915, no US915") en los puntos donde el valor se calcula, para que no se reintroduzca el error.

**Non-Goals:**
- No cambia la región LoRaWAN (sigue AU915) ni la sub-banda (sigue sub-band 2, canales 8–15).
- No cambia el formato del payload binario de 14 bytes ni la frecuencia de envío (10 min).
- No agrega soporte multi-canal en el gateway (sigue siendo single-channel, limitación de PoC ya documentada).
- No valida en hardware real — no hay módulos LR1121 adquiridos todavía (tarea 0.2 de `migrate-lr1121-au915` sigue pendiente); la corrección es de config/código/documentación.

## Decisions

### D1 — Recalcular con la fórmula AU915, no ajustar "a mano"

Se recalculan los 8 canales de 125 kHz (n=8..15) y el canal de 500 kHz (n=65) con `915.2 + n×0.2` y `915.9 + (n−64)×1.6` respectivamente, en vez de simplemente sumar el offset observado (915.2 − 902.3 = 12.9 MHz) a los valores existentes. Recalcular desde la fórmula documentada evita arrastrar un segundo error de redondeo y deja el comentario del código como fuente de verdad verificable.

Valores resultantes:

| Canal | Frecuencia AU915 (correcta) | Frecuencia previa (US915, incorrecta) |
|---|---|---|
| 8 | 916.8 MHz | 903.9 MHz |
| 9 | 917.0 MHz | 904.1 MHz |
| 10 | 917.2 MHz | 904.3 MHz |
| 11 | 917.4 MHz | 904.5 MHz |
| 12 | 917.6 MHz | 904.7 MHz |
| 13 | 917.8 MHz | 904.9 MHz |
| 14 | 918.0 MHz | 905.1 MHz |
| 15 | 918.2 MHz | 905.3 MHz |
| 65 (500 kHz) | 917.5 MHz | 904.6 MHz |

El canal fijo de PoC pasa de **903.9 MHz** a **916.8 MHz** (sigue siendo el canal 8, el primero de sub-band 2).

### D2 — No tocar RX2 ni downlink

`rx2_frequency=923300000` (923.3 MHz, DR8) en `region_au915_2.toml` no cambia: es el valor de RX2 por defecto compartido por AU915 y US915 en LoRaWAN 1.0.3+, y ya cae dentro de 915–928 MHz. Igual con los canales downstream 923.3–927.5 MHz — no están afectados por el bug.

### D3 — No tocar `lr1121-modem-e` funcionalmente

El nodo sensor no recibe una frecuencia manual: `configure_au915_subband2()` llama a `set_region(Region::Au915)` + una máscara de bits por índice de canal. El Modem-E certificado resuelve internamente qué frecuencia física corresponde a cada índice según la tabla AU915 oficial — por lo que debería estar transmitiendo ya en 916.8 MHz aunque el comentario del código dijera "903.9–905.3 MHz". Se corrige solo el comentario (línea 35 de `lr1121-modem-e/src/lib.rs`) por precisión documental; no hay tarea de validación en hardware nueva para este componente porque no cambia comportamiento.

### D4 — Corregir la change hermana `migrate-lr1121-au915` in situ

`migrate-lr1121-au915` sigue in-progress (10/26 tareas). Sus artifacts (`design.md`, `tasks.md`, tres delta specs) documentan el valor incorrecto. En vez de esperar a que esa change se archive y crear una change de "corrección post-archivo", se editan sus archivos directamente ahora — son texto descriptivo de una change no finalizada, no historial inmutable.

## Risks / Trade-offs

- **[Riesgo]** Si el LR1121 físico (cuando se adquiera) resulta transmitir realmente en 903.9 MHz por algún comportamiento no documentado del Modem-E → **Mitigación**: la tarea 7.2 de `migrate-lr1121-au915` ("verificar que el sub-band 2 queda configurado correctamente") ya cubre esto contra hardware real; si aparece una discrepancia se resuelve ahí, no bloquea esta corrección de config/documentación.
- **[Riesgo]** Quedan referencias sueltas a "903.9 MHz" en algún archivo no detectado por la búsqueda de texto → **Mitigación**: tarea final de verificación con grep de `903.9|904\.|905\.|902\.3` sobre todo el repo antes de cerrar la change.
- **[Trade-off]** Esta corrección no incluye migrar `gateway-node-mock` a AU915 (tema pedido originalmente por el usuario) — queda como change separada, a hacer después de esta, para no mezclar "corregir un bug" con "agregar funcionalidad nueva" en el mismo diff.
