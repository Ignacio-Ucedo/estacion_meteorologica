## Why

La app del operador actualmente no tiene ningún control de acceso: cualquiera con la URL puede ver y gestionar las estaciones. Agregar un sistema de login liviano permite soportar múltiples usuarios con sesiones independientes y es el primer paso para exponer la versión pública con acceso controlado.

## What Changes

- **Backend**: nueva tabla `users` en Postgres con username y contraseña hasheada (bcrypt). Tres endpoints bajo `/auth`: registro, login y perfil propio. El registro es abierto y sin restricciones (PoC local): basta con un username; la contraseña por defecto es el mismo username.
- **Backend**: tokens JWT de sesión (PyJWT), sin estado del lado del servidor.
- **Frontend**: pantalla de login/registro que bloquea el acceso al dashboard si el usuario no está autenticado.
- **Frontend**: `AuthContext` que persiste el token en `localStorage` y lo inyecta en cada llamada a la API como header `Authorization: Bearer <token>`.
- **No hay roles ni permisos**: todos los usuarios autenticados tienen acceso completo (scope PoC).
- **No se protegen los endpoints de la API REST** en esta iteración: la protección es solo de UI. Queda anotado para una iteración futura.

## Capabilities

### New Capabilities

- `user-auth`: autenticación de usuarios con JWT. Cubre modelo `User`, endpoints `/auth/register`, `/auth/login`, `/auth/me`, utilidades de hash y token, migración Alembic, `AuthContext` React, `LoginPage` y guard de ruta en el frontend.

### Modified Capabilities

- `frontend-api-client`: el cliente HTTP pasa a incluir el header `Authorization` cuando hay un token activo.

## Impact

- **Backend**: nuevas dependencias `PyJWT>=2.8` y `passlib[bcrypt]>=1.7` en `pyproject.toml`. Nueva migración Alembic. Nuevo router `/auth` incluido en `app/main.py`.
- **Frontend**: nuevos archivos `src/auth/AuthContext.tsx` y `src/auth/LoginPage.tsx`. Modificaciones en `src/api/client.ts` y `src/main.tsx`.
- **Sin breaking changes**: las rutas existentes de la API no requieren token (sin cambios de contrato).
- **Deploy público**: la app pública necesitará que los usuarios se creen una cuenta antes de poder acceder. Se recomienda setear `JWT_SECRET` como variable de entorno antes de exponer en producción.
