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
// Matched against modem_e_lorawan.h / modem_e_modem.h / modem_e_common.h.
// Satisfied at link time by the compiled vendor library (build.rs).

/// `modem_e_regions_t` — LoRaWAN regulatory regions.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Region {
    Au915 = 0x04, // MODEM_E_LORAWAN_REGION_AU915
    Eu868 = 0x01, // MODEM_E_LORAWAN_REGION_EU868
    Us915 = 0x03, // MODEM_E_LORAWAN_REGION_US915
}

/// AU915 sub-band 2: upstream channels 8–15 (916.8–918.2 MHz 125 kHz).
/// ChMaskCntl=0 covers channels 0–15; bits 8–15 set = sub-band 2.
/// Byte order: [low_byte (ch0-7), high_byte (ch8-15)] — LoRaWAN little-endian.
const AU915_SUBBAND2_MASK_CNTL: u8 = 0x00;
const AU915_SUBBAND2_MASK_BYTES: [u8; 2] = [0x00, 0xFF]; // ch8-15 enabled

const FPORT_WEATHER: u8 = 2;

/// `modem_e_response_code_t` OK value.
const MODEM_E_RC_OK: u8 = 0x00;

/// HAL status ERROR value (`MODEM_E_HAL_STATUS_ERROR = 3`).
const HAL_STATUS_ERROR: u8 = 3;

/// Event types from `modem_e_lorawan_event_type_t`.
const EVENT_RESET: u8 = 0x00;  // MODEM_E_LORAWAN_EVENT_RESET
const EVENT_JOINED: u8 = 0x02; // MODEM_E_LORAWAN_EVENT_JOINED
const EVENT_TX_DONE: u8 = 0x04; // MODEM_E_LORAWAN_EVENT_TX_DONE

/// `modem_e_uplink_type_t` unconfirmed.
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
    pub busy: PinDriver<'static, Input>,
    pub reset: PinDriver<'static, Output>,
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
        if ctx.busy.is_low() {
            return true;
        }
        FreeRtos::delay_ms(BUSY_POLL_INTERVAL_MS);
    }
    false
}

