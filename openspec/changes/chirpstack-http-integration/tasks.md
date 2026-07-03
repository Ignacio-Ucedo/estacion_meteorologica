## 1. Limpiar dependencias y configuración

- [x] 1.1 Eliminar `paho-mqtt` de `pyproject.toml`
  - `chore(backend): eliminar dependencia paho-mqtt`
- [x] 1.2 Eliminar `chirpstack_mqtt_broker` y `chirpstack_app_id` de `app/config.py` (Settings)
  - `chore(backend): eliminar variables de entorno MQTT de Settings`

## 2. Endpoint de webhook

- [x] 2.1 Crear `app/api/integration_routes.py` con `POST /integrations/chirpstack/uplink`: parsea el JSON de ChirpStack (base64 decode de `data`, `devEui` de `deviceInfo`, `time`), llama a `parse_and_validate`, `map_reading` y `persist_uplink`; retorna `200 OK` o `422` según corresponda
  - `feat(backend): endpoint POST /integrations/chirpstack/uplink`

## 3. Actualizar main.py

- [x] 3.1 Eliminar el lifespan con startup/shutdown MQTT de `app/main.py` e incluir el nuevo `integration_router` sin prefijo `/api`
  - `refactor(backend): reemplazar lifespan MQTT por router de integración HTTP`

## 4. Eliminar mqtt.py

- [x] 4.1 Eliminar `app/mqtt.py`
  - `chore(backend): eliminar app/mqtt.py`

## 5. Documentación y deploy

- [x] 5.1 Actualizar tabla de variables de entorno en `backend/README.md`: eliminar `CHIRPSTACK_MQTT_BROKER` y `CHIRPSTACK_APP_ID`, agregar nota sobre configurar la integración HTTP en ChirpStack
  - `docs(backend): actualizar README con integración HTTP de ChirpStack`
- [x] 5.2 Rebuild del backend Docker y verificar que arranca sin warnings MQTT (`docker compose build backend && docker compose up -d backend`)
  - `chore(backend): rebuild sin paho-mqtt`
- [x] 5.3 Smoke test: enviar un POST manual a `http://localhost:8000/integrations/chirpstack/uplink` con payload de ejemplo y verificar que se persiste un Reading en la DB
  - `test(backend): smoke test webhook integración ChirpStack`
