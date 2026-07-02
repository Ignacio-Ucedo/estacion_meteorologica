## Context

El backend real (a diferencia de lo sugerido en `openspec/config.yaml`) usa **PostgreSQL + TimescaleDB** vía SQLAlchemy async, no InfluxDB. El modelo `Reading` (`backend/app/db/models.py`) almacena una fila por lectura con columnas planas (`temperature`, `humidity`, `wind_speed`, `wind_direction`, `precipitation`). El endpoint `GET /api/stations/{id}` (`backend/app/api/routes.py`) lee la última fila vía `latest_reading()` y la mapea a `CurrentReading`. No existe todavía un endpoint de ingesta desde el gateway; los datos provienen de seeds/migraciones de desarrollo.

Este change es puramente de backend. El change `add-battery-level-frontend` ya agregó la visualización de batería al dashboard principal (componente `BatteryBar`, mergeado en `7147f72`), anticipando el tipo `batteryLevel: number | null` (porcentaje 0-100). Ambos changes se diseñaron desacoplados deliberadamente para que cada uno avanzara sin bloquear al otro — eso ya ocurrió.

**Actualización:** entre el merge de `add-battery-level-frontend` y hoy, el change `connect-frontend-to-api` (archivado) reescribió `App.tsx` para consumir la API real y en el proceso descartó el mock local de batería sin reemplazarlo por nada. El resultado es que `BatteryBar` está hoy cableado a `value={null}` de forma permanente en `App.tsx` y en `StationManagmentPanel.tsx`, y el tipo `CurrentReading` en `frontend/src/api/types.ts` no tiene campo de batería. El contrato de tipos que este change necesita exponer (`batteryLevel: number | null`) ya no existe en ningún lado del frontend — hay que volver a agregarlo como parte de la integración de este change, no asumir que ya está.

## Goals / Non-Goals

**Goals:**
- Modelar `battery_level` como un porcentaje (0-100) en el dominio `Reading`, **NOT NULL con default `0`**, consistente con la convención acordada con el frontend.
- Exponer `batteryLevel` en `CurrentReading` (vía `GET /api/stations/{id}`) y en `ReadingResponse` (vía `GET /api/stations/{id}/readings`) como un `float` no opcional.
- Mantener retrocompatibilidad: el campo es aditivo, no rompe consumidores existentes de la API; las filas existentes se backfillean a `0`, no quedan en `NULL`.

**Non-Goals:**
- No se implementa el firmware ni el gateway que efectivamente miden y transmiten `bateria_mv`; ese trabajo queda para una iteración futura (el payload LoRa ya lo contempla en `openspec/config.yaml`).
- No se rediseña el frontend ni se toca `BatteryBar`, `StationManagmentPanel.tsx` ni el resto de la UI de batería (ya construidos por `add-battery-level-frontend`); el único trabajo de frontend en alcance es el mínimo necesario para reconectar el dato real: agregar `batteryLevel` a `frontend/src/api/types.ts` y reemplazar el `null` hardcodeado en `App.tsx` (ver Migration Plan).
- ~~No se resuelve la batería de `StationManagmentPanel.tsx`~~ — **ampliado durante la implementación**: el usuario pidió explícitamente que la batería deje de mostrar "Sin dato" tanto en el dashboard como en el listado de gestión de estaciones. `GET /api/stations` ahora incluye `batteryLevel` por estación (última lectura conocida, vía subquery en `list_stations()`), ver Decisión 5.
- No se agrega lógica de alertas/notificaciones por batería baja.
- No se migra dato histórico real desde InfluxDB; se trabaja sobre el esquema PostgreSQL/TimescaleDB actual.
- No se agrega batería a los endpoints `hourly`/`daily` de métricas; solo a `current` y al historial paginado.

## Decisions

1. **Unidad de almacenamiento: porcentaje (0-100), no milivoltios.**
   - Alternativa considerada: guardar `battery_mv` (u16) tal como llega del payload LoRa sugerido y convertir a porcentaje en el frontend.
   - Se elige porcentaje porque es lo que ya espera la UI del frontend (acordado con el change `add-battery-level-frontend`) y porque la conversión mV→% depende de la curva de descarga de la batería específica, una decisión de firmware que todavía no está definida. Cuando el firmware exista, el gateway o el backend deberán hacer esa conversión antes de persistir.

2. **Campo nuevo en `Reading`, no una tabla separada.**
   - Alternativa: tabla `battery_readings` separada por timestamp/estación.
   - Se elige una columna en `Reading` porque la batería se mide en el mismo paquete LoRa que el resto de las variables ambientales (mismo timestamp, misma estación), igual que `wind_speed` o `precipitation`.

