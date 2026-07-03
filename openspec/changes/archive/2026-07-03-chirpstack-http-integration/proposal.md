## Why

El backend actual usa paho-mqtt para suscribirse al broker Mosquitto de ChirpStack. Esto requiere que la máquina del operador exponga TCP 1883 públicamente además de UDP 1700, y mantiene una conexión permanente con estado desde Render hacia un broker en la red del operador — frágil ante reconexiones y difícil de debuggear. ChirpStack soporta nativamente una integración HTTP: cuando llega un uplink, hace POST saliente a una URL configurable. Esto elimina el puerto MQTT expuesto y simplifica el backend.

## What Changes

- **Eliminar** `app/mqtt.py` y toda la lógica de subscriber paho-mqtt.
- **Eliminar** `paho-mqtt` de `pyproject.toml`.
- **Eliminar** variables de entorno `CHIRPSTACK_MQTT_BROKER` y `CHIRPSTACK_APP_ID` de `Settings` (ya no se usan).
- **Agregar** endpoint `POST /integrations/chirpstack/uplink` que recibe el webhook JSON de ChirpStack y llama al servicio de ingesta existente (`ingestion.py`).
- **Actualizar** `app/main.py`: eliminar el lifespan con startup/shutdown MQTT; incluir el nuevo router de integración.
- **Actualizar** `backend/README.md`: eliminar variables MQTT de la tabla de entorno.

## Capabilities

### New Capabilities

_(ninguna — la ingesta sigue existiendo, solo cambia el mecanismo de entrega)_

### Modified Capabilities

- `lorawan-ingestion-bridge`: el mecanismo de ingesta cambia de subscriber MQTT a webhook HTTP. La lógica de parseo de payload, field mapping y auto-provisión de Station no cambia.

## Impact

- **Backend**: eliminar `app/mqtt.py`, modificar `app/main.py`, agregar `app/api/integration_routes.py`, actualizar `app/config.py` y `pyproject.toml`.
- **Infraestructura**: en ChirpStack, configurar la integración HTTP apuntando a `https://<render-url>/integrations/chirpstack/uplink`. Solo queda expuesto UDP 1700 en el router del operador.
- **Sin breaking changes en la API REST** existente.
- **Sin cambios en firmware ni gateway**.
