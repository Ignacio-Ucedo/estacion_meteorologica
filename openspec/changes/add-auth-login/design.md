## Context

El frontend y el backend no tienen ningún mecanismo de autenticación. Cualquier visitante puede ver el dashboard y gestionar estaciones. Para soportar múltiples usuarios con sesiones independientes (y preparar la versión pública), se agrega un flujo de login/registro mínimo.

El sistema es deliberadamente "doomie" (PoC local): registro abierto sin verificación de email, contraseña por defecto igual al username, sin roles. La protección es solo de UI; los endpoints de la API REST no requieren token en esta iteración.

Stack existente: FastAPI + SQLAlchemy async + Postgres + Alembic (backend); React 19 + TypeScript + Vite, sin router de páginas (frontend).

## Goals / Non-Goals

**Goals:**
- Tabla `users` en Postgres con credenciales hasheadas (bcrypt).
- Endpoints `/auth/register`, `/auth/login`, `/auth/me` en el backend.
- Tokens JWT stateless (PyJWT); sin tabla de sesiones en DB.
- `AuthContext` en React que persiste el token en `localStorage` y expone `login`, `logout`, `register`.
- `LoginPage` que bloquea el acceso al dashboard si no hay sesión activa.
- Header `Authorization: Bearer <token>` en todas las llamadas al API client.
- Soporte de múltiples usuarios simultáneos.

**Non-Goals:**
- Protección de endpoints REST con middleware de auth (queda para iteración futura).
- Roles o permisos diferenciados.
- Verificación de email, recuperación de contraseña, OAuth.
- Gestión de usuarios desde el UI (crear/eliminar desde el panel de admin).
- Rate limiting en el endpoint de registro.
- Expiración/revocación de tokens (el token dura 7 días por config).

## Decisions

### JWT stateless (PyJWT) sobre sesiones en DB
**Decisión**: PyJWT + HS256. El token se firma con `JWT_SECRET` del env y expira en 7 días.  
**Alternativa descartada**: tabla `sessions` en Postgres (más compleja, no aporta en un PoC sin revocación de tokens).  
**Por qué PyJWT sobre python-jose**: `python-jose` está prácticamente sin mantenimiento activo; `PyJWT` es el estándar actual con soporte activo.

### passlib[bcrypt] para hashing
**Decisión**: `passlib[bcrypt]` para hashear contraseñas en reposo.  
**Alternativa descartada**: almacenar en texto plano o SHA-256 simple. Aunque sea un PoC, bcrypt no agrega complejidad significativa y evita malas costumbres.

### Token en localStorage
**Decisión**: el frontend guarda el token en `localStorage`.  
**Trade-off**: XSS puede leer el token. Alternativa más segura sería cookie `httpOnly`, pero requiere cambios de CORS/cookies y es innecesario para un uso local/controlado.  
**Aceptable para**: PoC local y versión pública de baja criticidad.

### Registro abierto con password = username por defecto
**Decisión**: `POST /auth/register { username, password? }`. Si `password` se omite, el backend lo setea igual al username.  
**Racional**: maximiza la facilidad de crear cuentas de prueba en local. Se puede documentar que en producción conviene setear contraseña explícita.

### Protección solo de UI, no de endpoints REST
**Decisión**: los endpoints existentes de `/api/stations/*` no requieren token en esta iteración.  
**Racional**: la app solo tiene un frontend propio; los endpoints no son públicamente conocidos. Agregar `Depends(get_current_user)` a cada ruta existente es trivial pero fuera del scope de este PoC.

## Risks / Trade-offs

- **JWT_SECRET hardcodeado por defecto** (`"changeme-in-production"`) → en producción DEBE setearse como variable de entorno `JWT_SECRET`. Se documenta en el README/config.
- **Registro abierto** → cualquiera puede crear usuarios en la instancia pública. Aceptable como PoC; para producción real se cerraría con un flag de env `REGISTRATION_OPEN=false`.
- **Token en localStorage** → vulnerable a XSS si se inyecta script malicioso. Riesgo bajo en un dashboard operacional con bajo tráfico.
- **Sin expiración real de sesión** → si se filtra un token, dura hasta su expiración (7 días). Aceptable para PoC.

## Migration Plan

1. Instalar nuevas dependencias: `pip install PyJWT passlib[bcrypt]` (o `uv sync` con `pyproject.toml` actualizado).
2. Ejecutar migración Alembic: `alembic upgrade head` (crea tabla `users`).
3. Arrancar el backend; el router `/auth` queda disponible.
4. En producción: setear `JWT_SECRET` en el env antes de desplegar.

**Rollback**: `alembic downgrade -1` elimina la tabla `users`. Los archivos nuevos del backend/frontend se revierten con git.

## Open Questions

- ¿Se quiere mostrar el username del usuario logueado en el `Topbar`? (no es bloqueante para esta iteración, se puede agregar después con `GET /auth/me`).
- ¿Plazo de expiración del token configurable desde el UI, o fijo en config? (quedó fijo: 7 días, configurable solo por env).
