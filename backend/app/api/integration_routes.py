import base64
import logging
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_session
from app.services.ingestion import map_reading, persist_uplink
from payload import PayloadError, parse_and_validate

log = logging.getLogger("weather-backend.integration")

router = APIRouter()
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("/integrations/chirpstack/uplink", status_code=status.HTTP_200_OK)
async def chirpstack_uplink(event: dict[str, Any], session: SessionDep) -> dict[str, str]:
    dev_eui: str = event.get("deviceInfo", {}).get("devEui", "unknown")

    data_b64: str = event.get("data", "")
    if not data_b64:
        # Eventos join/ack/status de ChirpStack no tienen payload — ignorar silenciosamente
        log.debug("uplink_no_data dev_eui=%s event_type=%s — skipped", dev_eui, event.get("type", "unknown"))
        return {"status": "ignored", "reason": "no_data"}

    try:
        raw = base64.b64decode(data_b64)
    except Exception as exc:
        log.error("base64_decode_error dev_eui=%s error=%s", dev_eui, exc)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="base64_decode_error") from exc

    try:
        reading = parse_and_validate(raw)
    except PayloadError as exc:
        log.error("payload_invalid dev_eui=%s error=%s raw_hex=%s", dev_eui, exc, raw.hex())
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"payload_invalid: {exc}") from exc

    ts_str: str | None = event.get("time")
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            ts = datetime.now(UTC)
    else:
        ts = datetime.now(UTC)

    settings = get_settings()
    fields = map_reading(reading, settings)
    await persist_uplink(session, dev_eui, fields, ts)

    return {"status": "ok"}
