## 1. Prerrequisitos de campo (bloquean firmware y backend)

- [ ] 1.1 Medir pinout del conector XLR 5p macho de la veleta con multímetro: identificar VCC, GND, AIN y pines NC. Confirmar voltaje de alimentación requerido. Documentar en `hardware/netlist.md`. (**Prerrequisito bloqueante** para tareas 2.x.)
  `docs(hardware): documentar pinout XLR 5p veleta y alimentación`
- [ ] 1.2 Medir el rango de salida analógica de la veleta (voltaje mínimo y máximo girando manualmente 0°–360°). Confirmar que el divisor R4/R7 (ratio 0.248) mantiene la salida dentro de 0–3.3 V para GPIO34. Calcular `V_max` para el mapeo voltaje→ángulo. Documentar en `hardware/netlist.md`. (**Prerrequisito bloqueante** para tarea 2.2.)
  `docs(hardware): documentar rango analógico veleta y factor V_max`

## 2. Firmware — extensión del payload y driver ADC veleta (requiere hardware real)

- [ ] 2.1 Actualizar `weather-core/src/payload.rs`: agregar campo `veleta_dir: u16` a `BinaryMeasurement`, actualizar `BINARY_PAYLOAD_LEN = 16`, `build_binary()` (insertar veleta_dir en bytes 11–12, desplazar bateria_mv a 13–14, CRC sobre bytes 0–14 en byte 15), `parse_binary()`, `verify_binary_crc()`. Actualizar tests unitarios del módulo.
  `feat!(firmware): extender payload LoRaWAN de 14 a 16 bytes con veleta_dir`

  **BREAKING CHANGE: payload binario crece de 14 a 16 bytes; bateria_mv se desplaza a bytes 13-14, CRC a byte 15.**

- [ ] 2.2 *(Bloqueado por 1.1 y 1.2)* Implementar `read_wind_direction()` en `firmware/src/` que lee ADC1 en GPIO34 (atenuación 11 dB) y mapea al ángulo en décimas de grado: `veleta_dir = ((V_adc / V_max) × 3600.0) as u16`. Retornar `0xFFFF` (65535) en caso de error de periférico. Exponer `V_max` como constante configurable en `firmware/src/config.rs`.
  `feat(firmware): leer ADC veleta GPIO34 y mapear a décimas de grado`
- [ ] 2.3 Integrar `read_wind_direction()` en el loop de `firmware/src/bin/sensor-node.rs` llenando `veleta_dir` en `BinaryMeasurement`.
  `feat(firmware): integrar veleta_dir en loop sensor-node`
- [ ] 2.4 Validar en hardware: flashear sensor-node, rotar la veleta manualmente y verificar en log serial que `veleta_dir` varía entre 0 y ~3599 de forma monótona. Comparar ángulo reportado con brújula de referencia para estimar error. **Requiere hardware real.**
  `test(firmware): validar driver ADC veleta GPIO34 con hardware real`

## 3. Backend — codec ChirpStack, parser 16 bytes y campo wind_direction

- [ ] 3.1 Actualizar el codec JavaScript en el device profile de ChirpStack para parsear 16 bytes: leer `veleta_dir` en bytes 11–12 (LE), `bateria_mv` en bytes 13–14 (LE), CRC en byte 15. Verificar en la UI de ChirpStack con un payload de prueba de 16 bytes.
  `feat(backend): actualizar codec ChirpStack para payload de 16 bytes`
- [ ] 3.2 Crear migración Alembic que agrega `wind_direction FLOAT` a la tabla `readings` (nullable en la migración → NOT NULL DEFAULT 0.0 en el step final).
  `feat(backend): migración Alembic agrega wind_direction a readings`
- [ ] 3.3 Actualizar el modelo SQLAlchemy `Reading` con el campo `wind_direction: float`.
  `feat(backend): agregar wind_direction al modelo Reading`
- [ ] 3.4 Actualizar el ingestion bridge (`/integrations/chirpstack/uplink`) en `backend/`: (a) rechazar payloads con longitud ≠ 16 bytes con 422; (b) extraer `veleta_dir` y convertir a `wind_direction = veleta_dir / 10.0` (None si `veleta_dir == 65535`); (c) persistir `wind_direction` en el `Reading`.
  `feat(backend): parsear veleta_dir del payload 16 bytes en ingestion bridge`
- [ ] 3.5 Actualizar el endpoint REST `GET /api/stations/{id}/readings` para incluir `wind_direction` en la respuesta JSON.
  `feat(backend): exponer wind_direction en respuesta REST readings`
- [ ] 3.6 Validar end-to-end: ejecutar `alembic upgrade head`, desplegar backend, verificar que un uplink simulado de 16 bytes persiste `wind_direction` correctamente en PostgreSQL.
  `test(backend): validar ingesta wind_direction con payload 16 bytes`

## 4. Frontend — visualización de dirección de viento

- [ ] 4.1 Agregar tarjeta de métrica `wind_direction` en el dashboard React (`frontend/src/`): mostrar ángulo en grados y punto cardinal (N/NE/E/SE/S/SW/W/NW) calculado por sectores de 45°. Mostrar "—" si el valor es null.
  `feat(frontend): agregar tarjeta wind_direction con punto cardinal`
- [ ] 4.2 Verificar en el dev server (`pnpm dev`) que la tarjeta renderiza correctamente con datos mock y con el valor null. Confirmar que no hay errores de consola.
  `test(frontend): verificar tarjeta wind_direction en dev server`

## 5. Documentación

- [ ] 5.1 Actualizar `openspec/config.yaml` (bloque de arquitectura) y `CLAUDE.md` (sección de arquitectura) para reflejar el payload de 16 bytes con `veleta_dir`.
  `docs: actualizar arquitectura con payload 16 bytes y campo veleta_dir`
- [ ] 5.2 Actualizar `hardware/netlist.md` con pinout confirmado de la veleta, rango analógico medido y `V_max` determinado en campo.
  `docs(hardware): actualizar netlist con datos definitivos de la veleta`
