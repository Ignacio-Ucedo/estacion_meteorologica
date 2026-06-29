## ADDED Requirements

### Requirement: Cliente HTTP tipado centralizado
El frontend SHALL exponer un módulo `src/api/` con funciones tipadas en TypeScript para cada endpoint de la API REST del backend. Toda comunicación HTTP del frontend SHALL pasar por este módulo.

#### Scenario: Llamada exitosa a la API
- **WHEN** se invoca una función del cliente (e.g. `getStation("alpha")`)
- **THEN** el módulo realiza un `fetch` a `VITE_API_URL/api/stations/alpha` y retorna el objeto tipado

#### Scenario: Error HTTP de la API
- **WHEN** la API responde con un código de estado ≥ 400
- **THEN** el cliente lanza un error con el mensaje y el código de status

#### Scenario: Backend no disponible
- **WHEN** el `fetch` falla por error de red (conexión rechazada, timeout)
- **THEN** el cliente lanza un error con mensaje descriptivo

### Requirement: URL base configurable por variable de entorno
La URL base del backend SHALL leerse de la variable de entorno `VITE_API_URL`. Si no está definida, el valor por defecto SHALL ser `http://localhost:8000`.

#### Scenario: Variable de entorno definida
- **WHEN** `VITE_API_URL=http://192.168.1.10:8000` está definida en `.env.local`
- **THEN** todas las peticiones se envían a `http://192.168.1.10:8000/api/...`

#### Scenario: Variable de entorno no definida
- **WHEN** `VITE_API_URL` no está definida
- **THEN** las peticiones se envían a `http://localhost:8000/api/...`

### Requirement: Identificador de estación activa
El módulo SHALL exportar la constante `STATION_ID` con el valor `"alpha"`, usada por todos los componentes que consumen datos de una estación específica.

#### Scenario: Estación activa en todas las peticiones de métricas
- **WHEN** cualquier componente necesita datos de la estación activa
- **THEN** importa `STATION_ID` de `src/api/config.ts` y lo pasa al hook correspondiente

### Requirement: Hooks de datos por dominio
El módulo SHALL proveer los siguientes hooks React, cada uno con retorno `{ data: T | null, loading: boolean, error: string | null }`:

- `useStation(id)` — datos de `GET /api/stations/{id}` (nombre, estado, lectura actual)
- `useStations()` — lista de `GET /api/stations`
- `useReadings(id, page, search)` — página de `GET /api/stations/{id}/readings`
- `useHourlyMetric(id, metric)` — serie horaria de `GET /api/stations/{id}/metrics/{metric}/hourly`
- `useDailyMetric(id, metric, days)` — serie diaria de `GET /api/stations/{id}/metrics/{metric}/daily?days=N`

#### Scenario: Estado de carga inicial
- **WHEN** un hook se monta por primera vez
- **THEN** retorna `{ data: null, loading: true, error: null }` hasta que la petición completa

#### Scenario: Carga exitosa
- **WHEN** la API responde con 200
- **THEN** el hook retorna `{ data: <response>, loading: false, error: null }`

#### Scenario: Carga con error
- **WHEN** la API responde con error o la red falla
- **THEN** el hook retorna `{ data: null, loading: false, error: "<mensaje>" }`

### Requirement: CORS habilitado en el backend para desarrollo
El backend FastAPI SHALL incluir `CORSMiddleware` configurado para aceptar peticiones desde `http://localhost:5173` (origen del dev server de Vite) en el entorno de desarrollo.

#### Scenario: Petición cross-origin desde el frontend
- **WHEN** el frontend en `http://localhost:5173` realiza un `fetch` a `http://localhost:8000/api/stations`
- **THEN** la respuesta incluye los headers `Access-Control-Allow-Origin` correspondientes y el navegador no bloquea la petición
