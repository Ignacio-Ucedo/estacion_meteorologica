## Context

El backend actual tiene `app/mqtt.py` con un subscriber paho-mqtt que corre en un thread separado, se conecta al broker Mosquitto de ChirpStack en `CHIRPSTACK_MQTT_BROKER`, y llama a `ingestion.py` por cada uplink. El lifespan de FastAPI arranca y para ese thread.

ChirpStack soporta integraciones HTTP nativas: desde el panel de ChirpStack, se configura una URL y ChirpStack hace `POST` saliente con el evento JSON cada vez que llega un uplink. El payload JSON es idéntico al que llega por MQTT (mismo schema de evento ChirpStack).

## Goals / Non-Goals

**Goals:**
- Reemplazar el subscriber MQTT por un endpoint HTTP que recibe el mismo evento.
- Reutilizar `ingestion.py` sin modificaciones.
- Eliminar paho-mqtt y la complejidad del thread/lifespan.
- El operador solo necesita exponer UDP 1700 en su router.

**Non-Goals:**
- Autenticación del webhook (ChirpStack no tiene mecanismo de secreto nativo en HTTP integration; el endpoint queda sin auth, igual que los endpoints de ingesta existentes).
- Soporte de otros eventos ChirpStack (join, ack, status) — solo `uplink`.
- Downlinks.

## Decisions

### El payload HTTP es el mismo JSON que el payload MQTT
**Decisión**: reutilizar la lógica de parseo de `mqtt.py` directamente en el route handler.  
**Razón**: ChirpStack publica el mismo objeto JSON tanto por MQTT como por HTTP integration. No hay transformación necesaria.

### Mover la lógica de parseo de `mqtt.py` a `app/api/integration_routes.py`
**Decisión**: en lugar de crear un módulo `app/ingestion_handler.py` separado, la lógica de parseo (base64 decode, parse_and_validate, map_reading, persist_uplink) va directamente en el handler async del endpoint.  
**Razón**: es código que solo se usa en un lugar. El endpoint es async nativo de FastAPI, elimina la complejidad del `run_coroutine_threadsafe` que tenía mqtt.py.

### Eliminar CHIRPSTACK_APP_ID y CHIRPSTACK_MQTT_BROKER de Settings
**Decisión**: estas variables ya no tienen uso en el backend tras el cambio.  
**Razón**: con HTTP integration, ChirpStack envía el uplink directamente; no hay topic MQTT que filtrar. El `app_id` viene en el payload JSON si se necesita en el futuro.

### Endpoint sin autenticación
**Decisión**: `POST /integrations/chirpstack/uplink` no requiere JWT ni secret.  
**Razón**: ChirpStack no tiene soporte nativo para agregar un header de secreto en HTTP integrations. El endpoint no expone datos sensibles (solo recibe escrituras). Para producción real se puede agregar IP allowlist a nivel de reverse proxy.

## Risks / Trade-offs

- **Endpoint público sin auth** → cualquiera que conozca la URL puede inyectar uplinks falsos. Riesgo bajo en PoC; mitigable con IP allowlist en Render si es necesario.
- **Sin retry automático si el endpoint está caído** → ChirpStack reintenta según su configuración de integración (configurable). MQTT tenía el buffer del broker. Aceptable para el caso de uso.

## Migration Plan

1. Agregar endpoint HTTP al backend y hacer deploy en Render.
2. En ChirpStack (panel local), configurar la integración HTTP apuntando a `https://<render-url>/integrations/chirpstack/uplink`.
3. Verificar que los uplinks llegan al nuevo endpoint (logs de Render).
4. Eliminar las variables `CHIRPSTACK_MQTT_BROKER` y `CHIRPSTACK_APP_ID` del entorno de Render.

**Rollback**: revertir el commit, redeploy en Render, eliminar la integración HTTP en ChirpStack.
