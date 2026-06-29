//! Driver SX1278 para ESP-IDF Rust.
//!
//! Opera el SX1278 vía SPI en modo LoRa. Usado tanto por el nodo sensor
//! (TX de uplinks) como por el gateway (RX continuo).
//!
//! Limitaciones del prototipo:
//! - Canal fijo: 433.175 MHz SF7BW125 (EU433 canal 0)
//! - Sin soporte de ventanas RX1/RX2 separadas
//! - Sin frequency hopping

use anyhow::{bail, Context, Result};
use esp_idf_hal::{
    delay::FreeRtos,
    gpio::{Output, PinDriver},
    spi::{SpiDeviceDriver, SpiDriver, config::Config as SpiConfig},
};
use log::{debug, warn};

// --- Registros SX1278 ---
const REG_FIFO: u8 = 0x00;
const REG_OP_MODE: u8 = 0x01;
const REG_FR_MSB: u8 = 0x06;
const REG_FR_MID: u8 = 0x07;
const REG_FR_LSB: u8 = 0x08;
const REG_PA_CONFIG: u8 = 0x09;
const REG_LNA: u8 = 0x0C;
const REG_FIFO_ADDR_PTR: u8 = 0x0D;
const REG_FIFO_TX_BASE_ADDR: u8 = 0x0E;
const REG_FIFO_RX_BASE_ADDR: u8 = 0x0F;
const REG_FIFO_RX_CURRENT_ADDR: u8 = 0x10;
const REG_IRQ_FLAGS: u8 = 0x12;
const REG_RX_NB_BYTES: u8 = 0x13;
const REG_PKT_SNR_VALUE: u8 = 0x19;
const REG_PKT_RSSI_VALUE: u8 = 0x1A;
const REG_MODEM_CONFIG1: u8 = 0x1D;
const REG_MODEM_CONFIG2: u8 = 0x1E;
const REG_SYMB_TIMEOUT_LSB: u8 = 0x1F;
const REG_PREAMBLE_MSB: u8 = 0x20;
const REG_PREAMBLE_LSB: u8 = 0x21;
const REG_PAYLOAD_LENGTH: u8 = 0x22;
const REG_MODEM_CONFIG3: u8 = 0x26;
const REG_DETECTION_OPTIMIZE: u8 = 0x31;
const REG_DETECTION_THRESHOLD: u8 = 0x37;
const REG_SYNC_WORD: u8 = 0x39;
const REG_DIO_MAPPING1: u8 = 0x40;
const REG_VERSION: u8 = 0x42;
const REG_PA_DAC: u8 = 0x4D;

// OpMode bits
const MODE_LONG_RANGE: u8 = 0x80;
const MODE_SLEEP: u8 = 0x00;
const MODE_STANDBY: u8 = 0x01;
const MODE_TX: u8 = 0x03;
const MODE_RX_CONTINUOUS: u8 = 0x05;
const MODE_RX_SINGLE: u8 = 0x06;

// IRQ flags
const IRQ_TX_DONE: u8 = 0x08;
const IRQ_PAYLOAD_CRC_ERROR: u8 = 0x20;
const IRQ_RX_DONE: u8 = 0x40;

// 433.175 MHz: Frf = f * 2^19 / 32e6 = 7_103_488 = 0x6C_7A_00
const FREQ_MSB: u8 = 0x6C;
const FREQ_MID: u8 = 0x7A;
const FREQ_LSB: u8 = 0x00;

// ModemConfig1: BW=125kHz (0b0111), CR=4/5 (0b001), explicit header (0)
const MODEM_CONFIG1: u8 = 0b0111_001_0; // 0x72
// ModemConfig2: SF=7 (0b0111), normal TX (0), CRC on (1), RxTimeout MSB=0
const MODEM_CONFIG2: u8 = 0b0111_0_1_00; // 0x74
// ModemConfig3: LDO off for SF7 (0), AGC auto on (1)
const MODEM_CONFIG3: u8 = 0x04;

// SyncWord LoRaWAN (0x34 para LoRaWAN; 0x12 para LoRa privado)
const LORAWAN_SYNC_WORD: u8 = 0x34;

pub struct RadioMetadata {
    pub rssi_dbm: i16,
    pub snr_db: f32,
}

pub struct Sx1278 {
    spi: SpiDeviceDriver<'static, SpiDriver<'static>>,
    reset: PinDriver<'static, esp_idf_hal::gpio::AnyOutputPin, Output>,
}

