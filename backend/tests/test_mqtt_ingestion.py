"""Validación de ingesta MQTT: rechazo CRC (task 3.2) y configuración de reconexión (task 3.3)."""
import base64
import importlib.util
import json
import struct
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import payload as payload_mod


# ── helpers ──────────────────────────────────────────────────────────────────


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


def _load_mqtt_app():
    """Carga backend/app.py evitando la colisión de nombres con el paquete app/."""
    p = Path(__file__).parent.parent / "app.py"
    spec = importlib.util.spec_from_file_location("_weather_mqtt_app", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


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


# ── task 3.2: on_message descarta CRC inválido sin escribir en InfluxDB ──────


class TestOnMessageCrcRejection:
    @pytest.fixture(autouse=True)
    def load_module(self):
        self.mod = _load_mqtt_app()

    def test_invalid_crc_does_not_write_to_influxdb(self):
        msg = _mqtt_message(_build_raw_payload(corrupt_crc=True))
        mock_write_api = MagicMock()
        with patch.object(self.mod, "get_write_api", return_value=mock_write_api):
            self.mod.on_message(None, None, msg)
        mock_write_api.write.assert_not_called()

    def test_valid_payload_writes_to_influxdb(self):
        msg = _mqtt_message(_build_raw_payload())
        mock_write_api = MagicMock()
        with patch.object(self.mod, "get_write_api", return_value=mock_write_api):
            self.mod.on_message(None, None, msg)
        mock_write_api.write.assert_called_once()

    def test_missing_data_field_does_not_write_to_influxdb(self):
        event = {"deviceInfo": {"devEui": "aabbccddee112233"}}
        msg = MagicMock()
        msg.payload = json.dumps(event).encode()
        mock_write_api = MagicMock()
        with patch.object(self.mod, "get_write_api", return_value=mock_write_api):
            self.mod.on_message(None, None, msg)
        mock_write_api.write.assert_not_called()


# ── task 3.3: cliente MQTT configurado con reconexión automática ──────────────


def test_mqtt_client_configured_with_reconnect_delay():
    """_build_mqtt_client llama reconnect_delay_set(min_delay=1, max_delay=30)."""
    import paho.mqtt.client as paho_client

    mod = _load_mqtt_app()
    mock_instance = MagicMock()
    with patch.object(paho_client, "Client", return_value=mock_instance):
        mod._build_mqtt_client()
    mock_instance.reconnect_delay_set.assert_called_once_with(min_delay=1, max_delay=30)


def test_mqtt_client_subscribes_on_connect():
    """on_connect suscribe al topic configurado cuando reason_code == 0."""
    mod = _load_mqtt_app()
    mock_client = MagicMock()
    mod.on_connect(mock_client, None, None, 0, None)
    mock_client.subscribe.assert_called_once_with(mod.MQTT_TOPIC)


def test_mqtt_client_does_not_subscribe_on_connect_failure():
    """on_connect no suscribe cuando reason_code != 0 (broker rechazó la conexión)."""
    mod = _load_mqtt_app()
    mock_client = MagicMock()
    mod.on_connect(mock_client, None, None, 5, None)
    mock_client.subscribe.assert_not_called()
