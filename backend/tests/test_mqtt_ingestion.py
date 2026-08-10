"""Validación de ingesta MQTT: payload parsing, rechazo CRC y configuración MQTT."""
import base64
import json
import struct
from unittest.mock import MagicMock, patch

import pytest

import payload as payload_mod


def _crc8_maxim(data: bytes) -> int:
    """CRC-8/MAXIM: poly=0x31, init=0x00, refin=True, refout=True."""
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ 0x31 if crc & 0x01 else crc >> 1
    return crc & 0xFF


def _build_raw_payload(*, corrupt_crc: bool = False) -> bytes:
    body = struct.pack("<BHhHHHH", 1, 42, 2000, 6000, 3, 5, 3700)
    crc = _crc8_maxim(body)
    if corrupt_crc:
        crc = (crc + 1) & 0xFF
    return body + bytes([crc])


def _mqtt_message(raw: bytes) -> MagicMock:
    event = {
        "deviceInfo": {"devEui": "aabbccddee112233"},
        "data": base64.b64encode(raw).decode(),
        "time": "2026-08-08T12:00:00Z",
    }
    msg = MagicMock()
    msg.payload = json.dumps(event).encode()
    return msg


# ── payload unit tests ────────────────────────────────────────────────────────


def test_valid_payload_parsed_correctly():
    reading = payload_mod.parse_and_validate(_build_raw_payload())
    assert reading.device_id == 1
    assert reading.seq == 42
    assert reading.temp_c == 20.0
    assert reading.humidity_pct == 60.0
    assert reading.battery_mv == 3700


def test_corrupted_crc_raises_payload_error():
    with pytest.raises(payload_mod.PayloadError, match="crc_invalid"):
        payload_mod.parse_and_validate(_build_raw_payload(corrupt_crc=True))


def test_wrong_length_raises_payload_error():
    with pytest.raises(payload_mod.PayloadError, match="payload_len_invalid"):
        payload_mod.parse_and_validate(b"\x00" * 10)


# ── on_message: rechazo de CRC inválido sin escritura en InfluxDB ─────────────


def test_invalid_crc_does_not_write_to_influxdb():
    from app.main import on_message  # noqa: PLC0415

    msg = _mqtt_message(_build_raw_payload(corrupt_crc=True))
    mock_write_api = MagicMock()
    with patch("app.main.get_write_api", return_value=mock_write_api):
        on_message(None, None, msg)
    mock_write_api.write.assert_not_called()


def test_valid_payload_writes_to_influxdb():
    from app.main import on_message  # noqa: PLC0415

    msg = _mqtt_message(_build_raw_payload())
    mock_write_api = MagicMock()
    with (
        patch("app.main.get_write_api", return_value=mock_write_api),
        patch("app.services.stations.ensure_station"),
    ):
        on_message(None, None, msg)
    mock_write_api.write.assert_called_once()


def test_missing_data_field_does_not_write():
    from app.main import on_message  # noqa: PLC0415

    event = {"deviceInfo": {"devEui": "aabbccddee112233"}}
    msg = MagicMock()
    msg.payload = json.dumps(event).encode()
    mock_write_api = MagicMock()
    with patch("app.main.get_write_api", return_value=mock_write_api):
        on_message(None, None, msg)
    mock_write_api.write.assert_not_called()


# ── _build_mqtt_client: configuración de reconexión ──────────────────────────


def test_mqtt_client_configured_with_reconnect_delay():
    import paho.mqtt.client as paho_client  # noqa: PLC0415
    from app.main import _build_mqtt_client  # noqa: PLC0415

    mock_instance = MagicMock()
    mock_instance.connect = MagicMock()
    with patch.object(paho_client, "Client", return_value=mock_instance):
        _build_mqtt_client()
    mock_instance.reconnect_delay_set.assert_called_once_with(min_delay=1, max_delay=30)


# ── on_connect: suscripción condicional ───────────────────────────────────────


def test_mqtt_client_subscribes_on_connect():
    from app.main import on_connect  # noqa: PLC0415

    mock_client = MagicMock()
    on_connect(mock_client, None, None, 0, None)
    mock_client.subscribe.assert_called_once()


def test_mqtt_client_does_not_subscribe_on_connect_failure():
    from app.main import on_connect  # noqa: PLC0415

    mock_client = MagicMock()
    on_connect(mock_client, None, None, 5, None)
    mock_client.subscribe.assert_not_called()
