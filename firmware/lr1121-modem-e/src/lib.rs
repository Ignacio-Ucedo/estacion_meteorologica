//! Driver Rust para LR1121 corriendo firmware Modem-E v2.1.0.
//!
//! Wraps el host driver C `lr1121_modemE_driver` (SWDR009) vía FFI.
//! Modem-E implementa el stack LoRaWAN 1.0.4 en el chip; el ESP32
//! actúa como orquestador enviando comandos de alto nivel por SPI.
//!
//! # Prerequisite de hardware
//! El LR1121 debe tener Modem-E v2.1.0 flashed (ver tarea 1.1).
//! Colocar SWDR009 en `vendor/lr1121_modemE_driver/` antes de compilar.
//! Ver `vendor/README.md`.

use anyhow::Result;
use esp_idf_hal::{
    delay::FreeRtos,
    gpio::{Input, Output, PinDriver},
    spi::{SpiDeviceDriver, SpiDriver},
};
use log::{debug, error, info, warn};

// ---------------------------------------------------------------------------
// FFI declarations: SWDR009 C API (lr1121_modemE_driver)
// ---------------------------------------------------------------------------
// Matched against lr1121_modem_lorawan.h / lr1121_modem_common.h.
// Satisfied at link time by the compiled vendor library (build.rs).

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Region {
    Au915 = 0x03,
    Eu433 = 0x0e,
    Us915 = 0x0c,
}

/// AU915 sub-band 2: canales upstream 8–15 (903.9–905.3 MHz 125 kHz).
/// Máscara de grupos de 8 canales — grupo 1 (index 1) = canales 8–15.
const AU915_SUBBAND2_MASK: u16 = 0x0002;
const AU915_SUBBAND2_MASK_CNTL: u8 = 0x00;

const FPORT_WEATHER: u8 = 2;

/// Valor de retorno OK del Modem-E (lr1121_modem_response_code_t = 0x00).
const MODEM_E_RC_OK: u8 = 0x00;

/// Tipos de eventos Modem-E relevantes.
const EVENT_JOINED: u8 = 0x06;
const EVENT_TX_DONE: u8 = 0x07;
const EVENT_RESET: u8 = 0x00;

/// Uplink no confirmado.
const UPLINK_UNCONFIRMED: u8 = 0x00;

/// JOIN timeout por defecto (ms) — suficiente para retransmisiones del Modem-E.
pub const JOIN_TIMEOUT_MS: u32 = 120_000;
/// TX_DONE timeout por defecto (ms) — cubre air-time AU915 SF7 + margen.
pub const TX_DONE_TIMEOUT_MS: u32 = 5_000;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum ModemEError {
    BusyTimeout,
    CommandFailed(u8),
    UnexpectedEvent { got: u8, expected: u8 },
    PayloadTooLarge,
}

impl std::fmt::Display for ModemEError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for ModemEError {}

// ---------------------------------------------------------------------------
// HAL context — shared between ModemE and the C HAL callbacks
// ---------------------------------------------------------------------------

pub(crate) struct HalCtx {
    pub spi: SpiDeviceDriver<'static, SpiDriver<'static>>,
    pub busy: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
    pub reset: PinDriver<'static, esp_idf_hal::gpio::AnyOutputPin, Output>,
}

/// Puntero al HalCtx activo.
/// SAFETY: firmware ESP32 single-threaded; creado y destruido con ModemE.
pub(crate) static mut HAL_CTX: *mut HalCtx = core::ptr::null_mut();

const BUSY_POLL_INTERVAL_MS: u32 = 1;
const BUSY_POLL_MAX_ITERS: u32 = 1_000; // 1 s máximo

/// Espera hasta que BUSY baje. Retorna false en timeout.
unsafe fn wait_busy_low() -> bool {
    let ctx = &mut *HAL_CTX;
    for _ in 0..BUSY_POLL_MAX_ITERS {
        if ctx.busy.is_low().unwrap_or(false) {
            return true;
        }
        FreeRtos::delay_ms(BUSY_POLL_INTERVAL_MS);
    }
    false
}

