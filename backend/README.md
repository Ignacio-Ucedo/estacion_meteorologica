# WeatherOS Backend

FastAPI backend para la estación meteorológica. Recibe uplinks LoRaWAN via MQTT, los persiste en PostgreSQL y expone una REST API con historial y métricas.

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | *(requerido)* | URL async SQLAlchemy. Ej: `postgresql+asyncpg://weatheros:weatheros@localhost:5432/weatheros` |
| `APP_NAME` | `WeatherOS Backend` | Título en los docs FastAPI |
| `ENVIRONMENT` | `development` | Label de entorno |
| `CHIRPSTACK_MQTT_BROKER` | `localhost:1883` | host:port del broker Mosquitto |
| `CHIRPSTACK_APP_ID` | `""` | Application ID de ChirpStack. Si está vacío, el subscriber MQTT no inicia |
| `SENSOR_K_WIND` | `0.5` | m/s por pulso de anemómetro (**provisional** — calibrar con hardware real) |
| `SENSOR_K_RAIN` | `0.2794` | mm por pulso de pluviómetro (**provisional** — resolución típica de cuchara Davis) |

## Desarrollo local

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # ajustar DATABASE_URL y CHIRPSTACK_APP_ID
alembic upgrade head
uvicorn app.main:app --reload
pytest
```

La API se sirve bajo `/api`. FastAPI expone docs en `/docs` y `/openapi.json`.

## Correr con docker-compose

El stack completo (incluyendo el backend) levanta desde `infra/`:

```bash
cd infra
docker compose up -d
```

Para incluir el gateway-mock (datos sintéticos, sin hardware real):

```bash
docker compose --profile mock up -d
```

Variables de entorno de compose configurables via archivo `.env` en `infra/`:

```env
CHIRPSTACK_APP_ID=1
GATEWAY_MOCK_DEV_EUI=0000000000000002
GATEWAY_MOCK_INTERVAL_SECONDS=10
SENSOR_K_WIND=0.5
SENSOR_K_RAIN=0.2794
```

Verificar que el loop funciona:

```bash
# Esperar ~30 s para que el gateway-mock publique
curl http://localhost:8000/api/stations
# Debe aparecer la estación auto-creada "dev-00000000"
```

## Datos

- **Lecturas horarias**: los endpoints `/metrics/{metric}/hourly` devuelven 25 puntos (hora 0–24). Buckets sin datos retornan `null`; el backend no interpola.
- **Calibración**: las constantes `K_WIND` y `K_RAIN` son provisionales hasta validar con hardware real. Se pueden ajustar sin redeployear via variables de entorno.
- **PostgreSQL + TimescaleDB**: la migración inicial crea tablas regulares. Con TimescaleDB instalado, `readings` puede convertirse en hypertable con `timestamp` como dimensión temporal.

## Ingesta LoRaWAN

El backend se suscribe al topic MQTT `application/{APP_ID}/device/+/event/up` y procesa cada uplink:

1. Deserializa el JSON del evento ChirpStack
2. Decodifica el campo `data` (base64 → 14 bytes)
3. Valida CRC-8/MAXIM sobre los primeros 13 bytes
4. Aplica field mapping al modelo `Reading` en PostgreSQL
5. Auto-crea la `Station` si el `devEUI` es nuevo

Uplinks con CRC inválido se descartan con log de error. Errores de DB se loguean y el subscriber continúa.