impl Sx1278 {
    /// Inicializa el SX1278: reset → verificar versión → configurar LoRa EU433.
    pub fn new(
        spi: SpiDeviceDriver<'static, SpiDriver<'static>>,
        mut reset: PinDriver<'static, esp_idf_hal::gpio::AnyOutputPin, Output>,
    ) -> Result<Self> {
        // Reset hardware
        reset.set_low().context("reset low")?;
        FreeRtos::delay_ms(10);
        reset.set_high().context("reset high")?;
        FreeRtos::delay_ms(10);

        let mut radio = Sx1278 { spi, reset };

        let version = radio.read_reg(REG_VERSION);
        if version != 0x12 {
            bail!("sx1278_version_mismatch expected=0x12 got={:#04x}", version);
        }

        radio.configure_lora_eu433()?;
        Ok(radio)
    }

    fn write_reg(&mut self, reg: u8, val: u8) {
        let _ = self.spi.write(&[reg | 0x80, val]);
    }

    fn read_reg(&mut self, reg: u8) -> u8 {
        let mut buf = [reg & 0x7F, 0x00];
        let _ = self.spi.transfer_in_place(&mut buf);
        buf[1]
    }

    fn write_fifo(&mut self, data: &[u8]) {
        let mut buf = Vec::with_capacity(1 + data.len());
        buf.push(REG_FIFO | 0x80);
        buf.extend_from_slice(data);
        let _ = self.spi.write(&buf);
    }

    fn read_fifo(&mut self, buf: &mut [u8]) {
        // SPI: address byte + read bytes
        let addr = [REG_FIFO & 0x7F];
        let _ = self.spi.write(&addr);
        let _ = self.spi.read(buf);
    }

    fn set_mode(&mut self, mode: u8) {
        self.write_reg(REG_OP_MODE, MODE_LONG_RANGE | mode);
        FreeRtos::delay_ms(10);
    }

    fn configure_lora_eu433(&mut self) -> Result<()> {
        self.set_mode(MODE_SLEEP); // Debe estar en sleep para cambiar a LoRa mode

        // Frecuencia: 433.175 MHz
        self.write_reg(REG_FR_MSB, FREQ_MSB);
        self.write_reg(REG_FR_MID, FREQ_MID);
        self.write_reg(REG_FR_LSB, FREQ_LSB);

        // Parámetros de modulación
        self.write_reg(REG_MODEM_CONFIG1, MODEM_CONFIG1);
        self.write_reg(REG_MODEM_CONFIG2, MODEM_CONFIG2);
        self.write_reg(REG_MODEM_CONFIG3, MODEM_CONFIG3);

        // Preamble: 8 símbolos (estándar LoRaWAN)
        self.write_reg(REG_PREAMBLE_MSB, 0x00);
        self.write_reg(REG_PREAMBLE_LSB, 0x08);

        // SyncWord LoRaWAN
        self.write_reg(REG_SYNC_WORD, LORAWAN_SYNC_WORD);

        // SF7: optimización de detección
        self.write_reg(REG_DETECTION_OPTIMIZE, 0xC3);
        self.write_reg(REG_DETECTION_THRESHOLD, 0x0A);

        // LNA: max gain, boost enable
        self.write_reg(REG_LNA, 0x23);

        // PA: PA_BOOST pin, max power 17 dBm
        self.write_reg(REG_PA_CONFIG, 0x8F);
        self.write_reg(REG_PA_DAC, 0x84); // estándar (no 20 dBm)

        // DIO0 → TxDone en TX, RxDone en RX
        self.write_reg(REG_DIO_MAPPING1, 0x00);

        self.set_mode(MODE_STANDBY);
        Ok(())
    }

    /// Transmite `data` y espera TxDone (máximo 3 s).
    pub fn transmit(&mut self, data: &[u8]) -> Result<()> {
        self.set_mode(MODE_STANDBY);

        // Apuntar FIFO al base TX y escribir datos
        self.write_reg(REG_FIFO_TX_BASE_ADDR, 0x00);
        self.write_reg(REG_FIFO_ADDR_PTR, 0x00);
        self.write_fifo(data);
        self.write_reg(REG_PAYLOAD_LENGTH, data.len() as u8);

        // Iniciar transmisión
        self.write_reg(REG_IRQ_FLAGS, 0xFF); // limpiar flags
        self.set_mode(MODE_TX);

        // Poll hasta TxDone o timeout (~3 s)
        let deadline = 3_000u32;
        let mut elapsed = 0u32;
        loop {
            FreeRtos::delay_ms(5);
            elapsed += 5;
            let flags = self.read_reg(REG_IRQ_FLAGS);
            if flags & IRQ_TX_DONE != 0 {
                self.write_reg(REG_IRQ_FLAGS, IRQ_TX_DONE);
                self.set_mode(MODE_STANDBY);
                debug!("sx1278_tx_done len={}", data.len());
                return Ok(());
            }
            if elapsed >= deadline {
                self.set_mode(MODE_STANDBY);
                bail!("sx1278_tx_timeout");
            }
        }
    }

