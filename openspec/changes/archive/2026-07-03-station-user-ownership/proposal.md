## Why

El sistema de auth agregado en `add-auth-login` introduce usuarios, pero las estaciones son globales: cualquier usuario autenticado ve todas las estaciones de todos. Para que el dashboard sea útil como herramienta multi-usuario, cada estación debe pertenecer a un usuario y cada usuario debe ver solo sus propias estaciones. La operator-app es el punto natural de vinculación: al iniciar un gateway virtual (o en el futuro, flashear hardware real), el operador elige a qué usuario pertenece ese gateway.

## What Changes

- **Backend**: columna `user_id` (FK → `users.id`) en la tabla `stations`. Migración: agrega la columna y elimina todas las filas existentes sin owner (las estaciones huérfanas dejan de tener sentido).
- **Backend**: `GET /stations` filtra por el `user_id` extraído del JWT cuando hay token; sin token retorna todas (uso admin/interno).
- **Backend**: `POST /stations` acepta campo opcional `user_id`.
- **Backend**: nuevo endpoint `GET /users` que lista todos los usuarios sin requerir autenticación (endpoint local-admin para la operator-app).
- **Operator-app**: al montar el panel de gateway virtual, carga la lista de usuarios desde `GET /users` y muestra un dropdown de selección. El `user_id` seleccionado se incluye en el `POST /stations` al iniciar el gateway.
- **Web dashboard**: sin cambios de código — ya envía el JWT en cada petición; el filtrado lo hace el backend.
- **BREAKING** (datos): las estaciones existentes sin `user_id` son eliminadas por la migración.

## Capabilities

### New Capabilities

- `station-ownership`: modelo de propiedad de estaciones — `stations.user_id`, migración con limpieza de huérfanas, `GET /users` sin auth, `GET /stations` filtrado por JWT, selector de usuario en la operator-app.

### Modified Capabilities

- `backend-API`: `GET /stations` cambia de retornar todas las estaciones a retornar solo las del usuario autenticado (cuando hay JWT). `POST /stations` acepta `user_id`. Se agrega `GET /users`.
- `web-dashboard`: el dashboard pasa a mostrar exclusivamente las estaciones del usuario logueado; el concepto de "estación global" desaparece.

## Impact

- **Backend**: `app/db/models.py` (columna `user_id` en `Station`), `app/api/routes.py` (`GET /stations` + `GET /users`), `app/schemas.py` (schemas de user response), nueva migración Alembic.
- **Operator-app**: `VirtualGatewayPanel.tsx` (fetch a `GET /users`, dropdown, incluir `user_id` en la lógica de inicio).
- **Frontend web**: sin cambios de código.
- **Datos**: las estaciones existentes sin `user_id` son borradas por la migración — **no hay rollback de datos**.
