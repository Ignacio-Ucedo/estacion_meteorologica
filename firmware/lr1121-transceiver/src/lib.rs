//! Driver Rust para LR1121 en modo transceiver (firmware de fábrica).
//!
//! Wraps `lr11xx_driver` (SWDR001) vía FFI para el gateway single-channel.
//! El gateway solo necesita RX raw en AU915 — no hay stack LoRaWAN en el chip.
//!
//! # Prerequisite
//! Colocar SWDR001 en `vendor/lr11xx_driver/`. Ver `vendor/README.md`.
//! El chip NO debe tener Modem-E flashed — este driver requiere modo transceiver.

use anyhow::Result;
use esp_idf_hal::{
    delay::FreeRtos,
    gpio::{Input, Output, PinDriver},
    spi::{SpiDeviceDriver, SpiDriver},
};
use log::{debug, error, warn};

// ---------------------------------------------------------------------------
// Constantes de radio — AU915 sub-band 2, canal 8 (PoC canal fijo)
// ---------------------------------------------------------------------------

/// Frecuencia del canal 8 AU915 sub-band 2 en Hz (903.9 MHz).
pub const AU915_SUBBAND2_FREQ_HZ: u32 = 903_900_000;

// SF / BW enums deben coincidir con lr11xx_radio_lora_sf_t / bw_t de SWDR001.
// Valores numéricos según lr11xx_radio.h de SWDR001.

#[repr(u8)]
#[derive(Debug, Clone, Copy)]
pub enum SpreadingFactor {
    Sf7  = 0x04,
    Sf8  = 0x05,
    Sf9  = 0x06,
    Sf10 = 0x07,
    Sf11 = 0x08,
    Sf12 = 0x09,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy)]
pub enum Bandwidth {
    Bw125 = 0x04,
    Bw250 = 0x05,
    Bw500 = 0x06,
}

// ---------------------------------------------------------------------------
// Tipos de retorno públicos
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct RxPacket {
    pub payload: Vec<u8>,
    pub rssi_dbm: i16,
    pub snr_db: i8,
}

#[derive(Debug)]
pub enum TransceiverError {
    BusyTimeout,
    CommandFailed(u8),
    ModemEDetected,
    RxTimeout,
    ChipVersionUnknown,
}

impl std::fmt::Display for TransceiverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}
impl std::error::Error for TransceiverError {}

// ---------------------------------------------------------------------------
// Status OK de SWDR001 (lr11xx_status_t = 0)
// ---------------------------------------------------------------------------
const RC_OK: u8 = 0;

// ---------------------------------------------------------------------------
// HAL context — mismo patrón que lr1121-modem-e
// ---------------------------------------------------------------------------

pub(crate) struct HalCtx {
    pub spi: SpiDeviceDriver<'static, SpiDriver<'static>>,
    pub busy: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
    pub reset: PinDriver<'static, esp_idf_hal::gpio::AnyOutputPin, Output>,
}

pub(crate) static mut HAL_CTX: *mut HalCtx = core::ptr::null_mut();

const BUSY_POLL_MS: u32 = 1;
const BUSY_MAX_ITERS: u32 = 1_000;

unsafe fn wait_busy_low() -> bool {
    let ctx = &mut *HAL_CTX;
    for _ in 0..BUSY_MAX_ITERS {
        if ctx.busy.is_low().unwrap_or(false) { return true; }
        FreeRtos::delay_ms(BUSY_POLL_MS);
    }
    false
}

// ---------------------------------------------------------------------------
// HAL callbacks llamados por SWDR001
// ---------------------------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn lr11xx_hal_write(
    _context: *const core::ffi::c_void,
    command: *const u8,
    command_length: u16,
    data: *const u8,
    data_length: u16,
) -> u8 {
    if HAL_CTX.is_null() { return 1; }
    let ctx = &mut *HAL_CTX;
    let cmd = core::slice::from_raw_parts(command, command_length as usize);
    let payload = if data_length > 0 {
        core::slice::from_raw_parts(data, data_length as usize)
    } else {
        &[]
    };
    let mut buf = Vec::with_capacity(cmd.len() + payload.len());
    buf.extend_from_slice(cmd);
    buf.extend_from_slice(payload);
    if ctx.spi.write(&buf).is_err() { return 1; }
    if !wait_busy_low() { warn!("lr11xx_hal_write: busy timeout"); return 2; }
    0
}

#[no_mangle]
pub unsafe extern "C" fn lr11xx_hal_read(
    _context: *const core::ffi::c_void,
    command: *const u8,
    command_length: u16,
    data: *mut u8,
    data_length: u16,
) -> u8 {
    if HAL_CTX.is_null() { return 1; }
    let ctx = &mut *HAL_CTX;
    let cmd = core::slice::from_raw_parts(command, command_length as usize);
    if ctx.spi.write(cmd).is_err() { return 1; }
    if !wait_busy_low() { warn!("lr11xx_hal_read: busy timeout"); return 2; }
    let rx = core::slice::from_raw_parts_mut(data, data_length as usize);
    if ctx.spi.read(rx).is_err() { return 1; }
    0
}

