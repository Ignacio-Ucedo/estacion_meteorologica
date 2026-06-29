use core::sync::atomic::{AtomicU32, Ordering};

#[derive(Debug, Default)]
pub struct PulseCounters {
    rain: AtomicU32,
    wind: AtomicU32,
}

#[derive(Debug, Clone, Copy)]
pub struct PulseSnapshot {
    pub rain_pulses: u32,
    pub wind_pulses: u32,
}

impl PulseCounters {
    pub const fn new() -> Self {
        Self {
            rain: AtomicU32::new(0),
            wind: AtomicU32::new(0),
        }
    }

    pub fn record_rain_pulse(&self) {
        self.rain.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_wind_pulse(&self) {
        self.wind.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot_and_reset(&self) -> PulseSnapshot {
        PulseSnapshot {
            rain_pulses: self.rain.swap(0, Ordering::AcqRel),
            wind_pulses: self.wind.swap(0, Ordering::AcqRel),
        }
    }
}
