## Context

El dashboard tiene cuatro pestañas de escala temporal (1H · 7D · 30D · 1A). La de 1H consume `GET /api/stations/{id}/metrics/{metric}/hourly`, que agrega lecturas en buckets de 60 minutos de reloj. Con datos que llegan cada 30 s, el bucket de la hora actual puede tardar hasta 59 minutos en tener su primer valor — la gráfica aparece casi vacía hasta que transcurre una hora completa. El endpoint de lecturas recientes soluciona esto devolviendo filas individuales con su timestamp real.

## Goals / Non-Goals

**Goals:**
- Nuevo endpoint `GET /api/stations/{id}/metrics/recent` que devuelve lecturas individuales del último período (por defecto 60 min) para una métrica específica.
- Reemplazar la fuente de datos de la pestaña "1H" en `SelectedMetricChart` y `GraficasPanel` por el nuevo endpoint.
- El eje X de la vista 1H muestra la hora exacta de cada lectura (HH:MM) en lugar de horas de reloj.

**Non-Goals:**
- No se modifica el endpoint `/hourly` existente ni los componentes de las otras pestañas (7D · 30D · 1A).
- No se agrega WebSocket ni streaming en tiempo real — el refresh sigue siendo bajo demanda o periódico.
- No se agrega paginación al endpoint de lecturas recientes: en 60 min a 30 s/lectura son ≤120 puntos, manejable en una sola respuesta.

## Decisions

**1. Endpoint nuevo vs. parámetros al `/readings` existente.**
`/readings` devuelve todas las métricas paginadas y está orientado al log de historial. Agregar filtrado temporal + selección de métrica única lo haría polivalente pero más complejo. Se elige un endpoint dedicado `/metrics/recent` para mantener la misma convención que `/metrics/{metric}/hourly` y `/metrics/{metric}/daily`, y para devolver exactamente la forma que necesita la gráfica.

**2. Schema de respuesta.**
Array de `{timestamp: str (ISO 8601), value: float}` ordenado ascendente. Simple, sin wrapping innecesario.

```
GET /api/stations/{id}/metrics/{metric}/recent?minutes=60

200 OK
{
  "metric": "temperature",
  "unit": "°C",
  "minutes": 60,
  "points": [
    { "timestamp": "2026-07-02T16:31:20Z", "value": 15.2 },
    { "timestamp": "2026-07-02T16:31:50Z", "value": 15.3 },
    ...
  ]
}
```

**3. Parámetro `minutes`.**
Opcional, default 60, rango aceptado 1–1440 (máximo 24 h). Permite reutilizar el endpoint para ventanas más cortas o más largas sin duplicar rutas.

**4. Métricas soportadas.**
Las mismas que `/hourly`: `temperature`, `humidity`, `windSpeed`, `precipitation`. La conversión de nombre de métrica a columna de DB ya existe en `services/metrics.py`; se reutiliza.

**5. Eje X en el frontend.**
El componente recibe timestamps ISO y los formatea como `HH:MM`. Recharts ya maneja esto con un `tickFormatter`. No se cambia la librería de gráficas.

## Risks / Trade-offs

- [Riesgo] Si el intervalo de uplink vuelve a 10 min (producción), la vista de 1H mostrará solo ~6 puntos. Es suficiente para ver tendencia y mejora sobre el bucket vacío. El label "1H" sigue siendo correcto.
- [Trade-off] Se agrega un endpoint nuevo en lugar de generalizar `/readings`: más fácil de mantener y testear de forma aislada, a costa de una ruta adicional.