#[no_mangle]
pub unsafe extern "C" fn lr11xx_hal_write_read(
    _context: *const core::ffi::c_void,
    command: *const u8,
    data: *mut u8,
    length: u16,
) -> u8 {
    if HAL_CTX.is_null() { return 1; }
    let ctx = &mut *HAL_CTX;
    let mut buf: Vec<u8> = core::slice::from_raw_parts(command, length as usize).to_vec();
    if ctx.spi.transfer_in_place(&mut buf).is_err() { return 1; }
    core::slice::from_raw_parts_mut(data, length as usize).copy_from_slice(&buf);
    0
}

#[no_mangle]
pub unsafe extern "C" fn lr11xx_hal_reset(
    _context: *const core::ffi::c_void,
) -> u8 {
    if HAL_CTX.is_null() { return 1; }
    let ctx = &mut *HAL_CTX;
    let _ = ctx.reset.set_low();
    FreeRtos::delay_ms(10);
    let _ = ctx.reset.set_high();
    FreeRtos::delay_ms(5); // transceiver boot es más rápido que Modem-E
    0
}

#[no_mangle]
pub unsafe extern "C" fn lr11xx_hal_wakeup(
    _context: *const core::ffi::c_void,
) -> u8 {
    // Wakeup: toggle NSS briefly. SpiDeviceDriver lo hace al iniciar transacción.
    // Enviar 1 byte nop es suficiente para salir del modo sleep.
    if HAL_CTX.is_null() { return 1; }
    let ctx = &mut *HAL_CTX;
    let _ = ctx.spi.write(&[0x00]);
    FreeRtos::delay_ms(2);
    0
}

// ---------------------------------------------------------------------------
// extern "C" — funciones de SWDR001 que llamamos desde Rust
// ---------------------------------------------------------------------------

#[repr(C)]
#[derive(Default, Debug)]
pub struct Lr11xxSystemVersion {
    pub chip_firmware_type: u8,
    pub fw_version: u16,
    pub chip_type: u8,
}

/// Parámetros de modulación LoRa para SWDR001.
#[repr(C)]
pub struct Lr11xxRadioLoraModParams {
    pub sf: u8,
    pub bw: u8,
    pub cr: u8,
    pub ldro: u8,
}

/// Estadísticas de paquete LoRa recibido.
#[repr(C)]
#[derive(Default, Debug)]
pub struct Lr11xxRadioLoraPacketStatus {
    pub rssi_pkt_in_dbm: i8,
    pub snr_pkt_in_db: i8,
    pub signal_rssi_pkt_in_dbm: i8,
}

/// Información de paquete recibido (tamaño y puntero FIFO).
#[repr(C)]
#[derive(Default, Debug)]
pub struct Lr11xxRadioRxBufferStatus {
    pub payload_length: u8,
    pub buffer_start_pointer: u8,
}

extern "C" {
    fn lr11xx_system_get_version(
        context: *const core::ffi::c_void,
        version: *mut Lr11xxSystemVersion,
    ) -> u8;

    fn lr11xx_system_reset(context: *const core::ffi::c_void) -> u8;

    fn lr11xx_radio_set_rf_freq(
        context: *const core::ffi::c_void,
        freq_hz: u32,
    ) -> u8;

    fn lr11xx_radio_set_lora_mod_params(
        context: *const core::ffi::c_void,
        params: *const Lr11xxRadioLoraModParams,
    ) -> u8;

    // timeout=0 → RX continuo (single en datasheet pero se re-arma en el loop)
    fn lr11xx_radio_set_rx(
        context: *const core::ffi::c_void,
        timeout_in_ms: u32,
    ) -> u8;

    fn lr11xx_radio_get_rx_buffer_status(
        context: *const core::ffi::c_void,
        rx_buffer_status: *mut Lr11xxRadioRxBufferStatus,
    ) -> u8;

    fn lr11xx_radio_get_lora_packet_status(
        context: *const core::ffi::c_void,
        pkt_status: *mut Lr11xxRadioLoraPacketStatus,
    ) -> u8;

    fn lr11xx_regmem_read_buffer8(
        context: *const core::ffi::c_void,
        buffer: *mut u8,
        size: u8,
    ) -> u8;
}

// ---------------------------------------------------------------------------
// Safe Rust API
// ---------------------------------------------------------------------------

/// Driver Rust para LR1121 en modo transceiver.
///
/// Uso típico para el gateway:
/// ```ignore
/// let mut rx = Lr1121Transceiver::new(spi, busy, reset, dio1)?;
/// rx.set_rx_config(AU915_SUBBAND2_FREQ_HZ, SpreadingFactor::Sf7, Bandwidth::Bw125)?;
/// rx.start_rx_continuous()?;
/// loop {
///     let pkt = rx.read_packet()?;
///     forward_udp(&pkt);
/// }
/// ```
pub struct Lr1121Transceiver {
    dio1: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
    _ctx: Box<HalCtx>,
}

