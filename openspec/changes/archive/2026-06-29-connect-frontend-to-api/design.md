## Context

El frontend tiene actualmente toda su lógica de datos dentro del propio bundle: `WeatherSeries.ts` genera series temporales pseudo-aleatorias deterministas; `Stationlog.ts` simula lecturas en vivo a intervalos fijos; `StationManagmentPanel.tsx` tiene un array de 10 estaciones hardcodeadas; `App.tsx` tiene inline los valores actuales de la estación "alpha". El backend FastAPI (change `implement-backend-rest-api`, 23/23 completado) expone todos los endpoints necesarios contra PostgreSQL. La base de datos ya contiene datos reales de la estación.

El cambio consiste en agregar una capa de cliente HTTP y redirigir cada componente a su endpoint correspondiente, eliminando la generación de datos en el cliente.

---

## Goals / Non-Goals

**Goals:**
- Exponer datos reales de PostgreSQL en los cuatro paneles del dashboard (StationPanel, MetricCards, ChartCard, StationLogPanel, StationManagementPanel).
- Introducir una capa de cliente HTTP tipado centralizada bajo `frontend/src/api/`.
- Manejar estados de carga y error en todos los puntos de consumo.
- Habilitar CORS en FastAPI para el origen de desarrollo Vite.

**Non-Goals:**
- WebSockets o subscripciones en tiempo real — el polling es suficiente para un prototipo académico.
- Autenticación — la API no requiere token por ahora.
- Multi-estación dinámica en el dashboard principal — el panel principal siempre muestra la estación "alpha".
- Nivel de batería desde la API — queda como valor `null` hasta completar `add-battery-level-backend`.
- Caching HTTP avanzado (SWR, React Query) — no se introducen dependencias nuevas.

---

## Data Flow

```
FastAPI  http://localhost:8000/api
  │
  ├─ GET /stations                              ──► StationManagementPanel
  │                                                  (lista de estaciones, paginada en cliente)
  │
  ├─ GET /stations/alpha                        ──► App.tsx
  │    → {name, location, status,                    StationPanel (nombre, estado)
  │       lastUpdatedAt, current{temp,hum,…}}        MetricCards (valores actuales)
  │
  ├─ GET /stations/alpha/readings               ──► StationLogPanel
  │    ?page=N&search=X                              (tabla histórica paginada, polling 30s)
  │
  ├─ GET /stations/alpha/metrics/{m}/hourly     ──► ChartCard (modo 1D)
  │    → {points: [{hour, value}]}                   SelectedMetricChart, GraficasPanel
  │
  └─ GET /stations/alpha/metrics/{m}/daily      ──► ChartCard (modos 7D / 30D / 1Y)
       ?days=7|30|365
       → {summaries: [{date, min, max, mean, …}]}
```

---

## Decisions

### 1. Cliente HTTP: fetch nativo con wrappers tipados

**Decisión**: función `apiFetch<T>(path, init?)` que hace `fetch(BASE_URL + path)` y lanza error si `!response.ok`. Cada endpoint es una función exportada: `getStation(id)`, `getHourly(id, metric)`, etc.

**Alternativa descartada**: Axios o React Query. Agregan dependencias y complejidad que no se justifican para la cantidad de endpoints del proyecto. El fetch nativo más un hook `useFetch` personalizado es suficiente.

### 2. CORS: CORSMiddleware en FastAPI

**Decisión**: Agregar `CORSMiddleware` a `backend/app/main.py` con `allow_origins=["http://localhost:5173"]` (o `["*"]` para desarrollo).

**Alternativa descartada**: Proxy de Vite (`vite.config.ts → server.proxy`). Funcionaría igualmente pero requiere configuración adicional en el frontend y no resuelve el problema si el frontend se despliega separado del proxy.

### 3. Identificador de estación activa: constante `STATION_ID`

**Decisión**: `export const STATION_ID = "alpha"` en `frontend/src/api/config.ts`. Todos los hooks y componentes que necesiten el id lo importan de ahí.

