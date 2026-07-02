use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GatewayConfig {
    pub dev_eui: String,
    pub app_eui: String,
    pub app_key: String,
    pub host: String,
    pub interval_secs: u64,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            dev_eui: String::new(),
            app_eui: String::new(),
            app_key: String::new(),
            host: "localhost:1700".to_string(),
            interval_secs: 30,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GatewayStatus {
    Stopped,
    Connecting,
    Running,
    Error(String),
}

pub struct GatewayState {
    pub status: GatewayStatus,
    pub cancellation_token: Option<CancellationToken>,
}

impl Default for GatewayState {
    fn default() -> Self {
        Self {
            status: GatewayStatus::Stopped,
            cancellation_token: None,
        }
    }
}

pub struct AppState {
    pub gateway: Mutex<GatewayState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            gateway: Mutex::new(GatewayState::default()),
        }
    }
}
