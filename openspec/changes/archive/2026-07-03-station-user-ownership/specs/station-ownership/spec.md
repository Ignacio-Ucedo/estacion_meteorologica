## ADDED Requirements

### Requirement: Propiedad de estación por usuario
Cada estación SHALL tener un campo `user_id` que referencia al usuario propietario (`users.id`). Las estaciones sin propietario no SHALL existir en producción; la migración que introduce este campo SHALL eliminar las filas previas sin `user_id`.

#### Scenario: Estación con propietario
- **WHEN** se crea una estación con `user_id` válido
- **THEN** la estación queda asociada al usuario y aparece en su dashboard

#### Scenario: Migración limpia estaciones huérfanas
- **WHEN** se ejecuta `alembic upgrade head` con la migración de este change
- **THEN** todas las filas de `stations` sin `user_id` son eliminadas antes de agregar la columna `NOT NULL`

### Requirement: Listado de usuarios sin autenticación
`GET /users` SHALL retornar la lista completa de usuarios registrados (`[{id, username, created_at}]`) sin requerir token de autenticación. Este endpoint está destinado a herramientas de administración local.

#### Scenario: Lista de usuarios disponible
- **WHEN** se llama a `GET /users` sin header `Authorization`
- **THEN** se retorna `200 OK` con el array de usuarios (`id`, `username`, `created_at`)

#### Scenario: Lista vacía
- **WHEN** no hay usuarios registrados
- **THEN** se retorna `200 OK` con `[]`

### Requirement: Selector de usuario en el gateway virtual de la operator-app
La operator-app SHALL cargar la lista de usuarios desde `GET /users` al montar el panel de gateway virtual y mostrar un dropdown de selección de usuario antes de permitir iniciar el gateway. No SHALL ser posible iniciar el gateway sin seleccionar un usuario.

#### Scenario: Carga de usuarios al montar el panel
- **WHEN** el panel de gateway virtual se monta
- **THEN** se llama a `GET /users` y se puebla el dropdown con los usuarios disponibles

#### Scenario: Inicio del gateway con usuario seleccionado
- **WHEN** el operador selecciona un usuario y presiona "Iniciar"
- **THEN** la operator-app llama a `POST /stations` con `user_id` del usuario seleccionado (creando o actualizando la estación), y luego arranca el gateway virtual

#### Scenario: Sin usuarios registrados
- **WHEN** `GET /users` retorna una lista vacía
- **THEN** el dropdown muestra un mensaje indicando que no hay usuarios y el botón "Iniciar" permanece deshabilitado

#### Scenario: Error al cargar usuarios
- **WHEN** `GET /users` falla (backend no disponible)
- **THEN** se muestra un mensaje de error en el panel y el botón "Iniciar" permanece deshabilitado

### Requirement: Vinculación gateway-usuario persiste entre sesiones
El usuario seleccionado en la operator-app SHALL persistirse en `localStorage` para no tener que reseleccionarlo en cada apertura de la app.

#### Scenario: Reapertura de la operator-app
- **WHEN** el operador reabre la operator-app tras haber seleccionado un usuario previamente
- **THEN** el dropdown muestra el último usuario seleccionado como valor inicial
