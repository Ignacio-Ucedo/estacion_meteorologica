## Context

El backend real (a diferencia de lo sugerido en `openspec/config.yaml`) usa **PostgreSQL + TimescaleDB** vía SQLAlchemy async, no InfluxDB. El modelo `Reading` (`backend/app/db/models.py`) almacena una fila por lectura con columnas planas (`temperature`, `humidity`, `wind_speed`, `wind_direction`, `precipitation`). El endpoint `GET /api/stations/{id}` (`backend/app/api/routes.py`) lee la última fila vía `latest_reading()` y la mapea a `CurrentReading`. No existe todavía un endpoint de ingesta desde el gateway; los datos provienen de seeds/migraciones de desarrollo.

Este change es puramente de backend. En paralelo, otro integrante del equipo trabaja el change `add-battery-level-frontend`, que ya agrega la visualización de batería al dashboard principal usando un mock, anticipando el tipo `batteryLevel: number | null` (porcentaje 0-100). Ambos changes están desacoplados deliberadamente para que cada uno avance sin bloquear al otro.

## Goals / Non-Goals

**Goals:**
- Modelar `battery_level` como un porcentaje (0-100) en el dominio `Reading`, consistente con la convención ya acordada con el frontend.
- Exponer `batteryLevel` en `CurrentReading` (vía `GET /api/stations/{id}`) y en `ReadingResponse` (vía `GET /api/stations/{id}/readings`).
- Mantener retrocompatibilidad: el campo es aditivo, no rompe consumidores existentes de la API.

**Non-Goals:**
- No se implementa el firmware ni el gateway que efectivamente miden y transmiten `bateria_mv`; ese trabajo queda para una iteración futura (el payload LoRa ya lo contempla en `openspec/config.yaml`).
- No se modifica el frontend; la integración real del dashboard con este endpoint es una tarea de seguimiento separada, posterior a que ambos changes (este y `add-battery-level-frontend`) estén mergeados.
- No se agrega lógica de alertas/notificaciones por batería baja.
- No se migra dato histórico real desde InfluxDB; se trabaja sobre el esquema PostgreSQL/TimescaleDB actual.
- No se agrega batería a los endpoints `hourly`/`daily` de métricas; solo a `current` y al historial paginado.

## Decisions

1. **Unidad de almacenamiento: porcentaje (0-100), no milivoltios.**
   - Alternativa considerada: guardar `battery_mv` (u16) tal como llega del payload LoRa sugerido y convertir a porcentaje en el frontend.
   - Se elige porcentaje porque es lo que ya espera la UI del frontend (acordado con el change `add-battery-level-frontend`) y porque la conversión mV→% depende de la curva de descarga de la batería específica, una decisión de firmware que todavía no está definida. Cuando el firmware exista, el gateway o el backend deberán hacer esa conversión antes de persistir.

2. **Campo nuevo y nullable en `Reading`, no una tabla separada.**
   - Alternativa: tabla `battery_readings` separada por timestamp/estación.
   - Se elige una columna en `Reading` porque la batería se mide en el mismo paquete LoRa que el resto de las variables ambientales (mismo timestamp, misma estación), igual que `wind_speed` o `precipitation`. Nullable para no romper filas históricas existentes sin dato de batería.

3. **Migración Alembic aditiva con `nullable=True` y sin backfill obligatorio.**
   - Las lecturas existentes no tienen `battery_level`; se deja `NULL`. El consumidor (frontend) es responsable de manejar el caso `null`.

## Risks / Trade-offs

- [Riesgo] El dato de batería es mock/seed hasta que exista firmware real → [Mitigación] Documentado explícitamente como Non-Goal; el contrato de API queda listo para cuando el gateway empiece a enviar el campo real.
- [Riesgo] El contrato asumido (porcentaje 0-100, nullable) podría no coincidir con lo que el frontend finalmente necesite → [Mitigación] Ambos changes documentan explícitamente la misma convención; cualquier ajuste se resuelve en la tarea de integración posterior.
- [Riesgo] Valores `null` históricos podrían romper cálculos de agregación si se reutiliza el pipeline de métricas (`metrics.py`) sin chequeo de nulos → [Mitigación] Esta iteración no toca `services/metrics.py` ni los endpoints `hourly`/`daily`.

## Migration Plan

1. Agregar migración Alembic: `ALTER TABLE readings ADD COLUMN battery_level FLOAT NULL`.
2. Desplegar backend con el nuevo campo (no requiere downtime, columna nullable).
3. Actualizar seeds/fixtures de desarrollo para incluir valores de ejemplo.
4. Rollback: revertir con `downgrade` de Alembic si fuera necesario (columna se puede eliminar sin pérdida de otros datos, ya que ningún otro campo depende de ella).

## Open Questions

- ¿Quién y cuándo hace el trabajo de integración final (conectar el frontend real a este endpoint, reemplazando el mock de `add-battery-level-frontend`)? Queda fuera de alcance de ambos changes; sugerido como un tercer change pequeño de integración.