    /// Espera recibir un paquete en modo RX single, con timeout en ms.
    /// Retorna `Ok(Some(n))` si recibió n bytes en `buf`, `Ok(None)` si timeout.
    pub fn receive_with_timeout(&mut self, buf: &mut [u8], timeout_ms: u32) -> Result<Option<usize>> {
        self.set_mode(MODE_STANDBY);
        self.write_reg(REG_FIFO_RX_BASE_ADDR, 0x00);
        self.write_reg(REG_FIFO_ADDR_PTR, 0x00);
        self.write_reg(REG_IRQ_FLAGS, 0xFF);

        // Configurar timeout en símbolos (SF7/125kHz → cada símbolo ~1 ms)
        // Usamos RX_SINGLE para no bloquear indefinidamente
        let sym_timeout = (timeout_ms as u16).min(1023);
        self.write_reg(REG_SYMB_TIMEOUT_LSB, (sym_timeout & 0xFF) as u8);
        let config2 = self.read_reg(REG_MODEM_CONFIG2);
        self.write_reg(REG_MODEM_CONFIG2, (config2 & 0xFC) | ((sym_timeout >> 8) as u8 & 0x03));

        self.set_mode(MODE_RX_SINGLE);

        let mut elapsed = 0u32;
        loop {
            FreeRtos::delay_ms(5);
            elapsed += 5;
            let flags = self.read_reg(REG_IRQ_FLAGS);

            if flags & IRQ_RX_DONE != 0 {
                self.write_reg(REG_IRQ_FLAGS, IRQ_RX_DONE);

                if flags & IRQ_PAYLOAD_CRC_ERROR != 0 {
                    self.write_reg(REG_IRQ_FLAGS, IRQ_PAYLOAD_CRC_ERROR);
                    warn!("sx1278_rx_crc_error");
                    return Ok(None);
                }

                let nb = self.read_reg(REG_RX_NB_BYTES) as usize;
                let ptr = self.read_reg(REG_FIFO_RX_CURRENT_ADDR);
                self.write_reg(REG_FIFO_ADDR_PTR, ptr);

                let n = nb.min(buf.len());
                self.read_fifo(&mut buf[..n]);
                self.set_mode(MODE_STANDBY);
                return Ok(Some(n));
            }

            if elapsed >= timeout_ms {
                self.set_mode(MODE_STANDBY);
                return Ok(None);
            }
        }
    }

    /// Inicia RX continuo y retorna cuando se recibe un paquete.
    /// Bloquea hasta que llega algo. Usa polling interno.
    pub fn receive_continuous(&mut self, buf: &mut [u8]) -> Result<(usize, RadioMetadata)> {
        self.set_mode(MODE_STANDBY);
        self.write_reg(REG_FIFO_RX_BASE_ADDR, 0x00);
        self.write_reg(REG_FIFO_ADDR_PTR, 0x00);
        self.write_reg(REG_IRQ_FLAGS, 0xFF);
        self.set_mode(MODE_RX_CONTINUOUS);

        loop {
            FreeRtos::delay_ms(5);
            let flags = self.read_reg(REG_IRQ_FLAGS);

            if flags & IRQ_RX_DONE != 0 {
                self.write_reg(REG_IRQ_FLAGS, IRQ_RX_DONE);

                let snr_raw = self.read_reg(REG_PKT_SNR_VALUE) as i8;
                let rssi_raw = self.read_reg(REG_PKT_RSSI_VALUE) as i16;
                let snr_db = snr_raw as f32 / 4.0;
                // Para 433 MHz (LF band): RSSI = -164 + rssi_raw
                let rssi_dbm = -164 + rssi_raw;

                if flags & IRQ_PAYLOAD_CRC_ERROR != 0 {
                    self.write_reg(REG_IRQ_FLAGS, IRQ_PAYLOAD_CRC_ERROR);
                    warn!("sx1278_rx_crc_error rssi={} snr={:.1}", rssi_dbm, snr_db);
                    // No salir del loop RX continuo — seguir esperando
                    self.write_reg(REG_IRQ_FLAGS, 0xFF);
                    self.set_mode(MODE_RX_CONTINUOUS);
                    continue;
                }

                let nb = self.read_reg(REG_RX_NB_BYTES) as usize;
                let ptr = self.read_reg(REG_FIFO_RX_CURRENT_ADDR);
                self.write_reg(REG_FIFO_ADDR_PTR, ptr);

                let n = nb.min(buf.len());
                self.read_fifo(&mut buf[..n]);

                return Ok((n, RadioMetadata { rssi_dbm, snr_db }));
            }
        }
    }
}

// --- Stubs heredados del spike (mantener compilación del receiver-node legacy) ---

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
