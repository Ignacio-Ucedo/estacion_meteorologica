#[derive(Debug, Clone, Copy)]
pub struct EnvironmentReading {
    pub temp_c: f32,
    pub humidity_rh: f32,
    pub pressure_hpa: f32,
}

#[derive(Debug, Clone, Copy)]
pub enum SensorError {
    Dht22Unavailable,
    Mpl115a2Unavailable,
    InvalidReading,
}

pub trait EnvironmentSensor {
    fn read_environment(&mut self) -> Result<EnvironmentReading, SensorError>;
}

pub struct UnwiredEnvironmentSensor;

impl EnvironmentSensor for UnwiredEnvironmentSensor {
    fn read_environment(&mut self) -> Result<EnvironmentReading, SensorError> {
        Err(SensorError::InvalidReading)
    }
}

/// Sensor simulado para pruebas de banco sin hardware DHT22/MPL115A2.
/// Genera un ciclo triangular de temperatura (15–25 °C, 144 pasos ≈ 24 h a
/// 10 min/ciclo) y humedad inversamente correlacionada (≈ 60–75 %).
pub struct MockEnvironmentSensor {
    cycle: u32,
}

impl MockEnvironmentSensor {
    pub fn new() -> Self {
        Self { cycle: 0 }
    }
}

impl EnvironmentSensor for MockEnvironmentSensor {
    fn read_environment(&mut self) -> Result<EnvironmentReading, SensorError> {
        self.cycle = self.cycle.wrapping_add(1);
        let phase = self.cycle % 144;

        let temp_c = if phase < 72 {
            15.0 + (phase as f32) * (10.0 / 72.0)
        } else {
            25.0 - ((phase - 72) as f32) * (10.0 / 72.0)
        };
        let humidity_rh = (75.0 - (temp_c - 15.0) * 1.5).clamp(40.0, 80.0);

        Ok(EnvironmentReading {
            temp_c,
            humidity_rh,
            pressure_hpa: 1013.25,
        })
    }
}