impl Lr1121Transceiver {
    /// Inicializa el chip y verifica modo transceiver (no Modem-E).
    pub fn new(
        spi: SpiDeviceDriver<'static, SpiDriver<'static>>,
        busy: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
        reset: PinDriver<'static, esp_idf_hal::gpio::AnyOutputPin, Output>,
        dio1: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
    ) -> Result<Self, TransceiverError> {
        let ctx = Box::new(HalCtx { spi, busy, reset });
        unsafe { HAL_CTX = Box::as_ptr(&ctx) as *mut HalCtx; }

        // Reset + get version
        let rc = unsafe { lr11xx_system_reset(HAL_CTX as *const _) };
        if rc != RC_OK { return Err(TransceiverError::CommandFailed(rc)); }
        FreeRtos::delay_ms(5);

        let mut version = Lr11xxSystemVersion::default();
        let rc = unsafe { lr11xx_system_get_version(HAL_CTX as *const _, &mut version) };
        if rc != RC_OK { return Err(TransceiverError::CommandFailed(rc)); }

        // chip_firmware_type = 0x01 → transceiver; 0x02 → Modem-E
        if version.chip_firmware_type == 0x02 {
            error!("lr1121_transceiver: chip en modo Modem-E — se requiere modo transceiver");
            return Err(TransceiverError::ModemEDetected);
        }
        if version.chip_firmware_type != 0x01 {
            return Err(TransceiverError::ChipVersionUnknown);
        }
        debug!("lr1121_transceiver_ok fw={:#06x}", version.fw_version);

        Ok(Lr1121Transceiver { dio1, _ctx: ctx })
    }

    /// Configura frecuencia y parámetros LoRa.
    pub fn set_rx_config(
        &mut self,
        freq_hz: u32,
        sf: SpreadingFactor,
        bw: Bandwidth,
    ) -> Result<(), TransceiverError> {
        let rc = unsafe { lr11xx_radio_set_rf_freq(HAL_CTX as *const _, freq_hz) };
        if rc != RC_OK { return Err(TransceiverError::CommandFailed(rc)); }

        let params = Lr11xxRadioLoraModParams {
            sf: sf as u8,
            bw: bw as u8,
            cr: 0x01, // CR 4/5
            ldro: 0,  // LDR off para SF7
        };
        let rc = unsafe {
            lr11xx_radio_set_lora_mod_params(HAL_CTX as *const _, &params)
        };
        if rc != RC_OK { return Err(TransceiverError::CommandFailed(rc)); }
        Ok(())
    }

    /// Pone el chip en modo RX continuo (timeout=0 → continuo).
    pub fn start_rx_continuous(&mut self) -> Result<(), TransceiverError> {
        let rc = unsafe { lr11xx_radio_set_rx(HAL_CTX as *const _, 0xFFFFFF) };
        if rc != RC_OK { return Err(TransceiverError::CommandFailed(rc)); }
        Ok(())
    }

    /// Bloquea hasta recibir un paquete (poll de DIO1) y lo retorna.
    /// Rearranca el RX después de cada paquete para permanecer en RX continuo.
    pub fn read_packet(&mut self) -> Result<RxPacket, TransceiverError> {
        // Poll DIO1 hasta RX_DONE
        loop {
            FreeRtos::delay_ms(5);
            if self.dio1.is_high().unwrap_or(false) { break; }
        }

        // Estadísticas RSSI/SNR
        let mut pkt_status = Lr11xxRadioLoraPacketStatus::default();
        unsafe { lr11xx_radio_get_lora_packet_status(HAL_CTX as *const _, &mut pkt_status) };

        // Tamaño y posición del buffer
        let mut buf_status = Lr11xxRadioRxBufferStatus::default();
        let rc = unsafe {
            lr11xx_radio_get_rx_buffer_status(HAL_CTX as *const _, &mut buf_status)
        };
        if rc != RC_OK { return Err(TransceiverError::CommandFailed(rc)); }

        let len = buf_status.payload_length as usize;
        let mut payload = vec![0u8; len];
        let rc = unsafe {
            lr11xx_regmem_read_buffer8(HAL_CTX as *const _, payload.as_mut_ptr(), len as u8)
        };
        if rc != RC_OK { return Err(TransceiverError::CommandFailed(rc)); }

        // Rearrancar RX continuo
        unsafe { lr11xx_radio_set_rx(HAL_CTX as *const _, 0xFFFFFF) };

        Ok(RxPacket {
            payload,
            rssi_dbm: pkt_status.rssi_pkt_in_dbm as i16,
            snr_db: pkt_status.snr_pkt_in_db,
        })
    }
}

impl Drop for Lr1121Transceiver {
    fn drop(&mut self) {
        unsafe { HAL_CTX = core::ptr::null_mut(); }
    }
}
