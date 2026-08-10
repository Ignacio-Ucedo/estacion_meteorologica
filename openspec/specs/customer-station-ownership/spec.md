# customer-station-ownership/spec.md

## Overview

Gestión de clientes (usuarios finales) y asociación de weather stations a su propietario.
El backend expone endpoints de autenticación JWT y un endpoint de asociación `owner_id`.
El filtro de stations por propietario es transparente: con JWT filtra, sin JWT devuelve todo.

Introducido en `associate-station-to-customer`.

---

## Requirements

### Requirement: CRUD de clientes via REST API

El backend SHALL exponer los siguientes endpoints de gestión de clientes:

- `POST /auth/register` — crea un nuevo cliente (username + password). Responde `201` con `{id, username, created_at}`. Retorna `409` si el username ya existe.
- `POST /auth/login` — autentica un cliente. Responde `200` con `{access_token, token_type: "bearer"}`. Retorna `401` si las credenciales son incorrectas.
- `GET /auth/me` — retorna el perfil del cliente autenticado. Requiere JWT válido en header `Authorization: Bearer <token>`.
- `GET /users` — lista todos los clientes (id + username). **No requiere autenticación** (uso exclusivo del operator-app en red local). Retorna array, nunca incluye password_hash.

Los passwords SHALL almacenarse hasheados con bcrypt. La tabla `users` SHALL crearse automáticamente en SQLite al iniciar el backend si no existe (idempotente, sin migraciones).

#### Scenario: Registro de nuevo cliente

- **WHEN** se hace `POST /auth/register` con `{username: "juan", password: "secret"}`
- **THEN** el backend crea el usuario, retorna `201` con `{id, username, created_at}` y el password NO aparece en la respuesta

#### Scenario: Login exitoso devuelve JWT

- **WHEN** se hace `POST /auth/login` con credenciales correctas
- **THEN** el backend retorna `{access_token: "<jwt>", token_type: "bearer"}` donde el JWT contiene `{user_id, username}` en el payload con expiración de 30 días

#### Scenario: Username duplicado

- **WHEN** se intenta registrar un username que ya existe
- **THEN** el backend retorna `409 Conflict`

#### Scenario: Listado de clientes sin auth

- **WHEN** el operator-app llama `GET /users` sin Authorization header
- **THEN** el backend retorna la lista de clientes con `id` y `username` (sin passwords)

---

### Requirement: Asignación de propietario via API

El backend SHALL exponer `PUT /api/stations/{station_id}/owner` que actualiza el `owner_id` de la station indicada. Body: `{owner_id: "<username>"}`. No requiere autenticación (uso exclusivo del operator-app en red local). Retorna `204 No Content` si exitoso, `404` si la station no existe.

La actualización SHALL escribir un nuevo punto en `station_meta` con el `owner_id` actualizado, preservando `name` y `location` actuales. La lectura de `last()` siempre retornará el estado más reciente.

#### Scenario: Wizard asocia station tras flasheo

- **WHEN** el operator-app llama `PUT /api/stations/dev-aabbccdd/owner` con `{owner_id: "juan"}`
- **THEN** el backend escribe un punto en `station_meta` con tag `owner_id="juan"` y retorna `204`

#### Scenario: Station no encontrada

- **WHEN** se llama `PUT /api/stations/dev-nonexist/owner`
- **THEN** el backend retorna `404 Not Found`

---

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

#### Scenario: Station sin propietario no aparece en frontend autenticado

- **GIVEN** una station con `owner_id=""` (recién creada por `ensure_station`)
- **WHEN** el frontend autenticado como "juan" llama `GET /api/stations`
- **THEN** la station con `owner_id=""` NO aparece en los resultados