**Alternativa descartada**: Cargar la lista de estaciones y tomar la primera. Agrega una petición extra y complejidad de bootstrap. Dado que el proyecto tiene una única estación real, la constante es correcta y honesta.

### 4. Patrón de estado: hooks personalizados con useState + useEffect

**Decisión**: Un hook por dominio de datos: `useStation(id)`, `useStations()`, `useReadings(id, page, search)`, `useHourlyMetric(id, metric)`, `useDailyMetric(id, metric, days)`. Cada uno retorna `{ data, loading, error }`.

**Alternativa descartada**: Context global o estado compartido. El árbol de componentes es pequeño y cada panel es independiente; el Context introduciría acoplamiento innecesario.

### 5. StationLogPanel: polling cada 30 segundos

**Decisión**: El panel de historial reemplaza el generador de lecturas por `useReadings`. La primera carga al montar el componente, y luego se refresca automáticamente cada 30 s mediante `setInterval`. La paginación es server-side. El botón "Pausar" detiene el polling.

**Cambio de comportamiento respecto al mock**: Las filas ya no aparecen en tiempo real con animación por cada reading nueva — los datos llegan en lotes al refrescar. La animación de entrada (`log-row-enter`) se aplica a todas las filas del primer render de cada página.

### 6. ChartCard: fetch bajo demanda por modo de tiempo

**Decisión**: `ChartCard` recibe `metricKey` y `stationId` y llama a los hooks internamente. El fetch hourly se dispara siempre; los daily se disparan solo si el modo seleccionado es 7D/30D/1Y (lazy). Mientras el dato no llega, se muestra un skeleton.

**Alternativa descartada**: Prefetch de todos los modos al montar. Haría 4 métricas × 4 modos = 16 peticiones simultáneas al abrir la página. Lazy es más eficiente.

### 7. Tipos de respuesta: derivados del spec de la API existente

No se genera código desde OpenAPI. Los tipos TypeScript se escriben a mano en `frontend/src/api/types.ts` tomando como referencia `openspec/specs/backend-API/spec.md`. No hay herramienta de codegen para evitar una dependencia de build más.

---

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| Backend offline durante desarrollo | Cada hook muestra estado `error` con mensaje legible; los componentes no crashean |
| Base de datos vacía (no hay lecturas en PostgreSQL) | Manejar arrays vacíos y `current: null` en todos los componentes; mostrar estado "sin datos" |
| CORS mal configurado en producción | La constante `STATION_ID` y la `BASE_URL` se exponen como variables de entorno Vite (`VITE_API_URL`) para facilitar el deploy |
| Los tipos de respuesta divergen del spec | Agregar `console.warn` ante campos inesperados; los campos opcionales se tiypan con `| null` |
| `StationManagementPanel` mostrará solo estaciones reales (1) en vez de 10 mock | Comportamiento correcto para un prototipo; la paginación del cliente simplemente mostrará 1 página |

---

## Migration Plan

1. Agregar `CORSMiddleware` al backend (sin reiniciar schema, sin migración).
2. Crear `frontend/src/api/` con cliente, tipos y hooks — sin tocar componentes existentes aún.
3. Migrar componentes uno por uno, empezando por `App.tsx` (datos de estación y métricas actuales).
4. Migrar `SelectedMetricChart` y `GraficasPanel` (gráficos horarios y diarios).
5. Migrar `StationLogPanel` (historial paginado).
6. Migrar `StationManagementPanel` (lista de estaciones).
7. Eliminar o vaciar `WeatherSeries.ts` y `Stationlog.ts` (conservar solo los tipos que aún se usen en componentes).

**Rollback**: Cualquier componente puede revertir a los datos mock en < 5 min restaurando el import original. No hay cambios destructivos en el backend.

---

## Open Questions

- ¿El backend ya tiene datos cargados en PostgreSQL suficientes para que los gráficos no aparezcan vacíos? Si no, habrá que cargar datos de prueba antes de implementar.
- ¿`VITE_API_URL` debe apuntar a `http://localhost:8000` en `.env.local`? Confirmar el puerto que usa FastAPI en el entorno de desarrollo.
