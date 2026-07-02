## Context

`App.tsx` renderizaba el dashboard principal con `MetricCard` y datos hardcodeados (no consumía la API todavía). `StationManagmentPanel.tsx` ya resolvía el problema de "cómo mostrar batería" visualmente con `BatteryBar` (umbrales de color por severidad), pero sobre un tipo local `ManagedStation.battery` definido dentro del mismo archivo.

Este change fue puramente de frontend y se mergeó según lo planeado (commit `7147f72`). En paralelo, otro integrante del equipo trabaja el change `add-battery-level-backend`, que agrega `batteryLevel` al modelo `Reading` y a los endpoints `GET /api/stations/{id}` y `GET /api/stations/{id}/readings`. Ambos changes se diseñaron desacoplados deliberadamente para que cada uno se pudiera desarrollar, revisar y mergear sin esperar al otro — eso funcionó.

**Lo que no se anticipó:** un tercer change, `connect-frontend-to-api` (archivado, commit `d74ca54`, dos días después), reemplazó por completo los datos hardcodeados de `App.tsx` por fetches reales a la API (`useStation`/`useStations`) para todas las demás métricas (temperatura, humedad, viento, precipitación). Ese change no tenía en su alcance la batería —porque el backend real todavía no la expone— y simplemente dejó `<BatteryBar value={null} />` fijo donde antes había un mock variable. El resultado neto hoy: todas las demás métricas del dashboard son datos en vivo, pero la batería es la única que quedó "muerta" (siempre "Sin dato"), rompiendo la premisa original de este change de mostrarla como una métrica visible más.

## Goals / Non-Goals

**Goals:**
- Mostrar el nivel de batería en el dashboard principal con la misma codificación visual de severidad ya validada en `StationManagmentPanel.tsx` (verde >60%, naranja 25-60%, rojo <25%).
- Extraer `BatteryBar` a un componente compartido para que el dashboard principal y el panel de gestión usen la misma lógica de severidad, sin duplicarla.
- Definir el tipo `batteryLevel: number | null` en el frontend de forma anticipada, para que la futura integración con la API real del backend sea un cambio mínimo (solo reemplazar la fuente del dato).

**Non-Goals:**
- No se consume ningún endpoint real del backend; este change usa un valor mock/local, igual que el resto de las métricas de `App.tsx` hoy.
- No se modifica `backend/`. La definición del contrato real de API (`batteryLevel` en `CurrentReading`/`ReadingResponse`) es responsabilidad del change `add-battery-level-backend`.
- No se agrega lógica de alertas/notificaciones por batería baja (solo indicación visual).
- No se unifica `StationManagmentPanel.tsx` para que consuma una API real; sigue usando su mock `INITIAL_STATIONS`, solo se le actualiza el import de `BatteryBar`.

## Decisions

1. **Mock local en `App.tsx` en lugar de esperar al backend.** *(superada por eventos)*
   - Alternativa: bloquear este change hasta que `add-battery-level-backend` esté mergeado.
   - Se eligió avanzar con mock porque el dashboard principal mostraba datos hardcodeados para el resto de las métricas; agregar batería con el mismo patrón no introducía inconsistencia y permitía trabajo en paralelo entre los dos desarrolladores.
   - **Ya no aplica:** `App.tsx` no tiene ningún dato hardcodeado desde `connect-frontend-to-api` — todas las métricas salen de `station.current` vía API real. Reintroducir un mock aislado solo para batería sería inconsistente con el resto del componente. La resolución correcta ahora es esperar al dato real de `add-battery-level-backend`, no reinstalar un mock.

2. **Extraer `BatteryBar` a un componente compartido (`frontend/src/components/BatteryBar.tsx`).**
   - Alternativa: duplicar el JSX de la barra de batería dentro de `App.tsx`.
   - Se elige extraer el componente para que los umbrales de color no diverjan entre el dashboard principal y `StationManagmentPanel.tsx` con el tiempo.

3. **Tipo `batteryLevel: number`, no `number | null`.** *(revisado)*
   - Planteo original: modelar como `number | null` porque se asumía que el backend devolvería `null` cuando no hubiera dato registrado.
   - **Decisión de producto (actualizada):** el campo de batería de una estación nunca es `null`; si no hay dato explícito, el backend (`add-battery-level-backend`) devuelve `0` por defecto. El tipo del lado frontend se alinea a esa garantía: `batteryLevel: number`, sin `| null`.
   - El único `null` que sigue existiendo en esta zona de la UI es el de `station.current` completo (estación sin ninguna lectura), no el del campo de batería en sí — por eso `BatteryBar` conserva su prop `value: number | null`, pero ese `null` ahora representa "no hay lectura alguna", no "batería sin dato".

## Risks / Trade-offs

- [Riesgo] El dato de batería en el dashboard principal es mock hasta que se integre con el backend real → [Mitigación] Documentado como Non-Goal; la integración real queda como una tarea de seguimiento separada, fuera de ambos changes, una vez que `add-battery-level-backend` esté mergeado.
- [Riesgo] Divergencia de umbrales de color si se duplica lógica entre dashboard y panel de gestión → [Mitigación] Extraer `BatteryBar` a un componente compartido (Decisión 2).
- [Riesgo] El contrato de tipos asumido (`batteryLevel: number`, escala 0-100, sin `null`) podría no coincidir exactamente con lo que finalmente implemente `add-battery-level-backend` → [Mitigación] Ambos changes documentan explícitamente la misma convención (porcentaje 0-100, NOT NULL default `0`) para minimizar el riesgo de desalineación.

## Open Questions

- ¿El umbral de "batería baja" (25%) debería ser configurable por estación/tipo de panel solar, o un valor fijo global como hoy en `StationManagmentPanel.tsx`? Por ahora se mantiene fijo y global.
- (Resuelta) ¿Quién y cuándo hace el trabajo de integración final? Se registró como sección 4 ("Integración mínima de frontend") de `tasks.md` en `add-battery-level-backend`, ya que ese change es el que finalmente expone el dato real y el mock intermedio que originalmente iba a servir de puente ya no existe.
- ¿Se necesita alguna acción en *este* change (`add-battery-level-frontend`) además de la documentación? No para código: el componente `BatteryBar` y su integración visual siguen siendo válidos y no requieren cambios; sólo el dato que reciben está pendiente de otro change. Este documento se actualiza únicamente para que el estado quede trazable.
