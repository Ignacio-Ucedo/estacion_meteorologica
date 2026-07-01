## 1. Configuración del backend

- [x] 1.1 Agregar `CHIRPSTACK_MQTT_BROKER` (default `localhost:1883`), `CHIRPSTACK_APP_ID`, `SENSOR_K_WIND` (default `0.5`) y `SENSOR_K_RAIN` (default `0.2794`) a `backend/app/config.py` usando `pydantic_settings`. Commit sugerido: `feat(backend): agregar variables de entorno MQTT y calibración de sensores`.
- [x] 1.2 Agregar `paho-mqtt==2.0.0` a `backend/requirements.txt` si no figura ya (ya está; verificar y confirmar sin duplicar). Commit sugerido: `chore(backend): verificar dependencias MQTT en requirements.txt`.

## 2. Módulo de ingesta

- [x] 2.1 Crear `backend/app/services/ingestion.py` con la función `map_reading(raw_reading: WeatherReading, dev_eui: str, timestamp: datetime, settings: Settings) -> dict` que aplica el field mapping (temp_c→temperature, humidity_pct→humidity, wind_pulses×K_WIND→wind_speed, rain_pulses×K_RAIN→precipitation, wind_direction="N/A"). Commit sugerido: `feat(backend): agregar módulo de ingesta con field mapping LoRaWAN→PostgreSQL`.
- [x] 2.2 Agregar función `ensure_station(session: Session, dev_eui: str) -> Station` en `ingestion.py`: crea la Station con id `dev-{dev_eui[:8]}`, name `Auto {dev_eui[:8]}`, location `Unknown`, status `online` si no existe (idempotente). Commit incluido en 2.1.
- [x] 2.3 Agregar función `persist_reading(session: Session, station_id: str, reading_fields: dict, timestamp: datetime) -> Reading` en `ingestion.py`: crea y persiste el `Reading` en PostgreSQL. Commit incluido en 2.1.

## 3. Subscriber MQTT en el backend principal

- [x] 3.1 Crear `backend/app/mqtt.py` con las funciones `on_connect`, `on_disconnect` y `on_message`. El callback `on_message` debe: parsear JSON, decodificar base64, llamar a `payload.parse_and_validate()`, crear una `Session` síncrona, llamar a `ensure_station` y `persist_reading`. Errores de CRC, base64 o DB deben loguearse y descartarse sin detener el subscriber. Commit sugerido: `feat(backend): agregar subscriber MQTT con persistencia en PostgreSQL`.
- [x] 3.2 Modificar `backend/app/main.py`: agregar handlers `@app.on_event("startup")` y `@app.on_event("shutdown")` que inicien y detengan el thread daemon del subscriber MQTT (solo si `CHIRPSTACK_APP_ID` está configurado). Commit sugerido: `feat(backend): integrar subscriber MQTT en el startup de FastAPI`.

## 4. Infraestructura

- [x] 4.1 Crear `backend/Dockerfile` (si no existe): imagen Python 3.13-slim, instala `requirements.txt`, expone puerto 8000, entrypoint `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Commit sugerido: `chore(backend): agregar Dockerfile para docker-compose`.
- [x] 4.2 Agregar servicio `backend` a `infra/docker-compose.yml`: `build: ../backend`, `depends_on: [mosquitto, postgres]`, variables de entorno `DATABASE_URL`, `CHIRPSTACK_MQTT_BROKER=mosquitto:1883`, `CHIRPSTACK_APP_ID`, `SENSOR_K_WIND`, `SENSOR_K_RAIN`, puerto `8000:8000`. Commit sugerido: `chore(infra): agregar servicio backend al docker-compose`.
- [x] 4.3 Agregar servicio `gateway-mock` a `infra/docker-compose.yml` bajo el perfil `mock`: `build: ../firmware/gateway-mock`, variables de entorno `GATEWAY_MOCK_MQTT_BROKER=mosquitto:1883`, `GATEWAY_MOCK_APP_ID`, `GATEWAY_MOCK_DEV_EUI`, `GATEWAY_MOCK_INTERVAL_SECONDS=10`. Commit sugerido: `chore(infra): agregar servicio gateway-mock con perfil mock al docker-compose`.

## 5. Documentación

- [x] 5.1 Actualizar `backend/README.md` con la tabla completa de variables de entorno: `DATABASE_URL`, `CHIRPSTACK_MQTT_BROKER`, `CHIRPSTACK_APP_ID`, `SENSOR_K_WIND`, `SENSOR_K_RAIN`; valores de ejemplo del docker-compose; instrucciones para correr el stack completo y con perfil mock. Commit sugerido: `docs(backend): documentar variables de entorno y arranque del stack completo`.

## 6. Validación

- [x] 6.1 Verificar loop end-to-end: `docker compose up -d && docker compose --profile mock up gateway-mock -d`, esperar 30 s, consultar `GET /api/stations` y confirmar que aparece la estación auto-creada con lectura reciente. No requiere hardware físico.
- [x] 6.2 Verificar descarte de CRC inválido: publicar manualmente un mensaje MQTT con payload adulterado al topic y confirmar que el log incluye `payload_invalid` sin crear un `Reading` en PostgreSQL.
- [x] 6.3 Verificar reconexión MQTT: `docker compose restart mosquitto`, esperar 60 s, confirmar en los logs del backend que la suscripción se restablece y los uplinks siguientes se persisten.
