## ADDED Requirements

### Requirement: Modelo de usuario en base de datos
El backend SHALL mantener una tabla `users` en Postgres con columnas: `id` (UUID, PK), `username` (VARCHAR 80, único, indexado), `hashed_password` (VARCHAR 128), `created_at` (timestamptz).  
Las contraseñas SHALL almacenarse siempre hasheadas con bcrypt; nunca en texto plano.

#### Scenario: Creación de usuario nuevo
- **WHEN** se persiste un usuario con username `"nacho"` y contraseña `"nacho"`
- **THEN** la columna `hashed_password` contiene un hash bcrypt (comienza con `$2b$`) y nunca el texto `"nacho"`

#### Scenario: Username único
- **WHEN** se intenta crear un segundo usuario con el mismo username
- **THEN** la base de datos rechaza la inserción con violación de constraint `UNIQUE`

### Requirement: Endpoint de registro abierto
`POST /auth/register` SHALL aceptar `{ username: str, password?: str }`.  
Si `password` no se provee, SHALL usarse `username` como valor de contraseña por defecto.  
El endpoint SHALL estar disponible sin autenticación previa.  
En caso de éxito SHALL retornar `201 Created` con `{ id, username, created_at }`.  
Si el username ya existe SHALL retornar `409 Conflict`.

#### Scenario: Registro exitoso con contraseña explícita
- **WHEN** se envía `POST /auth/register` con `{ "username": "ana", "password": "secreto" }`
- **THEN** se retorna `201` con `{ "id": "<uuid>", "username": "ana", "created_at": "<iso>" }`

#### Scenario: Registro con contraseña por defecto
- **WHEN** se envía `POST /auth/register` con `{ "username": "nacho" }` (sin campo `password`)
- **THEN** se crea el usuario con contraseña `"nacho"` y se retorna `201`

#### Scenario: Username duplicado
- **WHEN** se intenta registrar un username que ya existe
- **THEN** el endpoint retorna `409 Conflict` con detalle `"Username already taken"`

### Requirement: Endpoint de login con JWT
`POST /auth/login` SHALL aceptar `{ username: str, password: str }`.  
En caso de credenciales válidas SHALL retornar `200 OK` con `{ access_token: str, token_type: "bearer" }`.  
El token SHALL ser un JWT firmado con HS256, incluyendo `sub` (username), `user_id` y `exp` (7 días desde emisión por defecto, configurable por `JWT_EXPIRE_MINUTES`).  
Si las credenciales son inválidas SHALL retornar `401 Unauthorized` con detalle genérico (sin revelar si el username existe o no).

#### Scenario: Login exitoso
- **WHEN** se envía `POST /auth/login` con credenciales correctas
- **THEN** se retorna `200` con `{ "access_token": "<jwt>", "token_type": "bearer" }`

#### Scenario: Contraseña incorrecta
- **WHEN** se envía `POST /auth/login` con username válido y contraseña incorrecta
- **THEN** se retorna `401 Unauthorized` con `{ "detail": "Credenciales inválidas" }`

#### Scenario: Username inexistente
- **WHEN** se envía `POST /auth/login` con un username que no existe
- **THEN** se retorna `401 Unauthorized` con `{ "detail": "Credenciales inválidas" }` (mismo mensaje que contraseña incorrecta)

### Requirement: Endpoint de perfil propio
`GET /auth/me` SHALL retornar `{ id, username, created_at }` del usuario autenticado.  
El endpoint SHALL requerir un token Bearer válido en el header `Authorization`.  
Si el token es inválido o ausente SHALL retornar `401 Unauthorized`.

#### Scenario: Token válido
- **WHEN** se envía `GET /auth/me` con header `Authorization: Bearer <token_válido>`
- **THEN** se retorna `200 OK` con `{ "id": "<uuid>", "username": "<username>", "created_at": "<iso>" }`

#### Scenario: Token ausente
- **WHEN** se envía `GET /auth/me` sin header `Authorization`
- **THEN** se retorna `401 Unauthorized`

#### Scenario: Token expirado o malformado
- **WHEN** se envía `GET /auth/me` con un JWT con firma inválida o vencido
- **THEN** se retorna `401 Unauthorized`

### Requirement: Pantalla de login en el frontend
El frontend SHALL mostrar una `LoginPage` cuando no hay sesión activa.  
La `LoginPage` SHALL permitir alternar entre modo "Iniciar sesión" y modo "Crear cuenta" sin navegar a otra URL.  
En modo "Iniciar sesión" SHALL mostrar campos `username` y `password`.  
En modo "Crear cuenta" SHALL mostrar solo el campo `username` e indicar visualmente que la contraseña será igual al username.  
El acceso al dashboard SHALL estar bloqueado hasta que el usuario se autentique correctamente.

#### Scenario: Usuario no autenticado
- **WHEN** la app carga y no hay token en `localStorage`
- **THEN** se muestra la `LoginPage` en lugar del dashboard

#### Scenario: Login exitoso desde la UI
- **WHEN** el usuario ingresa credenciales correctas y confirma
- **THEN** el token se guarda en `localStorage`, se almacena el username en el contexto y el dashboard se muestra

#### Scenario: Registro exitoso desde la UI
- **WHEN** el usuario ingresa un username en modo "Crear cuenta" y confirma
- **THEN** se llama a `/auth/register` con `{ username }`, luego a `/auth/login` automáticamente, y el dashboard se muestra sin paso adicional

#### Scenario: Credenciales incorrectas en la UI
- **WHEN** el usuario envía credenciales inválidas
- **THEN** se muestra un mensaje de error inline en el formulario (no alert ni redirect)

### Requirement: Persistencia de sesión entre recargas
El `AuthContext` SHALL guardar el token JWT en `localStorage` bajo la clave `"weatheros_token"` y el username bajo `"weatheros_username"`.  
Al montar la app SHALL leer ambos valores y restaurar la sesión automáticamente sin requerir nuevo login.

#### Scenario: Recarga de página con sesión activa
- **WHEN** el usuario recarga el navegador con un token válido en `localStorage`
- **THEN** el dashboard se muestra directamente sin pasar por el login

#### Scenario: Logout
- **WHEN** el usuario cierra sesión (acción `logout` del contexto)
- **THEN** se eliminan `weatheros_token` y `weatheros_username` de `localStorage` y se muestra la `LoginPage`
