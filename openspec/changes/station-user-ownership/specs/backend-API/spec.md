## ADDED Requirements

### Requirement: Endpoint GET /users
`GET /users` SHALL retornar la lista de todos los usuarios registrados sin requerir autenticación. La respuesta SHALL ser un array de objetos `{id, username, created_at}`.

#### Scenario: Listado de usuarios disponible
- **WHEN** se llama a `GET /users` sin autenticación
- **THEN** se retorna `200 OK` con array `[{id, username, created_at}]`

## MODIFIED Requirements

### Requirement: GET /api/stations — filtrado por usuario autenticado
Obtiene estaciones registradas con soporte de paginación y búsqueda por nombre. Devuelve un objeto `StationPage`. Cuando el request incluye un header `Authorization: Bearer <token>` válido, SHALL retornar únicamente las estaciones cuyo `user_id` coincide con el usuario del token. Sin token válido, retorna todas las estaciones (uso admin/interno).

#### Scenario: Listado sin parámetros devuelve primera página
- **WHEN** se realiza `GET /api/stations` sin parámetros
- **THEN** la respuesta contiene `page: 1`, `total` igual al total de estaciones en la base, y `data` con hasta 6 estaciones ordenadas alfabéticamente por nombre

#### Scenario: Listado filtrado por usuario autenticado
- **WHEN** se realiza `GET /api/stations` con header `Authorization: Bearer <token_de_nacho>`
- **THEN** la respuesta contiene únicamente las estaciones cuyo `user_id` coincide con el usuario `nacho`; estaciones de otros usuarios no aparecen

#### Scenario: Sin token retorna todas las estaciones
- **WHEN** se realiza `GET /api/stations` sin header `Authorization`
- **THEN** la respuesta contiene todas las estaciones de todos los usuarios

#### Scenario: Token inválido se trata como sin token
- **WHEN** se realiza `GET /api/stations` con un JWT malformado o expirado
- **THEN** el endpoint no falla con 401; retorna todas las estaciones igual que si no hubiera token

### Requirement: POST /api/stations — acepta user_id
`POST /api/stations` SHALL aceptar un campo opcional `user_id` en el body. Si se provee, la estación queda asociada a ese usuario. Si no se provee, `user_id` queda en `NULL`.

#### Scenario: Creación de estación con user_id
- **WHEN** se envía `POST /api/stations` con `{name, location, status, user_id: "<uuid>"}`
- **THEN** se crea la estación con `user_id` asignado y se retorna `201 Created`

#### Scenario: Creación de estación sin user_id
- **WHEN** se envía `POST /api/stations` sin campo `user_id`
- **THEN** se crea la estación con `user_id = NULL` y se retorna `201 Created`
