# Spec: customer-station-ownership

## Gestión de clientes en el backend

### Requirement: CRUD de clientes via REST API

El backend SHALL exponer los siguientes endpoints de gestión de clientes:

- `POST /api/auth/register` — crea un nuevo cliente (username + password). Responde `201` con `{id, username, created_at}`. Retorna `409` si el username ya existe.
- `POST /api/auth/login` — autentica un cliente. Responde `200` con `{access_token, token_type: "bearer"}`. Retorna `401` si las credenciales son incorrectas.
- `GET /api/auth/me` — retorna el perfil del cliente autenticado. Requiere JWT válido.
- `GET /api/users` — lista todos los clientes (id + username). **No requiere autenticación** (uso exclusivo del operator-app en red local). Retorna array, nunca incluye password_hash.

Los passwords SHALL almacenarse hasheados con bcrypt. La tabla `users` SHALL crearse automáticamente en SQLite al iniciar el backend si no existe (idempotente, sin migraciones).

#### Scenario: Registro de nuevo cliente

- **WHEN** se hace `POST /api/auth/register` con `{username: "juan", password: "secret"}`
- **THEN** el backend crea el usuario, retorna `201` con `{id, username, created_at}` y el password NO aparece en la respuesta

#### Scenario: Login exitoso devuelve JWT

- **WHEN** se hace `POST /api/auth/login` con credenciales correctas
- **THEN** el backend retorna `{access_token: "<jwt>", token_type: "bearer"}` donde el JWT contiene `{user_id, username}` en el payload

#### Scenario: Username duplicado

- **WHEN** se intenta registrar un username que ya existe
- **THEN** el backend retorna `409 Conflict`

#### Scenario: Listado de clientes sin auth

- **WHEN** el operator-app llama `GET /api/users` sin Authorization header
- **THEN** el backend retorna la lista de clientes con `id` y `username` (sin passwords)

---

## Asociación station↔cliente

### Requirement: Asignación de propietario via API

El backend SHALL exponer `PUT /api/stations/{station_id}/owner` que actualiza el `owner_id` de la station indicada. Body: `{owner_id: "<username>"}`. No requiere autenticación (uso exclusivo del operator-app en red local). Retorna `204 No Content` si exitoso, `404` si la station no existe.

La actualización SHALL escribir un nuevo punto en `station_meta` con el `owner_id` actualizado. La lectura de `last()` siempre retornará el estado más reciente.

#### Scenario: Wizard asocia station tras flasheo

- **WHEN** el operator-app llama `PUT /api/stations/dev-aabbccdd/owner` con `{owner_id: "juan"}`
- **THEN** el backend escribe un punto en `station_meta` con tag `owner_id="juan"` y retorna `204`

#### Scenario: Station sin propietario no aparece en frontend autenticado

- **GIVEN** una station con `owner_id=""` (recién creada por `ensure_station`)
- **WHEN** el frontend autenticado como "juan" llama `GET /api/stations`
- **THEN** la station con `owner_id=""` NO aparece en los resultados

---

## Filtrado de stations por propietario

### Requirement: GET /api/stations filtra por owner cuando hay JWT

`GET /api/stations` SHALL comportarse de la siguiente forma según el request:

- **Con JWT válido**: retorna solo las stations donde `owner_id` coincide con el `username` del token
- **Sin JWT o JWT inválido**: retorna todas las stations (comportamiento para uso interno del operator-app y monitoreo)

#### Scenario: Cliente autenticado ve solo sus stations

- **GIVEN** dos stations: `dev-aabb` con `owner_id="juan"` y `dev-ccdd` con `owner_id="pedro"`
- **WHEN** "juan" llama `GET /api/stations` con su JWT
- **THEN** solo aparece `dev-aabb`

#### Scenario: Sin auth devuelve todas las stations

- **WHEN** se llama `GET /api/stations` sin Authorization header
- **THEN** aparecen todas las stations independientemente de su `owner_id`
