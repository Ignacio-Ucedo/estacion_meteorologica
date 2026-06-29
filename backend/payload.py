"""Deserialización y validación del FRMPayload binario de 14 bytes.

Estructura (little-endian):
  Offset  Campo           Tipo    Descripción
  0       device_id       u8      ID del nodo (0–255)
  1–2     seq             u16 LE  Número de secuencia
  3–4     temp_c_x100     i16 LE  Temperatura °C × 100
  5–6     hum_x100        u16 LE  Humedad %RH × 100
  7–8     lluvia_pulsos   u16 LE  Pulsos de pluviómetro
  9–10    viento_pulsos   u16 LE  Pulsos de anemómetro
  11–12   bateria_mv      u16 LE  Tensión de batería en mV
  13      crc8            u8      CRC-8/MAXIM sobre bytes 0–12
"""

import struct
from dataclasses import dataclass

PAYLOAD_LEN = 14
_STRUCT = struct.Struct("<BHhHHHHB")  # device_id, seq, temp, hum, lluvia, viento, bateria, crc


def _crc8_maxim(data: bytes) -> int:
    """CRC-8/MAXIM: poly=0x31, init=0x00, refin=True, refout=True, xorout=0x00."""
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x01:
                crc = (crc >> 1) ^ 0x31
            else:
                crc >>= 1
    return crc & 0xFF


@dataclass
class WeatherReading:
    device_id: int
    seq: int
    temp_c: float
    humidity_pct: float
    rain_pulses: int
    wind_pulses: int
    battery_mv: int


class PayloadError(Exception):
    pass


def parse_and_validate(raw: bytes) -> WeatherReading:
    """Parsea el FRMPayload binario y valida el CRC-8/MAXIM.

    Raises:
        PayloadError: si el tamaño es incorrecto o el CRC no coincide.
    """
    if len(raw) != PAYLOAD_LEN:
        raise PayloadError(
            f"payload_len_invalid expected={PAYLOAD_LEN} got={len(raw)}"
        )

    expected_crc = _crc8_maxim(raw[:13])
    actual_crc = raw[13]
    if expected_crc != actual_crc:
        raise PayloadError(
            f"crc_invalid expected={expected_crc:#04x} got={actual_crc:#04x}"
        )

    device_id, seq, temp_x100, hum_x100, lluvia, viento, bateria, _ = _STRUCT.unpack(raw)

    return WeatherReading(
        device_id=device_id,
        seq=seq,
        temp_c=round(temp_x100 / 100.0, 2),
        humidity_pct=round(hum_x100 / 100.0, 2),
        rain_pulses=lluvia,
        wind_pulses=viento,
        battery_mv=bateria,
    )
