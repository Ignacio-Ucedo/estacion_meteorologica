## Context

El change `migrate-backend-influxdb` eliminó el sistema de usuarios (SQLAlchemy, PostgreSQL, JWT auth) porque no era parte del scope de esa migración. Sin embargo, el flujo operativo real requiere que cada estación quede asociada a un cliente al momento del flasheo, y que el frontend muestre solo las estaciones del cliente autenticado.

El backend ahora es completamente síncrono y usa InfluxDB para series temporales. No existe un store relacional para metadatos de larga vida (usuarios, passwords). La solución debe ser simple y sin regresiones en la arquitectura InfluxDB ya implementada.

## Goals / Non-Goals

**Goals:**
- Gestión de clientes (CRUD básico) en el backend, sin ORM ni PostgreSQL
- Asociación station↔cliente almacenada en InfluxDB (`owner_id` tag en `station_meta`)
- Wizard del operator-app: selección de cliente antes de flashear
- Wizard: llamada post-provisión para registrar la asociación
- Frontend: auth funcional end-to-end (login → JWT → filtro de stations)

**Non-Goals:**
- Roles / permisos granulares (un cliente = acceso a sus stations, no más)
- Reset de password, verificación de email, OAuth
- Multi-tenant avanzado (un cliente puede ver stations de otro si se le da acceso explícito)
- Admin panel web para gestión de clientes (el operario usa el CLI o la API directamente)

## Decisions

### D1: SQLite stdlib para usuarios (no ORM, no Postgres)

**Decisión**: `sqlite3` de Python standard library, acceso síncrono, archivo `users.db` montado en volumen Docker.

**Alternativas consideradas**:
- Re-agregar SQLAlchemy: descartado — volvería a mezclar ORM async con el backend ya migrado a sync.
- Usuarios en InfluxDB (measurement `user_meta`): descartado — InfluxDB no es un store de identidad; no soporta queries de login eficientes ni password hashing natural.
- JSON en disco: descartado — sin transaccionalidad, complicado para concurrencia (múltiples operarios simultáneos).

SQLite es la solución mínima con soporte de transacciones, hashing de passwords y sin dependencias extra.

### D2: `owner_id` como tag en InfluxDB `station_meta`

**Decisión**: El campo `owner_id` (UUID o username del cliente) se almacena como tag en `station_meta`. Para asociar/reasociar, se escribe un nuevo punto con el mismo `dev_eui` y el nuevo `owner_id`; la lectura usa `last()` que siempre devuelve el más reciente.

**Alternativas consideradas**:
- Campo separado fuera de InfluxDB (SQLite): habría dos fuentes de verdad para la station. Descartado por complejidad.
- Tag mutable en InfluxDB: InfluxDB no permite modificar tags de puntos existentes, pero escribir un nuevo punto con `last()` logra el mismo efecto de forma idiomática.

### D3: `GET /api/users` sin autenticación (uso interno operator-app)

**Decisión**: El endpoint de listado de clientes (`GET /api/users`) no requiere JWT. El operator-app corre en la red local del técnico y necesita listar clientes sin hacer login previo.

**Justificación**: El operator-app no tiene pantalla de login propia; es una herramienta interna de provisión. En producción, esta ruta estaría protegida por red (VPN/intranet), no por auth de aplicación.

### D4: Pantalla previa al wizard (no un step dentro del wizard)

**Decisión**: La selección de cliente es una pantalla separada que aparece antes de que el wizard comience (`CustomerSelect`), no un step dentro del `FlashWizard`. El `selectedCustomerId` se pasa como prop al wizard.

**Alternativas consideradas**:
- Step 0 dentro del wizard: complica la numeración y el `StepIndicator`; además la selección de cliente aplica a toda la sesión, no solo a un flash.
- Contexto global en la app: innecesariamente complejo para el PoC.

### D5: Asociación post-provisión en el último step del wizard

**Decisión**: Después del último step exitoso (ChirpStack o Registro), el wizard llama automáticamente a `PUT /api/stations/{station_id}/owner` con el `selectedCustomerId`. El `station_id` se deriva del `devEui` provisioned (`dev-{devEui[:8]}`).

