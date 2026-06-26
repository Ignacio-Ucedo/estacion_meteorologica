#[derive(Debug, Clone, Copy)]
pub enum RadioError {
    NotInitialized,
    TxFailed,
    RxFailed,
}

pub trait LoraRadio {
    fn transmit(&mut self, payload: &[u8]) -> Result<(), RadioError>;
    fn receive<'a>(&mut self, buffer: &'a mut [u8]) -> Result<Option<&'a str>, RadioError>;
}

pub struct UnwiredLoraRadio;

impl LoraRadio for UnwiredLoraRadio {
    fn transmit(&mut self, _payload: &[u8]) -> Result<(), RadioError> {
        Err(RadioError::NotInitialized)
    }

    fn receive<'a>(&mut self, _buffer: &'a mut [u8]) -> Result<Option<&'a str>, RadioError> {
        Ok(None)
    }
}