// ---------------------------------------------------------------------------
// HAL callbacks llamados por SWDR009
// SAFETY: SWDR009 llama estas funciones desde el contexto de la tarea ESP32.
// ---------------------------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn lr1121_modem_hal_write(
    _context: *const core::ffi::c_void,
    command: *const u8,
    command_length: u16,
    data: *const u8,
    data_length: u16,
) -> u8 {
    if HAL_CTX.is_null() {
        return 1;
    }
    // Protocolo LR1121: NSS LOW → send opcode+params → NSS HIGH → esperar BUSY LOW.
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

    if ctx.spi.write(&buf).is_err() {
        return 1;
    }
    if !wait_busy_low() {
        warn!("lr1121_hal_write: busy timeout");
        return 2; // LR1121_MODEM_HAL_STATUS_BUSY_TIMEOUT (not spec, used as sentinel)
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn lr1121_modem_hal_read(
    _context: *const core::ffi::c_void,
    command: *const u8,
    command_length: u16,
    data: *mut u8,
    data_length: u16,
) -> u8 {
    if HAL_CTX.is_null() {
        return 1;
    }
    let ctx = &mut *HAL_CTX;
    let cmd = core::slice::from_raw_parts(command, command_length as usize);

    // Enviar comando
    if ctx.spi.write(cmd).is_err() {
        return 1;
    }
    // Esperar BUSY LOW antes de leer la respuesta
    if !wait_busy_low() {
        warn!("lr1121_hal_read: busy timeout after command");
        return 2;
    }
    let rx = core::slice::from_raw_parts_mut(data, data_length as usize);
    if ctx.spi.read(rx).is_err() {
        return 1;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn lr1121_modem_hal_write_read(
    _context: *const core::ffi::c_void,
    command: *const u8,
    data: *mut u8,
    length: u16,
) -> u8 {
    if HAL_CTX.is_null() {
        return 1;
    }
    let ctx = &mut *HAL_CTX;
    let mut buf: Vec<u8> = core::slice::from_raw_parts(command, length as usize).to_vec();
    if ctx.spi.transfer_in_place(&mut buf).is_err() {
        return 1;
    }
    core::slice::from_raw_parts_mut(data, length as usize).copy_from_slice(&buf);
    0
}

#[no_mangle]
pub unsafe extern "C" fn lr1121_modem_hal_reset(
    _context: *const core::ffi::c_void,
) -> u8 {
    if HAL_CTX.is_null() {
        return 1;
    }
    let ctx = &mut *HAL_CTX;
    let _ = ctx.reset.set_low();
    FreeRtos::delay_ms(10);
    let _ = ctx.reset.set_high();
    FreeRtos::delay_ms(20); // Modem-E boot time
    0
}

// ---------------------------------------------------------------------------
// extern "C" — funciones del SDK SWDR009 que llamamos desde Rust
// ---------------------------------------------------------------------------

#[repr(C)]
#[derive(Default, Debug)]
pub struct Lr1121ModemVersion {
    pub bootloader: u32,
    pub functionality: u8,
    pub firmware: [u8; 2],
    pub lorawan: u8,
}

#[repr(C)]
#[derive(Default, Debug)]
pub struct Lr1121ModemEvent {
    pub event_type: u8,
    pub missed_events_count: u8,
}

extern "C" {
    fn lr1121_modem_get_version(
        context: *const core::ffi::c_void,
        version: *mut Lr1121ModemVersion,
    ) -> u8;

    fn lr1121_modem_lorawan_set_region(
        context: *const core::ffi::c_void,
        region: u8,
    ) -> u8;

    // channel_mask_cntl selecciona el grupo de 8 canales a configurar;
    // channel_mask es el bitmask de canales dentro de ese grupo.
    fn lr1121_modem_lorawan_set_enabled_channels(
        context: *const core::ffi::c_void,
        channel_mask: u16,
        channel_mask_cntl: u8,
    ) -> u8;

    fn lr1121_modem_lorawan_set_dev_eui(
        context: *const core::ffi::c_void,
        dev_eui: *const u8,
    ) -> u8;

    fn lr1121_modem_lorawan_set_join_eui(
        context: *const core::ffi::c_void,
        join_eui: *const u8,
    ) -> u8;

    fn lr1121_modem_lorawan_set_app_key(
        context: *const core::ffi::c_void,
        app_key: *const u8,
    ) -> u8;

    fn lr1121_modem_lorawan_join(context: *const core::ffi::c_void) -> u8;

    fn lr1121_modem_lorawan_request_uplink(
        context: *const core::ffi::c_void,
        fport: u8,
        uplink_type: u8,
        data: *const u8,
        len: u8,
    ) -> u8;

    fn lr1121_modem_get_event(
        context: *const core::ffi::c_void,
        event: *mut Lr1121ModemEvent,
    ) -> u8;
}

// ---------------------------------------------------------------------------
// Safe Rust API
// ---------------------------------------------------------------------------

/// Driver Rust para LR1121 corriendo Modem-E v2.1.0.
///
/// Uso típico:
/// ```ignore
/// let mut modem = ModemE::new(spi, busy_pin, reset_pin, dio1_pin)?;
/// modem.configure_au915_subband2(&dev_eui, &join_eui, &app_key)?;
/// modem.join(JOIN_TIMEOUT_MS)?;
/// modem.request_uplink(FPORT_WEATHER, &payload)?;
/// ```
pub struct ModemE {
    dio1: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
    _ctx: Box<HalCtx>,
}

impl ModemE {
    /// Inicializa el driver y verifica que el chip corre Modem-E (no transceiver).
    pub fn new(
        spi: SpiDeviceDriver<'static, SpiDriver<'static>>,
        busy: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
        reset: PinDriver<'static, esp_idf_hal::gpio::AnyOutputPin, Output>,
        dio1: PinDriver<'static, esp_idf_hal::gpio::AnyInputPin, Input>,
    ) -> Result<Self, ModemEError> {
        let ctx = Box::new(HalCtx { spi, busy, reset });
        // SAFETY: single-threaded ESP32 firmware; pointer is valid for the duration of ModemE.
        unsafe { HAL_CTX = Box::as_ptr(&ctx) as *mut HalCtx; }

        let mut version = Lr1121ModemVersion::default();
        let rc = unsafe { lr1121_modem_get_version(HAL_CTX as *const _, &mut version) };
        if rc != MODEM_E_RC_OK {
            return Err(ModemEError::CommandFailed(rc));
        }
        info!(
            "modem_e_ok firmware={}.{} lorawan={}",
            version.firmware[0], version.firmware[1], version.lorawan
        );

        Ok(ModemE { dio1, _ctx: ctx })
    }

    /// Configura región AU915 sub-band 2 y carga credenciales OTAA desde NVS.
    pub fn configure_au915_subband2(
        &mut self,
        dev_eui: &[u8; 8],
        join_eui: &[u8; 8],
        app_key: &[u8; 16],
    ) -> Result<(), ModemEError> {
        self.set_region(Region::Au915)?;
        self.set_channel_mask_subband2()?;
        self.set_dev_eui(dev_eui)?;
        self.set_join_eui(join_eui)?;
        self.set_app_key(app_key)?;
        info!("modem_e_configured region=AU915 subband=2");
        Ok(())
    }

    fn set_region(&mut self, region: Region) -> Result<(), ModemEError> {
        let rc = unsafe { lr1121_modem_lorawan_set_region(HAL_CTX as *const _, region as u8) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_channel_mask_subband2(&mut self) -> Result<(), ModemEError> {
        let rc = unsafe {
            lr1121_modem_lorawan_set_enabled_channels(
                HAL_CTX as *const _,
                AU915_SUBBAND2_MASK,
                AU915_SUBBAND2_MASK_CNTL,
            )
        };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_dev_eui(&mut self, eui: &[u8; 8]) -> Result<(), ModemEError> {
        let rc = unsafe { lr1121_modem_lorawan_set_dev_eui(HAL_CTX as *const _, eui.as_ptr()) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_join_eui(&mut self, eui: &[u8; 8]) -> Result<(), ModemEError> {
        let rc = unsafe { lr1121_modem_lorawan_set_join_eui(HAL_CTX as *const _, eui.as_ptr()) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_app_key(&mut self, key: &[u8; 16]) -> Result<(), ModemEError> {
        let rc = unsafe { lr1121_modem_lorawan_set_app_key(HAL_CTX as *const _, key.as_ptr()) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    /// Join OTAA. Bloquea hasta evento JOINED en DIO1 o timeout_ms.
    /// Modem-E maneja reintentos internamente con backoff.
    pub fn join(&mut self, timeout_ms: u32) -> Result<(), ModemEError> {
        info!("modem_e_join_start timeout_ms={}", timeout_ms);
        let rc = unsafe { lr1121_modem_lorawan_join(HAL_CTX as *const _) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        self.wait_event(timeout_ms, EVENT_JOINED)
    }

    /// Envía uplink no confirmado en el fport de weather. Bloquea hasta TX_DONE.
    pub fn request_uplink(&mut self, payload: &[u8]) -> Result<(), ModemEError> {
        if payload.len() > 255 { return Err(ModemEError::PayloadTooLarge); }
        debug!("modem_e_uplink_start len={}", payload.len());
        let rc = unsafe {
            lr1121_modem_lorawan_request_uplink(
                HAL_CTX as *const _,
                FPORT_WEATHER,
                UPLINK_UNCONFIRMED,
                payload.as_ptr(),
                payload.len() as u8,
            )
        };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        self.wait_event(TX_DONE_TIMEOUT_MS, EVENT_TX_DONE)
    }

    /// Polling de DIO1 hasta que llega el evento esperado o se alcanza el timeout.
    fn wait_event(&mut self, timeout_ms: u32, expected: u8) -> Result<(), ModemEError> {
        let mut elapsed = 0u32;
        let poll_ms = 10u32;
        loop {
            FreeRtos::delay_ms(poll_ms);
            elapsed += poll_ms;

            if self.dio1.is_high().unwrap_or(false) {
                let mut ev = Lr1121ModemEvent::default();
                let rc = unsafe { lr1121_modem_get_event(HAL_CTX as *const _, &mut ev) };
                if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }

                if ev.event_type == EVENT_RESET {
                    error!("modem_e_reset_event — chip reiniciado");
                    return Err(ModemEError::CommandFailed(EVENT_RESET));
                }
                if ev.event_type == expected {
                    debug!("modem_e_event_ok type={}", expected);
                    return Ok(());
                }
                error!("modem_e_event_unexpected got={} expected={}", ev.event_type, expected);
                return Err(ModemEError::UnexpectedEvent { got: ev.event_type, expected });
            }

            if elapsed >= timeout_ms {
                error!("modem_e_event_timeout expected={} after_ms={}", expected, elapsed);
                return Err(ModemEError::BusyTimeout);
            }
        }
    }
}

impl Drop for ModemE {
    fn drop(&mut self) {
        unsafe { HAL_CTX = core::ptr::null_mut(); }
    }
}