// ---------------------------------------------------------------------------
// HAL callbacks requeridas por SWDR009 (modem_e_hal.h)
// SAFETY: SWDR009 llama estas funciones desde el contexto de la tarea ESP32.
// ---------------------------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn modem_e_hal_write(
    _context: *const core::ffi::c_void,
    command: *const u8,
    command_length: u16,
    data: *const u8,
    data_length: u16,
) -> u8 {
    if HAL_CTX.is_null() {
        return HAL_STATUS_ERROR;
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
        return HAL_STATUS_ERROR;
    }
    if !wait_busy_low() {
        warn!("modem_e_hal_write: busy timeout");
        return HAL_STATUS_ERROR;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn modem_e_hal_read(
    _context: *const core::ffi::c_void,
    command: *const u8,
    command_length: u16,
    data: *mut u8,
    data_length: u16,
) -> u8 {
    if HAL_CTX.is_null() {
        return HAL_STATUS_ERROR;
    }
    let ctx = &mut *HAL_CTX;
    let cmd = core::slice::from_raw_parts(command, command_length as usize);

    // Enviar comando, esperar BUSY LOW, leer respuesta.
    if ctx.spi.write(cmd).is_err() {
        return HAL_STATUS_ERROR;
    }
    if !wait_busy_low() {
        warn!("modem_e_hal_read: busy timeout after command");
        return HAL_STATUS_ERROR;
    }
    let rx = core::slice::from_raw_parts_mut(data, data_length as usize);
    if ctx.spi.read(rx).is_err() {
        return HAL_STATUS_ERROR;
    }
    0
}

/// Solo requerido por `modem_e_system_get_status`. Escribe NOP (0x00) mientras lee.
#[no_mangle]
pub unsafe extern "C" fn modem_e_hal_write_read(
    _context: *const core::ffi::c_void,
    command: *const u8,
    data: *mut u8,
    length: u16,
) -> u8 {
    if HAL_CTX.is_null() {
        return HAL_STATUS_ERROR;
    }
    let ctx = &mut *HAL_CTX;
    let mut buf: Vec<u8> = core::slice::from_raw_parts(command, length as usize).to_vec();
    if ctx.spi.transfer_in_place(&mut buf).is_err() {
        return HAL_STATUS_ERROR;
    }
    core::slice::from_raw_parts_mut(data, length as usize).copy_from_slice(&buf);
    0
}

/// Solo requerido por `modem_e_bootloader_get_status`. Lee enviando NOP bytes.
#[no_mangle]
pub unsafe extern "C" fn modem_e_hal_direct_read(
    _context: *const core::ffi::c_void,
    data: *mut u8,
    data_length: u16,
) -> u8 {
    if HAL_CTX.is_null() {
        return HAL_STATUS_ERROR;
    }
    let ctx = &mut *HAL_CTX;
    let rx = core::slice::from_raw_parts_mut(data, data_length as usize);
    if ctx.spi.read(rx).is_err() {
        return HAL_STATUS_ERROR;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn modem_e_hal_reset(
    _context: *const core::ffi::c_void,
) -> u8 {
    if HAL_CTX.is_null() {
        return HAL_STATUS_ERROR;
    }
    let ctx = &mut *HAL_CTX;
    let _ = ctx.reset.set_low();
    FreeRtos::delay_ms(10);
    let _ = ctx.reset.set_high();
    FreeRtos::delay_ms(20); // Modem-E boot time
    0
}

#[no_mangle]
pub unsafe extern "C" fn modem_e_hal_wakeup(
    _context: *const core::ffi::c_void,
) -> u8 {
    // LR1121 wakeup: toggle NSS briefly. esp-idf-hal SPI handles NSS automatically;
    // send a zero-length transaction to pulse NSS.
    if HAL_CTX.is_null() {
        return HAL_STATUS_ERROR;
    }
    let ctx = &mut *HAL_CTX;
    let _ = ctx.spi.write(&[]);
    FreeRtos::delay_ms(1);
    0
}

// ---------------------------------------------------------------------------
// FFI types matching SWDR009 structs
// ---------------------------------------------------------------------------

/// `modem_e_version_t` from modem_e_modem_types.h.
#[repr(C)]
#[derive(Default, Debug)]
pub struct ModemEVersion {
    pub use_case: u8,    // always 5 for Modem-E
    pub modem_major: u8,
    pub modem_minor: u8,
    pub modem_patch: u8,
    pub lbm_major: u8,
    pub lbm_minor: u8,
    pub lbm_patch: u8,
}

/// `modem_e_event_fields_t` from modem_e_modem_types.h.
#[repr(C)]
#[derive(Default, Debug)]
pub struct ModemEEventFields {
    pub event_type: u8,           // modem_e_lorawan_event_type_t
    pub missed_events_count: u8,
}

/// `modem_e_channel_mask_configuration_t` from modem_e_lorawan_types.h.
#[repr(C)]
pub struct ModemEChannelMaskConfig {
    pub channel_mask_control: u8,
    pub channel_mask: [u8; 2],
}

// ---------------------------------------------------------------------------
// extern "C" — funciones del SDK SWDR009 que llamamos desde Rust
// ---------------------------------------------------------------------------

extern "C" {
    fn modem_e_get_modem_version(
        context: *const core::ffi::c_void,
        version: *mut ModemEVersion,
    ) -> u8; // modem_e_response_code_t

    fn modem_e_set_region(
        context: *const core::ffi::c_void,
        region: u8, // modem_e_regions_t
    ) -> u8;

    /// Configure channel mask. Pass 1 configuration entry for sub-band selection.
    fn modem_e_connect_set_channel_mask(
        context: *const core::ffi::c_void,
        channel_configuration: *const ModemEChannelMaskConfig,
        n_channel_configurations: u8,
    ) -> u8;

    fn modem_e_set_otaa_dev_eui(
        context: *const core::ffi::c_void,
        dev_eui: *const u8, // modem_e_otaa_dev_eui_t = uint8_t[8]
    ) -> u8;

    fn modem_e_set_otaa_join_eui(
        context: *const core::ffi::c_void,
        join_eui: *const u8, // modem_e_otaa_join_eui_t = uint8_t[8]
    ) -> u8;

    // AppKey in LoRaWAN 1.0.4 maps to NwkKey in Modem-E API (see modem_e_lorawan.h note).
    fn modem_e_set_otaa_nwk_key(
        context: *const core::ffi::c_void,
        nwk_key: *const u8, // modem_e_otaa_nwk_key_t = uint8_t[16]
    ) -> u8;

    fn modem_e_join(context: *const core::ffi::c_void) -> u8;

    fn modem_e_request_tx(
        context: *const core::ffi::c_void,
        port: u8,
        uplink_type: u8, // modem_e_uplink_type_t
        data: *const u8,
        data_length: u8,
    ) -> u8;

    fn modem_e_get_event(
        context: *const core::ffi::c_void,
        event_fields: *mut ModemEEventFields,
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
    dio1: PinDriver<'static, Input>,
    _ctx: Box<HalCtx>,
}

impl ModemE {
    /// Inicializa el driver y verifica que el chip corre Modem-E (use_case == 5).
    pub fn new(
        spi: SpiDeviceDriver<'static, SpiDriver<'static>>,
        busy: PinDriver<'static, Input>,
        reset: PinDriver<'static, Output>,
        dio1: PinDriver<'static, Input>,
    ) -> Result<Self, ModemEError> {
        let ctx = Box::new(HalCtx { spi, busy, reset });
        // SAFETY: single-threaded ESP32 firmware; pointer is valid for the duration of ModemE.
        unsafe { HAL_CTX = &*ctx as *const HalCtx as *mut HalCtx; }

        let mut version = ModemEVersion::default();
        let rc = unsafe { modem_e_get_modem_version(HAL_CTX as *const _, &mut version) };
        if rc != MODEM_E_RC_OK {
            return Err(ModemEError::CommandFailed(rc));
        }
        info!(
            "modem_e_ok use_case={} fw={}.{}.{} lbm={}.{}.{}",
            version.use_case,
            version.modem_major, version.modem_minor, version.modem_patch,
            version.lbm_major, version.lbm_minor, version.lbm_patch,
        );

        Ok(ModemE { dio1, _ctx: ctx })
    }

    /// Configura región AU915 sub-band 2 y carga credenciales OTAA.
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
        let rc = unsafe { modem_e_set_region(HAL_CTX as *const _, region as u8) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_channel_mask_subband2(&mut self) -> Result<(), ModemEError> {
        let config = ModemEChannelMaskConfig {
            channel_mask_control: AU915_SUBBAND2_MASK_CNTL,
            channel_mask: AU915_SUBBAND2_MASK_BYTES,
        };
        let rc = unsafe {
            modem_e_connect_set_channel_mask(HAL_CTX as *const _, &config, 1)
        };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_dev_eui(&mut self, eui: &[u8; 8]) -> Result<(), ModemEError> {
        let rc = unsafe { modem_e_set_otaa_dev_eui(HAL_CTX as *const _, eui.as_ptr()) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_join_eui(&mut self, eui: &[u8; 8]) -> Result<(), ModemEError> {
        let rc = unsafe { modem_e_set_otaa_join_eui(HAL_CTX as *const _, eui.as_ptr()) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    fn set_app_key(&mut self, key: &[u8; 16]) -> Result<(), ModemEError> {
        // AppKey (LoRaWAN 1.0.4) = NwkKey in Modem-E API (see modem_e_lorawan.h).
        let rc = unsafe { modem_e_set_otaa_nwk_key(HAL_CTX as *const _, key.as_ptr()) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        Ok(())
    }

    /// Join OTAA. Bloquea hasta evento JOINED en DIO1 o timeout_ms.
    pub fn join(&mut self, timeout_ms: u32) -> Result<(), ModemEError> {
        info!("modem_e_join_start timeout_ms={}", timeout_ms);
        let rc = unsafe { modem_e_join(HAL_CTX as *const _) };
        if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }
        self.wait_event(timeout_ms, EVENT_JOINED)
    }

    /// Envía uplink no confirmado. Bloquea hasta TX_DONE o timeout.
    pub fn request_uplink(&mut self, payload: &[u8]) -> Result<(), ModemEError> {
        if payload.len() > 255 { return Err(ModemEError::PayloadTooLarge); }
        debug!("modem_e_uplink_start len={}", payload.len());
        let rc = unsafe {
            modem_e_request_tx(
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

            if self.dio1.is_high() {
                let mut ev = ModemEEventFields::default();
                let rc = unsafe { modem_e_get_event(HAL_CTX as *const _, &mut ev) };
                if rc != MODEM_E_RC_OK { return Err(ModemEError::CommandFailed(rc)); }

                if ev.event_type == EVENT_RESET {
                    error!("modem_e_reset_event — chip reiniciado inesperadamente");
                    return Err(ModemEError::CommandFailed(EVENT_RESET));
                }
                if ev.event_type == expected {
                    debug!("modem_e_event_ok type=0x{:02x}", expected);
                    return Ok(());
                }
                error!("modem_e_event_unexpected got=0x{:02x} expected=0x{:02x}", ev.event_type, expected);
                return Err(ModemEError::UnexpectedEvent { got: ev.event_type, expected });
            }

            if elapsed >= timeout_ms {
                error!("modem_e_event_timeout expected=0x{:02x} after_ms={}", expected, elapsed);
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
