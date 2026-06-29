use core::fmt::Write;
use heapless::String;

pub const MAX_PAYLOAD_LEN: usize = 96;

#[derive(Debug, Clone, Copy)]
pub struct Measurement {
    pub seq: u32,
    pub temp_c: Option<f32>,
    pub humidity_rh: Option<f32>,
    pub pressure_hpa: Option<f32>,
    pub rain_pulses: u32,
    pub wind_pulses: u32,
}

// --- Payload binario LoRaWAN (14 bytes, little-endian) ---
// Offset  Campo            Tipo    Rango
//  0      device_id        u8      0–255
//  1–2    seq              u16 LE  0–65535 (wraps)
//  3–4    temp_c_x100      i16 LE  °C×100 (−4000..+8500)
//  5–6    hum_x100         u16 LE  %RH×100 (0–10000)
//  7–8    lluvia_pulsos    u16 LE  pulsos acumulados
//  9–10   viento_pulsos    u16 LE  pulsos acumulados
// 11–12   bateria_mv       u16 LE  mV (0–4200)
// 13      crc8             u8      CRC-8/MAXIM sobre bytes 0–12

pub const BINARY_PAYLOAD_LEN: usize = 14;

#[derive(Debug, Clone, Copy)]
pub struct BinaryMeasurement {
    pub device_id: u8,
    pub seq: u16,
    pub temp_c_x100: i16,
    pub hum_x100: u16,
    pub lluvia_pulsos: u16,
    pub viento_pulsos: u16,
    pub bateria_mv: u16,
}

/// Construye el FRMPayload binario de 14 bytes.
pub fn build_binary(m: &BinaryMeasurement) -> [u8; BINARY_PAYLOAD_LEN] {
    let mut buf = [0u8; BINARY_PAYLOAD_LEN];
    buf[0] = m.device_id;
    buf[1..3].copy_from_slice(&m.seq.to_le_bytes());
    buf[3..5].copy_from_slice(&m.temp_c_x100.to_le_bytes());
    buf[5..7].copy_from_slice(&m.hum_x100.to_le_bytes());
    buf[7..9].copy_from_slice(&m.lluvia_pulsos.to_le_bytes());
    buf[9..11].copy_from_slice(&m.viento_pulsos.to_le_bytes());
    buf[11..13].copy_from_slice(&m.bateria_mv.to_le_bytes());
    buf[13] = crc8_maxim(&buf[..13]);
    buf
}

/// CRC-8/MAXIM (polynomial 0x31, init 0x00, refin=true, refout=true, xorout=0x00).
pub fn crc8_maxim(data: &[u8]) -> u8 {
    const POLY: u8 = 0x31;
    let mut crc = 0u8;
    for &byte in data {
        crc ^= byte;
        for _ in 0..8 {
            if crc & 0x01 != 0 {
                crc = (crc >> 1) ^ POLY;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

/// Verifica el CRC de un payload binario recibido.
pub fn verify_binary_crc(payload: &[u8; BINARY_PAYLOAD_LEN]) -> bool {
    crc8_maxim(&payload[..13]) == payload[13]
}

/// Parsea un payload binario validado.
pub fn parse_binary(payload: &[u8; BINARY_PAYLOAD_LEN]) -> BinaryMeasurement {
    BinaryMeasurement {
        device_id: payload[0],
        seq: u16::from_le_bytes(payload[1..3].try_into().unwrap()),
        temp_c_x100: i16::from_le_bytes(payload[3..5].try_into().unwrap()),
        hum_x100: u16::from_le_bytes(payload[5..7].try_into().unwrap()),
        lluvia_pulsos: u16::from_le_bytes(payload[7..9].try_into().unwrap()),
        viento_pulsos: u16::from_le_bytes(payload[9..11].try_into().unwrap()),
        bateria_mv: u16::from_le_bytes(payload[11..13].try_into().unwrap()),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedPayload<'a> {
    pub device_id: &'a str,
    pub seq: &'a str,
    pub temp_c: &'a str,
    pub humidity_rh: &'a str,
    pub pressure_hpa: &'a str,
    pub rain_pulses: &'a str,
    pub wind_pulses: &'a str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayloadError {
    WrongFieldCount,
    TooLong,
}

pub fn build_csv(device_id: &str, measurement: Measurement) -> Result<String<MAX_PAYLOAD_LEN>, PayloadError> {
    let mut payload = String::<MAX_PAYLOAD_LEN>::new();
    write!(
        payload,
        "{},{},{},{},{},{},{}",
        device_id,
        measurement.seq,
        format_float(measurement.temp_c),
        format_float(measurement.humidity_rh),
        format_float(measurement.pressure_hpa),
        measurement.rain_pulses,
        measurement.wind_pulses
    )
    .map_err(|_| PayloadError::TooLong)?;

    Ok(payload)
}

pub fn parse_csv(payload: &str) -> Result<ParsedPayload<'_>, PayloadError> {
    let mut fields = payload.split(',');
    let parsed = ParsedPayload {
        device_id: fields.next().ok_or(PayloadError::WrongFieldCount)?,
        seq: fields.next().ok_or(PayloadError::WrongFieldCount)?,
        temp_c: fields.next().ok_or(PayloadError::WrongFieldCount)?,
        humidity_rh: fields.next().ok_or(PayloadError::WrongFieldCount)?,
        pressure_hpa: fields.next().ok_or(PayloadError::WrongFieldCount)?,
        rain_pulses: fields.next().ok_or(PayloadError::WrongFieldCount)?,
        wind_pulses: fields.next().ok_or(PayloadError::WrongFieldCount)?,
    };

    if fields.next().is_some() {
        return Err(PayloadError::WrongFieldCount);
    }

    Ok(parsed)
}

fn format_float(value: Option<f32>) -> String<16> {
    let mut out = String::<16>::new();
    match value {
        Some(value) => {
            let _ = write!(out, "{value:.1}");
        }
        None => {
            let _ = out.push_str("nan");
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_payload_in_expected_order() {
        let payload = build_csv(
            "wx-1",
            Measurement {
                seq: 7,
                temp_c: Some(21.25),
                humidity_rh: Some(48.04),
                pressure_hpa: Some(1012.96),
                rain_pulses: 3,
                wind_pulses: 12,
            },
        )
        .unwrap();

        assert_eq!(payload.as_str(), "wx-1,7,21.2,48.0,1013.0,3,12");
    }

    #[test]
    fn rejects_malformed_payload() {
        assert_eq!(parse_csv("too,few,fields"), Err(PayloadError::WrongFieldCount));
    }
}
