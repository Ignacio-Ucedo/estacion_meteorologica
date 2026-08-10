## Why

Cada estación meteorológica pertenece a un cliente final que la supervisa a través del frontend. El wizard del operator-app flashea y provisiona dispositivos sin registrar a qué cliente pertenece el equipo, lo que impide filtrar datos por propietario en el frontend. En producción esta asociación es esencial: un cliente no debe ver estaciones ajenas.

## What Changes

- **Backend**: gestión liviana de usuarios/clientes usando `sqlite3` nativo de Python (sin ORM, sync). Tablas: `users` (id, username, password_hash, created_at). Rutas: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
- **Backend**: campo `owner_id` como tag en la measurement `station_meta` de InfluxDB. `GET /api/stations` filtra por `owner_id` cuando hay JWT válido en el request; sin JWT devuelve todas (uso interno del operator-app).
- **Backend**: nuevo endpoint `PUT /api/stations/{station_id}/owner` para asociar una station a un cliente tras el flasheo.
- **Backend**: `GET /api/users` (solo interno, sin auth requerida) para que el operator-app liste clientes disponibles.
- **Operator-app**: pantalla de selección de cliente antes de iniciar el wizard. Llama a `GET /api/users` del backend configurado.
- **Operator-app**: al completar la provisión (último step), llama a `PUT /api/stations/{station_id}/owner` con el cliente seleccionado.
- **Frontend**: el `AuthContext`/`useAuth` ya existe; se restauran los endpoints de auth backend necesarios para que el login funcione end-to-end.

Componentes **no afectados**: firmware, gateway, android, 3d.

## Capabilities

### New Capabilities

- `customer-station-ownership`: gestión de clientes en el backend (SQLite), asociación station↔cliente en InfluxDB (`owner_id` tag), endpoint de listado de clientes para el operator-app, endpoint de asignación de propietario, filtro por propietario en la API de stations.

### Modified Capabilities

- `lorawan-ingestion-bridge`: `ensure_station()` escribe `owner_id` vacío al crear `station_meta`; el tag queda disponible para ser poblado por el wizard post-provisión.
- `operator-flash-app`: nuevo paso "Seleccionar cliente" como pantalla previa al wizard; paso final de asociación tras completar la provisión.

## Impact

- `backend/app/db/` — nuevo módulo `users.py` (SQLite sync, `sqlite3` stdlib)
- `backend/app/api/auth_routes.py` — re-introducido (simplificado, sin SQLAlchemy)
- `backend/app/api/routes.py` — filtro `owner_id` en `GET /api/stations`, nuevo `PUT /api/stations/{id}/owner`
- `backend/app/services/stations.py` — `ensure_station` agrega tag `owner_id=""`, nueva función `set_station_owner`
- `backend/app/config.py` — nueva var `jwt_secret`, `users_db_path`
- `backend/app/main.py` — incluye `auth_router`
- `backend/app/schemas.py` — `UserResponse`, `RegisterRequest`, `LoginRequest`, `TokenResponse`
- `infra/docker-compose.yml` — volumen para `users.db`
- `operator-app/src/` — pantalla de selección de cliente, llamada post-provisión a `PUT /api/stations/{id}/owner`
- `frontend/src/` — ajustes menores si auth backend devuelve formato ligeramente distinto
