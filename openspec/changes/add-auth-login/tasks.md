## 1. Dependencias y configuración backend

- [x] 1.1 Agregar `PyJWT>=2.8` y `passlib[bcrypt]>=1.7` a `pyproject.toml` e instalar (`uv sync` o `pip install`)
  - `feat(backend): agregar dependencias PyJWT y passlib para autenticación`
- [x] 1.2 Agregar campos `jwt_secret`, `jwt_algorithm` y `jwt_expire_minutes` a `app/config.py` (Settings/pydantic-settings, con defaults razonables)
  - `feat(backend): agregar configuración JWT en Settings`

## 2. Modelo y migración

- [x] 2.1 Agregar modelo `User` a `app/db/models.py` (campos: `id` UUID pk, `username` unique, `hashed_password`, `created_at`)
  - `feat(backend): agregar modelo User`
- [x] 2.2 Crear migración Alembic `202507031200_add_users_table.py` con `upgrade` (crea tabla `users` + índice en `username`) y `downgrade`
  - `feat(backend): migración Alembic para tabla users`

## 3. Utilidades de autenticación backend

- [x] 3.1 Crear `app/auth.py` con funciones `hash_password(plain)`, `verify_password(plain, hashed)`, `create_access_token(data)` y dependencia `get_current_user(token, session)` para FastAPI
  - `feat(backend): utilidades JWT y bcrypt en app/auth.py`

## 4. Endpoints de autenticación

- [x] 4.1 Crear `app/api/auth_routes.py` con `POST /auth/register`, `POST /auth/login` y `GET /auth/me`; incluir el router en `app/main.py` bajo prefijo `/auth`
  - `feat(backend): endpoints /auth/register, /auth/login y /auth/me`
- [x] 4.2 Agregar schemas Pydantic a `app/schemas.py`: `RegisterRequest`, `LoginRequest`, `TokenResponse`, `UserResponse`
  - `feat(backend): schemas Pydantic para auth`

## 5. Auth context en el frontend

- [x] 5.1 Crear `src/auth/AuthContext.tsx` con `AuthContext`, `AuthProvider` y hook `useAuth`; persistir token y username en `localStorage` bajo las claves `weatheros_token` / `weatheros_username`
  - `feat(frontend): AuthContext con persistencia en localStorage`

## 6. Pantalla de login/registro

- [x] 6.1 Crear `src/auth/LoginPage.tsx` con toggle entre modo "Iniciar sesión" (username + password) y modo "Crear cuenta" (solo username, con nota de password=username)
  - `feat(frontend): LoginPage con toggle login/registro`
- [x] 6.2 Agregar estilos para la pantalla de login en `src/styles.css` (centrado, fondo oscuro coherente con el resto de la app)
  - `feat(frontend): estilos para LoginPage`

## 7. Integración en la app

- [x] 7.1 Envolver `<App>` con `<AuthProvider>` en `src/main.tsx` y agregar guard: si no hay sesión mostrar `<LoginPage>`, si hay sesión mostrar el dashboard
  - `feat(frontend): guard de autenticación en main.tsx`
- [x] 7.2 Actualizar `src/api/client.ts` para leer el token de `localStorage` e incluir `Authorization: Bearer <token>` en todas las peticiones cuando esté presente
  - `feat(frontend): inyectar Authorization header en el API client`
