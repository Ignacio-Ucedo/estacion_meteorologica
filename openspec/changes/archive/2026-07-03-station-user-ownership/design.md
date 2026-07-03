## Context

El sistema de auth (`add-auth-login`) introdujo la tabla `users` y tokens JWT, pero las estaciones siguen siendo globales: `Station` no tiene owner y `GET /stations` retorna todo. Este change conecta ambos mundos añadiendo `user_id` a las estaciones y derivando la visibilidad desde el JWT.

La operator-app (Tauri) es hoy la única interfaz que puede crear estaciones con contexto de hardware real o virtual; se convierte en el punto de vinculación usuario↔gateway.

## Goals / Non-Goals

**Goals:**
- `stations.user_id` FK → `users.id`; migración borra filas sin owner.
- `GET /stations` filtra por user cuando hay JWT; sin JWT retorna todo (admin).
- `POST /stations` acepta `user_id` opcional.
- `GET /users` sin auth (lista todos los usuarios para la operator-app).
- Operator-app: dropdown de usuario cargado desde `GET /users` antes de iniciar el gateway; `user_id` incluido en `POST /stations` al arrancar.

**Non-Goals:**
- Roles de admin vs usuario normal.
- Proteger `GET /users` o `POST /stations` con auth.
- Transferencia de ownership entre usuarios.
- El frontend web no necesita cambios de código.

## Decisions

### `user_id` nullable en DB, NOT NULL en práctica
**Decisión**: la columna `user_id` es `VARCHAR(36) NULLABLE` con FK. La migración elimina filas existentes sin owner, por lo que en la práctica post-migración todas las filas tendrán `user_id`.  
**Razón**: nullable evita errores si la migración se corre parcialmente; la limpieza en la misma migración garantiza el estado esperado.

### Filtrado por JWT en `GET /stations`, sin token retorna todo
**Decisión**: si el header `Authorization` está presente y es válido, el endpoint filtra `WHERE user_id = <from_jwt>`. Si no hay token (o es inválido), retorna todas las estaciones.  
**Razón**: la operator-app y scripts de admin llaman al endpoint sin token; el frontend web siempre manda el JWT. No se necesita un endpoint separado.

### `POST /stations` sin auth requerida
**Decisión**: el endpoint existente no requiere auth. Se agrega `user_id` como campo opcional en el body.  
**Razón**: la operator-app es local y no tiene token. Agregar auth rompe el flujo existente de tests y scripts. El scope de este cambio no incluye securizar los endpoints REST.

### `GET /users` sin auth
**Decisión**: endpoint sin protección, retorna `[{id, username, created_at}]`.  
**Razón**: la operator-app es una herramienta local de admin. Exponer usernames sin contraseñas es aceptable en este contexto de PoC local.

### La operator-app hace `POST /stations` vía `fetch` desde el frontend Tauri
**Decisión**: el frontend de la operator-app (React/TS dentro de Tauri) llama directamente a la API REST del backend (`http://localhost:8000`) con `fetch`, igual que el frontend web. No se pasa `user_id` al comando Rust.  
**Razón**: los comandos Tauri (Rust) manejan el protocolo UDP/LoRaWAN, no la gestión de estaciones. La creación de la estación es responsabilidad del frontend. Mantiene la separación de capas.

## Risks / Trade-offs

- **Pérdida de datos irreversible**: la migración elimina todas las estaciones existentes. No hay rollback de datos, solo de esquema. → Documentado como BREAKING en la proposal.
- **`GET /users` expone usernames** sin auth → aceptable en PoC local; para producción real se protegería.
- **Sin token, `GET /stations` retorna todo** → si el frontend web alguna vez falla en enviar el JWT, el usuario verá estaciones ajenas. El AuthContext ya garantiza el token en cada petición; riesgo bajo.

## Migration Plan

1. Alembic: `DELETE FROM stations WHERE user_id IS NULL` → `ALTER TABLE stations ADD COLUMN user_id VARCHAR(36) REFERENCES users(id)` → en una sola revisión.
2. Restart backend (el CMD del Dockerfile corre `alembic upgrade head` automáticamente).
3. Operator-app: rebuild Tauri no requerido si solo cambia el frontend TS (Vite dev server suficiente).

**Rollback**: `alembic downgrade -1` revierte la columna. Los datos borrados no se recuperan.
