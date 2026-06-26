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
