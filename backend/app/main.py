import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.config import get_settings
from app import mqtt as _mqtt

log = logging.getLogger("weather-backend")


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.chirpstack_app_id:
            _mqtt.start(asyncio.get_running_loop())
        else:
            log.warning("CHIRPSTACK_APP_ID not set — MQTT subscriber not started")
        yield
        _mqtt.stop()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "https://ignacio-ucedo.github.io"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