3. **Columna NOT NULL con default `0`, no nullable.**
   - Alternativa considerada (y descartada): `battery_level` nullable, devolviendo `null` cuando no hay dato registrado, análogo a como el resto de este documento lo planteaba originalmente.
   - Se descarta nullable por decisión de producto: el nivel de batería de una lectura nunca debe ser `null`; si no se registra explícitamente, el valor por defecto es `0`. Esto simplifica el consumidor (frontend no necesita un branch `null` para el campo en sí) y evita ambigüedad entre "batería en 0%" y "sin dato". La ambigüedad de "sin dato" solo existe a nivel de `current` completo (estación sin ninguna lectura), no a nivel del campo `battery_level` de una lectura existente.

4. **Migración Alembic con `nullable=False` y backfill automático vía `server_default`.**
   - Las lecturas existentes no tienen `battery_level`; la migración usa `server_default="0"` para que Postgres backfillee todas las filas existentes a `0` en la misma sentencia `ALTER TABLE`, sin necesidad de un `UPDATE` separado. El `server_default` se mantiene tras la migración para que inserts futuros que omitan el campo también reciban `0`.

## Risks / Trade-offs

- [Riesgo] El dato de batería es mock/seed hasta que exista firmware real → [Mitigación] Documentado explícitamente como Non-Goal; el contrato de API queda listo para cuando el gateway empiece a enviar el campo real.
- [Riesgo] El contrato asumido (porcentaje 0-100, NOT NULL default `0`) podría no coincidir con lo que el frontend finalmente necesite → [Mitigación] Ambos changes documentan explícitamente la misma convención; cualquier ajuste se resuelve en la tarea de integración posterior.
- [Riesgo] Un valor `0` real (batería efectivamente agotada) es indistinguible de un `0` por default/ausencia de dato → [Mitigación] Aceptado como trade-off de la decisión de producto de no usar `null`; si en el futuro se necesita distinguir ambos casos, se puede reevaluar agregando una bandera separada (ej. `battery_level_reported: bool`), fuera de alcance de este change.

## Migration Plan

1. Agregar migración Alembic: `ALTER TABLE readings ADD COLUMN battery_level FLOAT NOT NULL DEFAULT 0`.
2. Desplegar backend con el nuevo campo (no requiere downtime; Postgres backfillea las filas existentes a `0` como parte del `ALTER TABLE`).
3. Actualizar seeds/fixtures de desarrollo para incluir valores de ejemplo.
4. Frontend: agregar `battery_level: float = Field(alias="batteryLevel", default=0)`-equivalente (`batteryLevel: number`, no `| null`) a `CurrentReading` y `ReadingResponse` en `frontend/src/api/types.ts`, y reemplazar `<BatteryBar value={null} />` por `<BatteryBar value={station?.current?.batteryLevel ?? null} />` en `App.tsx` (el `?? null` sigue cubriendo solo el caso "estación sin ninguna lectura").
5. Rollback: revertir con `downgrade` de Alembic si fuera necesario (columna se puede eliminar sin pérdida de otros datos, ya que ningún otro campo depende de ella). El paso 4 de frontend se revierte volviendo al `null` hardcodeado.

5. **`GET /api/stations` (listado) también expone `batteryLevel`, resuelto con una subquery correlacionada, no N+1.**
   - Alternativa descartada: hacer un request adicional por estación desde el frontend (N+1), o un `LEFT JOIN` con `ROW_NUMBER() OVER (PARTITION BY station_id)`.
   - Se elige una subquery escalar correlacionada (`SELECT battery_level FROM readings WHERE station_id = stations.id ORDER BY timestamp DESC LIMIT 1`) por simplicidad: el tamaño de página es fijo y pequeño (6 estaciones), y evita el join+`row_number` más verboso para un caso de un solo campo. Si en el futuro se necesita más de un campo de "última lectura" en el listado, reevaluar hacia el `ROW_NUMBER()`.
   - Implica que `StationResponse` (y por herencia `StationDetail`) ahora incluye `batteryLevel` a nivel de estación, además de `current.batteryLevel` en el detalle — redundante en `GET /api/stations/{id}`, pero simplifica no tener que introducir una clase de schema separada solo para el listado.

## Open Questions

- (Resuelta) ¿Quién hace la integración final del frontend? Se implementó en este mismo change (frontend + backend), dado que el mock que originalmente iba a servir de puente (`add-battery-level-frontend`) ya no existía en el código.
- (Resuelta) ¿Vale la pena exponer `batteryLevel` también en `GET /api/stations` (listado)? Sí — implementado (Decisión 5), a pedido explícito del usuario para que `StationManagmentPanel.tsx` deje de mostrar el placeholder fijo.