**Justificación**: La asociación requiere que la station ya exista en `station_meta` (creada por el backend cuando llega el primer uplink). Para la fase de pruebas con datos sintéticos del `gateway-mock`, `ensure_station` ya crea el registro. El wizard puede llamar al endpoint inmediatamente sin esperar uplinks reales.

## Data Flow

```
Operator-App                  Backend                      InfluxDB
     │                            │                            │
     │  GET /api/users            │                            │
     │──────────────────────────► │                            │
     │  [{id, username}, ...]     │                            │
     │◄─────────────────────────  │                            │
     │                            │                            │
     │  [usuario selecciona]      │                            │
     │                            │                            │
     │  [wizard flashea ESP32]    │                            │
     │                            │                            │
     │  PUT /api/stations         │  write station_meta        │
     │    /{station_id}/owner     │  tag: owner_id=<userId>    │
     │──────────────────────────► │──────────────────────────► │
     │  204 No Content            │                            │
     │◄─────────────────────────  │                            │

Frontend                     Backend                      InfluxDB
     │                            │                            │
     │  POST /api/auth/login      │                            │
     │──────────────────────────► │                            │
     │  {access_token}            │  (verifica users.db)       │
     │◄─────────────────────────  │                            │
     │                            │                            │
     │  GET /api/stations         │  query station_meta        │
     │    Authorization: Bearer…  │  filter owner_id=<userId>  │
     │──────────────────────────► │──────────────────────────► │
     │  [{id, name, status}, ...] │                            │
     │◄─────────────────────────  │                            │
```

## InfluxDB Schema (delta)

**measurement `station_meta`** — tag `owner_id` agregado:

| Tipo | Nombre | Descripción |
|---|---|---|
| tag | `dev_eui` | identificador del dispositivo |
| tag | `station_id` | `dev-{dev_eui[:8]}` |
| tag | `owner_id` | username del cliente propietario (vacío = sin asignar) |
| field | `name` | nombre legible de la station |
| field | `location` | ubicación geográfica |

Para reasignar owner: escribir nuevo punto con `owner_id` actualizado. `last()` siempre retorna el estado actual.

## Risks / Trade-offs

**[Risk] SQLite con múltiples operarios simultáneos** → El acceso síncrono a SQLite con WAL mode soporta lecturas concurrentes; escrituras (register/login) son infrecuentes. Mitigación: habilitar WAL (`PRAGMA journal_mode=WAL`).

**[Risk] `owner_id` como tag inmutable en puntos existentes** → Los puntos históricos en `weather_reading` no tienen `owner_id`; la asociación solo existe en `station_meta`. Esto es suficiente porque `GET /api/stations` filtra por `station_meta`, y los datos de lecturas se consultan siempre a través de la station ya filtrada.

**[Risk] `ensure_station` escribe `owner_id=""` antes de que el wizard asigne el owner** → El wizard llama a `PUT /api/stations/{id}/owner` inmediatamente tras completar la provisión. Hay una ventana pequeña donde la station existe sin owner. El frontend filtra `owner_id == userId`, por lo que stations sin owner simplemente no aparecen para ningún cliente (solo para la vista interna sin auth). Aceptable para PoC.

**[Trade-off] Sin admin endpoint web** → Los clientes se crean via `POST /api/users` (curl o Postman). Para el PoC esto es suficiente; en producción se agregaría una UI de gestión.

## Migration Plan

1. Agregar `users.db` con `CREATE TABLE IF NOT EXISTS` en el startup del backend (sin migración explícita, idempotente).
2. El volumen Docker para `users.db` es persistente entre reinicios.
3. Las stations existentes en InfluxDB sin `owner_id` quedan como `owner_id=""` y no aparecen en el frontend de ningún cliente hasta ser reasignadas.
4. Rollback: eliminar el volumen `users.db` y revertir los cambios de código; las stations en InfluxDB no se ven afectadas.
