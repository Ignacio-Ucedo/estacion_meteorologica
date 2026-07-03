## 1. Modelo y migración backend

- [x] 1.1 Agregar columna `user_id VARCHAR(36) NULLABLE` con FK a `users.id` en el modelo `Station` de `app/db/models.py`
  - `feat(backend): agregar user_id a modelo Station`
- [x] 1.2 Crear migración Alembic `202507031300_station_user_ownership.py`: primero elimina todas las filas de `stations` (DELETE FROM stations), luego agrega la columna `user_id` con FK a `users`; downgrade elimina la columna
  - `feat(backend): migración station user_ownership con limpieza de huérfanas`

## 2. Endpoints backend

- [x] 2.1 Agregar `GET /users` en `app/api/auth_routes.py` (sin auth, retorna lista de `UserResponse`)
  - `feat(backend): endpoint GET /users sin autenticación`
- [x] 2.2 Actualizar `GET /stations` en `app/api/routes.py`: si el request trae JWT válido, filtrar por `user_id`; si no hay token o es inválido, retornar todas. Usar `get_current_user` de forma opcional (sin lanzar 401)
  - `feat(backend): GET /stations filtra por usuario cuando hay JWT`
- [x] 2.3 Agregar campo `user_id: str | None` al schema `StationCreate` en `app/schemas.py` y propagarlo en el service `create_station`
  - `feat(backend): POST /stations acepta user_id opcional`

## 3. Operator-app — selector de usuario

- [x] 3.1 Agregar función `fetchUsers()` en la operator-app que llama a `GET /users` del backend (URL configurable, default `http://localhost:8000`)
  - `feat(operator-app): cliente HTTP para GET /users`
- [x] 3.2 Agregar dropdown de selección de usuario en `VirtualGatewayPanel.tsx`: se carga al montar, persiste el `user_id` seleccionado en `localStorage` bajo la clave `gateway_selected_user_id`, deshabilita "Iniciar" si no hay usuario seleccionado ni usuarios disponibles
  - `feat(operator-app): dropdown de selección de usuario en gateway virtual`
- [x] 3.3 Al presionar "Iniciar", llamar a `POST /stations` con `user_id` del usuario seleccionado (y `id` derivado del DevEUI, `name: "Gateway Virtual <username>"`, `location: "Virtual"`, `status: "online"`) antes de invocar el comando Tauri `start_gateway`
  - `feat(operator-app): vincular estación al usuario al iniciar gateway`

## 4. Rebuild y verificación

- [ ] 4.1 Rebuild del backend Docker (`docker compose build backend && docker compose up -d backend`) y verificar que la migración corre sin errores en los logs
  - `chore(backend): rebuild con migración station_user_ownership`
- [ ] 4.2 Smoke test: registrar un usuario, iniciar gateway virtual desde la operator-app seleccionando ese usuario, verificar que la estación aparece en el dashboard web de ese usuario y no en el de otro
  - `test(integration): verificar ownership end-to-end`
