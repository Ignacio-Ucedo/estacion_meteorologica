## 1. Backend — Gestión de clientes (SQLite)

- [x] 1.1 Crear `backend/app/db/users.py`: módulo SQLite con `sqlite3` stdlib. Función `init_db(path)` crea tabla `users (id TEXT PK, username TEXT UNIQUE, password_hash TEXT, created_at TEXT)` con `PRAGMA journal_mode=WAL`. Funciones: `create_user(username, password) -> dict`, `get_user_by_username(username) -> dict|None`, `list_users() -> list[dict]`. Usar `bcrypt` para hash de passwords.
  Commit: `feat(backend): gestión de clientes con SQLite stdlib (sin ORM)`

- [x] 1.2 Actualizar `backend/app/config.py`: agregar `jwt_secret: str = "change-me-in-prod"`, `jwt_algorithm: str = "HS256"`, `users_db_path: str = "/data/users.db"`.
  Commit: `chore(backend): agregar config jwt_secret y users_db_path`

- [x] 1.3 Crear `backend/app/api/auth_routes.py`: router FastAPI con `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /users`. Usar `app/db/users.py` para persistencia, `PyJWT` para tokens. Registrar router en `app/main.py` como `include_router(auth_router)`.
  Commit: `feat(backend): auth routes (register/login/me) y GET /users sin auth`

- [x] 1.4 Actualizar `backend/pyproject.toml` y `backend/requirements.txt`: agregar `PyJWT>=2.8` y `bcrypt>=4.0` a las dependencias principales.
  Commit: `chore(backend): agregar PyJWT y bcrypt a dependencias`

## 2. Backend — Asociación station↔cliente en InfluxDB

- [x] 2.1 Actualizar `backend/app/services/stations.py`:
  - `ensure_station(dev_eui)`: agregar tag `owner_id=""` al punto `station_meta` al crear
  - Nueva función `set_station_owner(station_id, owner_id)`: escribe un nuevo punto en `station_meta` con `owner_id` actualizado manteniendo `name` y `location` actuales
  Commit: `feat(backend): agregar owner_id en station_meta y set_station_owner()`

- [x] 2.2 Actualizar `backend/app/api/routes.py`:
  - `GET /stations`: extraer `username` del JWT si presente (helper `_username_from_request`); si hay username válido, pasar a `list_stations(owner_filter=username)`; sin JWT devuelve todas
  - Nuevo endpoint `PUT /stations/{station_id}/owner`: body `{owner_id: str}`, llama `set_station_owner`, retorna `204`
  Commit: `feat(backend): filtro owner en GET /stations y PUT /stations/{id}/owner`

- [x] 2.3 Actualizar `backend/app/services/stations.py` → `list_stations(owner_filter=None)`: si `owner_filter` es string no vacío, añadir `and r.owner_id == "{owner_filter}"` al filtro Flux de `station_meta`.
  Commit: `feat(backend): filtro owner_id en list_stations() con Flux`

- [x] 2.4 Actualizar `backend/app/schemas.py`: agregar `UserResponse(id, username, created_at)`, `RegisterRequest(username, password)`, `LoginRequest(username, password)`, `TokenResponse(access_token, token_type)`.
  Commit: `feat(backend): schemas de autenticación de clientes`

## 3. Infraestructura

- [x] 3.1 Actualizar `infra/docker-compose.yml`: agregar volumen `users-data:/data` al servicio `backend`, variable de entorno `USERS_DB_PATH=/data/users.db`, `JWT_SECRET=${JWT_SECRET:-change-me-in-prod}`. Declarar volumen `users-data` en la sección `volumes:`.
  Commit: `chore(infra): volumen persistente para users.db y JWT_SECRET en backend`

- [x] 3.2 Actualizar `backend/Dockerfile`: el directorio `/data` ya existirá via volumen Docker en runtime; no requiere cambios en el Dockerfile. Verificar que el startup de `init_db()` ocurra en `@app.on_event("startup")` de `main.py`.
  Commit: `chore(backend): inicializar SQLite en startup de FastAPI`

## 4. Operator-App — Selección de cliente

- [x] 4.1 Crear nuevo comando Tauri `fetch_customers(backend_url: String) -> Result<Vec<Customer>, String>` en `operator-app/src-tauri/src/commands/chirpstack.rs` (o nuevo archivo `customer.rs`). Llama a `GET {backend_url}/api/users` sin auth, retorna lista de `{id, username}`.
  Commit: `feat(operator-app): comando Tauri fetch_customers desde backend`

- [x] 4.2 Crear componente React `CustomerSelect.tsx` en `operator-app/src/components/`. Llama a `fetch_customers` al montar, muestra dropdown de clientes, botón "Continuar" habilitado solo si hay selección. Muestra spinner de carga y error inline con "Reintentar". Props: `onSelect: (customerId: string) => void`.
  Commit: `feat(operator-app): pantalla CustomerSelect previa al wizard`

- [x] 4.3 Actualizar `FlashWizard.tsx` o la pantalla principal de `App.tsx` del operator-app: mostrar `CustomerSelect` antes del wizard; pasar `selectedCustomerId` como prop al `FlashWizard`. Agregar `selectedCustomerId: string` a los props de `FlashWizard`.
  Commit: `feat(operator-app): integrar CustomerSelect como paso previo al wizard`

## 5. Operator-App — Asociación post-provisión

- [x] 5.1 Crear comando Tauri `associate_station_to_customer(backend_url: String, station_id: String, owner_id: String) -> Result<(), String>` en `operator-app/src-tauri/`. Llama a `PUT {backend_url}/api/stations/{station_id}/owner` con body `{owner_id}`.
  Commit: `feat(operator-app): comando Tauri associate_station_to_customer`

- [x] 5.2 En `WizardStep5_ChirpStack.tsx` (nodos) y `WizardStep5_Register.tsx` (gateways): al completar exitosamente el último paso, llamar a `associate_station_to_customer` con `station_id = "dev-" + state.devEui.slice(0, 8)` y el `selectedCustomerId` del prop. Mostrar resultado como badge de confirmación (verde) o warning inline (amarillo) sin bloquear el flujo.
  Commit: `feat(operator-app): asociar station a cliente al completar wizard`

## 6. Frontend — Auth funcional

- [x] 6.1 Verificar que `frontend/src/auth/AuthContext.tsx` y `frontend/src/api/client.ts` son compatibles con el nuevo backend de auth (endpoints `/api/auth/login`, `/api/auth/me`, `/api/auth/register`). Ajustar URLs si difieren.
  Commit: `fix(frontend): alinear auth client con nuevos endpoints de backend`

- [x] 6.2 Verificar que `GET /api/stations` con JWT retorna solo las stations del usuario autenticado en el frontend. Probar el flujo completo: login → ver stations propias → no ver stations de otros usuarios.
  Commit: `test(frontend): verificar filtro de stations por propietario autenticado`
