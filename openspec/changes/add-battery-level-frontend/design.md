## Context

`App.tsx` renderiza el dashboard principal con `MetricCard` y datos hardcodeados (no consume la API todavía). `StationManagmentPanel.tsx` ya resuelve el problema de "cómo mostrar batería" visualmente con `BatteryBar` (umbrales de color por severidad), pero sobre un tipo local `ManagedStation.battery` definido dentro del mismo archivo.

Este change es puramente de frontend. En paralelo, otro integrante del equipo trabaja el change `add-battery-level-backend`, que agrega `batteryLevel` al modelo `Reading` y a los endpoints `GET /api/stations/{id}` y `GET /api/stations/{id}/readings`. Ambos changes están desacoplados deliberadamente para que cada uno se pueda desarrollar, revisar y mergear sin esperar al otro.

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

1. **Mock local en `App.tsx` en lugar de esperar al backend.**
   - Alternativa: bloquear este change hasta que `add-battery-level-backend` esté mergeado.
   - Se elige avanzar con mock porque el dashboard principal ya muestra datos hardcodeados para el resto de las métricas; agregar batería con el mismo patrón no introduce inconsistencia y permite trabajo en paralelo entre los dos desarrolladores.

2. **Extraer `BatteryBar` a un componente compartido (`frontend/src/components/BatteryBar.tsx`).**
   - Alternativa: duplicar el JSX de la barra de batería dentro de `App.tsx`.
   - Se elige extraer el componente para que los umbrales de color no diverjan entre el dashboard principal y `StationManagmentPanel.tsx` con el tiempo.

3. **Tipo `batteryLevel: number | null`, no `number` con default 0.**
   - Se modela como nullable desde el inicio porque el contrato real del backend (definido en `add-battery-level-backend`) devolverá `null` cuando no haya dato registrado; diseñar la UI para ese caso desde ahora evita retrabajo en la integración.

## Risks / Trade-offs

- [Riesgo] El dato de batería en el dashboard principal es mock hasta que se integre con el backend real → [Mitigación] Documentado como Non-Goal; la integración real queda como una tarea de seguimiento separada, fuera de ambos changes, una vez que `add-battery-level-backend` esté mergeado.
- [Riesgo] Divergencia de umbrales de color si se duplica lógica entre dashboard y panel de gestión → [Mitigación] Extraer `BatteryBar` a un componente compartido (Decisión 2).
- [Riesgo] El contrato de tipos asumido (`batteryLevel: number | null`, escala 0-100) podría no coincidir exactamente con lo que finalmente implemente `add-battery-level-backend` → [Mitigación] Ambos changes documentan explícitamente la misma convención (porcentaje 0-100, nullable) para minimizar el riesgo de desalineación.

## Open Questions

- ¿El umbral de "batería baja" (25%) debería ser configurable por estación/tipo de panel solar, o un valor fijo global como hoy en `StationManagmentPanel.tsx`? Por ahora se mantiene fijo y global.
- ¿Quién y cuándo hace el trabajo de integración final (reemplazar el mock por el fetch real una vez que el backend esté listo)? Queda fuera de alcance de ambos changes; sugerido como un tercer change pequeño de integración.
