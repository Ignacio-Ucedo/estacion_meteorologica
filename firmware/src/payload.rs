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
