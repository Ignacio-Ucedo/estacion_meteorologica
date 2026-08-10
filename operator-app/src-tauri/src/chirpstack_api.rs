// ChirpStack v4 API client via gRPC-web (HTTP/1.1 + binary protobuf frames).
// Uses prost for message encoding/decoding; no proto files or tonic-build needed.
// Field numbers verified against chirpstack_api Python package 4.18.0.

use reqwest::Client;

// ── gRPC-web transport ────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum GrpcError {
    Code(u32, String),
    Internal(String),
}

impl GrpcError {
    pub fn is_not_found(&self) -> bool {
        matches!(self, GrpcError::Code(5, _))
    }
    pub fn is_already_exists(&self) -> bool {
        matches!(self, GrpcError::Code(6, _))
    }
    pub fn to_string_lossy(&self) -> String {
        match self {
            GrpcError::Code(c, m) => {
                let label = match *c {
                    5 => "NotFound",
                    6 => "AlreadyExists",
                    16 => "Unauthenticated",
                    7 => "PermissionDenied",
                    _ => "gRPC",
                };
                format!("{label}: {m}")
            }
            GrpcError::Internal(m) => m.clone(),
        }
    }
}

impl From<GrpcError> for String {
    fn from(e: GrpcError) -> Self {
        e.to_string_lossy()
    }
}

/// Makes a unary gRPC-web call (HTTP/1.1, binary proto, no HTTP/2 needed).
async fn grpc_call<Req, Resp>(
    client: &Client,
    host: &str,
    token: &str,
    method: &str,
    req: Req,
) -> Result<Resp, GrpcError>
where
    Req: prost::Message,
    Resp: prost::Message + Default,
{
    // Encode request protobuf
    let mut req_bytes = Vec::new();
    req.encode(&mut req_bytes)
        .map_err(|e| GrpcError::Internal(format!("encode: {e}")))?;

    // gRPC-web data frame: [0x00][len_u32_be][proto bytes]
    let mut frame = Vec::with_capacity(5 + req_bytes.len());
    frame.push(0x00u8);
    frame.extend_from_slice(&(req_bytes.len() as u32).to_be_bytes());
    frame.extend_from_slice(&req_bytes);

    let http_resp = client
        .post(format!("{}{}", host.trim_end_matches('/'), method))
        .header("content-type", "application/grpc-web+proto")
        .header("x-grpc-web", "1")
        .header("accept", "application/grpc-web+proto")
        .header("authorization", format!("Bearer {token}"))
        .body(frame)
        .send()
        .await
        .map_err(|e| GrpcError::Internal(format!("HTTP request: {e}")))?;

    if !http_resp.status().is_success() {
        return Err(GrpcError::Internal(format!("HTTP {}", http_resp.status())));
    }

    let body = http_resp
        .bytes()
        .await
        .map_err(|e| GrpcError::Internal(e.to_string()))?;

    // Parse gRPC-web frames from the response body.
    let mut pos = 0;
    let mut result = Resp::default();

    while pos + 5 <= body.len() {
        let flags = body[pos];
        let frame_len =
            u32::from_be_bytes([body[pos + 1], body[pos + 2], body[pos + 3], body[pos + 4]])
                as usize;
        pos += 5;

        let end = pos + frame_len;
        if end > body.len() {
            break;
        }
        let frame_data = &body[pos..end];
        pos = end;

        if flags & 0x80 != 0 {
            // Trailer frame: "grpc-status: N\r\ngrpc-message: ...\r\n"
            let trailer = std::str::from_utf8(frame_data).unwrap_or("");
            let status_code = trailer
                .lines()
                .find_map(|l| l.strip_prefix("grpc-status:").map(|s| s.trim()))
                .unwrap_or("0");
            if status_code != "0" {
                let msg = trailer
                    .lines()
                    .find_map(|l| l.strip_prefix("grpc-message:").map(|s| s.trim()))
                    .unwrap_or("gRPC error");
                let code: u32 = status_code.parse().unwrap_or(2);
                return Err(GrpcError::Code(code, msg.to_string()));
            }
        } else {
            // Data frame: binary protobuf
            result = Resp::decode(frame_data)
                .map_err(|e| GrpcError::Internal(format!("decode: {e}")))?;
        }
    }

    Ok(result)
}

// ── Protobuf message types (private) ─────────────────────────────────────────
mod proto {
    // prost::Message derive generates Default + prost::Message impls.
    // Do NOT also derive Default — it would conflict.

    #[derive(prost::Message)]
    pub struct ListTenantsRequest {
        #[prost(uint32, tag = "1")]
        pub limit: u32,
    }

    #[derive(prost::Message)]
    pub struct TenantListItem {
        #[prost(string, tag = "1")]
        pub id: String,
        // tag 2 = created_at (Timestamp) — skipped
        // tag 3 = updated_at (Timestamp) — skipped
        #[prost(string, tag = "4")]
        pub name: String,
    }

    #[derive(prost::Message)]
    pub struct ListTenantsResponse {
        #[prost(uint32, tag = "1")]
        pub total_count: u32,
        #[prost(message, repeated, tag = "2")]
        pub result: Vec<TenantListItem>,
    }

    #[derive(prost::Message)]
    pub struct ListApplicationsRequest {
        #[prost(uint32, tag = "1")]
        pub limit: u32,
        #[prost(uint64, tag = "2")]
        pub offset: u64,
        #[prost(string, tag = "3")]
        pub search: String,
        #[prost(string, tag = "4")]
        pub tenant_id: String,
    }

    #[derive(prost::Message)]
    pub struct ApplicationListItem {
        #[prost(string, tag = "1")]
        pub id: String,
        // tag 2 = created_at, 3 = updated_at — skipped
        #[prost(string, tag = "4")]
        pub name: String,
    }

    #[derive(prost::Message)]
    pub struct ListApplicationsResponse {
        #[prost(uint32, tag = "1")]
        pub total_count: u32,
        #[prost(message, repeated, tag = "2")]
        pub result: Vec<ApplicationListItem>,
    }

    #[derive(prost::Message)]
    pub struct AppMsg {
        #[prost(string, tag = "1")]
        pub id: String,
        #[prost(string, tag = "2")]
        pub name: String,
        #[prost(string, tag = "3")]
        pub description: String,
        #[prost(string, tag = "4")]
        pub tenant_id: String,
    }

    #[derive(prost::Message)]
    pub struct CreateApplicationRequest {
        #[prost(message, optional, tag = "1")]
        pub application: Option<AppMsg>,
    }

    #[derive(prost::Message)]
    pub struct CreateApplicationResponse {
        #[prost(string, tag = "1")]
        pub id: String,
    }

    #[derive(prost::Message)]
    pub struct ListDeviceProfilesRequest {
        #[prost(uint32, tag = "1")]
        pub limit: u32,
        #[prost(uint64, tag = "2")]
        pub offset: u64,
        #[prost(string, tag = "3")]
        pub search: String,
        #[prost(string, tag = "4")]
        pub tenant_id: String,
    }

    #[derive(prost::Message)]
    pub struct DeviceProfileListItem {
        #[prost(string, tag = "1")]
        pub id: String,
        // tag 2 = created_at, 3 = updated_at — skipped
        #[prost(string, tag = "4")]
        pub name: String,
    }

    #[derive(prost::Message)]
    pub struct ListDeviceProfilesResponse {
        #[prost(uint32, tag = "1")]
        pub total_count: u32,
        #[prost(message, repeated, tag = "2")]
        pub result: Vec<DeviceProfileListItem>,
    }

    #[derive(prost::Message)]
    pub struct DeviceProfileMsg {
        #[prost(string, tag = "1")]
        pub id: String,
        #[prost(string, tag = "2")]
        pub tenant_id: String,
        #[prost(string, tag = "3")]
        pub name: String,
        #[prost(int32, tag = "4")]
        pub region: i32, // AU915 = 5
        #[prost(int32, tag = "5")]
        pub mac_version: i32, // LORAWAN_1_0_4 = 4
        #[prost(int32, tag = "6")]
        pub reg_params_revision: i32, // RP002_1_0_3 = 5
        #[prost(string, tag = "7")]
        pub adr_algorithm_id: String,
        #[prost(uint32, tag = "11")]
        pub uplink_interval: u32,
        #[prost(bool, tag = "13")]
        pub supports_otaa: bool,
    }

    #[derive(prost::Message)]
    pub struct CreateDeviceProfileRequest {
        #[prost(message, optional, tag = "1")]
        pub device_profile: Option<DeviceProfileMsg>,
    }

    #[derive(prost::Message)]
    pub struct CreateDeviceProfileResponse {
        #[prost(string, tag = "1")]
        pub id: String,
    }

    #[derive(prost::Message, Clone)]
    pub struct DeviceMsg {
        #[prost(string, tag = "1")]
        pub dev_eui: String,
        #[prost(string, tag = "2")]
        pub name: String,
        #[prost(string, tag = "3")]
        pub description: String,
        #[prost(string, tag = "4")]
        pub application_id: String,
        #[prost(string, tag = "5")]
        pub device_profile_id: String,
        #[prost(bool, tag = "6")]
        pub skip_fcnt_check: bool,
        #[prost(bool, tag = "7")]
        pub is_disabled: bool,
    }

    #[derive(prost::Message)]
    pub struct GetDeviceResponse {
        #[prost(message, optional, tag = "1")]
        pub device: Option<DeviceMsg>,
    }

    #[derive(prost::Message)]
    pub struct GetDeviceRequest {
        #[prost(string, tag = "1")]
        pub dev_eui: String,
    }

    #[derive(prost::Message)]
    pub struct CreateDeviceRequest {
        #[prost(message, optional, tag = "1")]
        pub device: Option<DeviceMsg>,
    }

    #[derive(prost::Message)]
    pub struct UpdateDeviceRequest {
        #[prost(message, optional, tag = "1")]
        pub device: Option<DeviceMsg>,
    }

    #[derive(prost::Message, Clone)]
    pub struct DeviceKeys {
        #[prost(string, tag = "1")]
        pub dev_eui: String,
        #[prost(string, tag = "2")]
        pub nwk_key: String,
        #[prost(string, tag = "3")]
        pub app_key: String,
    }

    #[derive(prost::Message)]
    pub struct CreateDeviceKeysRequest {
        #[prost(message, optional, tag = "1")]
        pub device_keys: Option<DeviceKeys>,
    }

    #[derive(prost::Message)]
    pub struct UpdateDeviceKeysRequest {
        #[prost(message, optional, tag = "1")]
        pub device_keys: Option<DeviceKeys>,
    }

    #[derive(prost::Message)]
    pub struct DeactivateDeviceRequest {
        #[prost(string, tag = "1")]
        pub dev_eui: String,
    }

    #[derive(prost::Message, Clone)]
    pub struct GatewayMsg {
        #[prost(string, tag = "1")]
        pub gateway_id: String,
        #[prost(string, tag = "2")]
        pub name: String,
        #[prost(string, tag = "3")]
        pub description: String,
        // tag 4 = location (skipped)
        #[prost(string, tag = "5")]
        pub tenant_id: String,
    }

    #[derive(prost::Message)]
    pub struct CreateGatewayRequest {
        #[prost(message, optional, tag = "1")]
        pub gateway: Option<GatewayMsg>,
    }

    // Empty response for Create/Update/Delete methods that return google.protobuf.Empty
    #[derive(prost::Message)]
    pub struct Empty {}
}

// ── Auto-descubrimiento de host ChirpStack ────────────────────────────────────

pub fn get_local_ipv4() -> Option<std::net::Ipv4Addr> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        std::net::IpAddr::V4(ip) => Some(ip),
        _ => None,
    }
}

pub async fn discover_host() -> Option<String> {
    // Probar localhost primero (Docker en la misma máquina)
    if let Some(host) = probe_chirpstack(std::net::Ipv4Addr::new(127, 0, 0, 1)).await {
        return Some(host);
    }

    let local_ip = get_local_ipv4()?;
    let [a, b, c, _] = local_ip.octets();

    let mut set = tokio::task::JoinSet::new();
    for i in 1u8..=254 {
        let ip = std::net::Ipv4Addr::new(a, b, c, i);
        set.spawn(probe_chirpstack(ip));
    }

    while let Some(res) = set.join_next().await {
        if let Ok(Some(host)) = res {
            set.abort_all();
            return Some(host);
        }
    }
    None
}

/// Determina si `ip:8080` es ChirpStack v4: TCP probe + comprueba que `/` devuelve HTML.
async fn probe_chirpstack(ip: std::net::Ipv4Addr) -> Option<String> {
    use tokio::net::TcpStream;
    use tokio::time::{Duration, timeout};

    let Ok(Ok(_)) = timeout(
        Duration::from_millis(250),
        TcpStream::connect(format!("{ip}:8080")),
    )
    .await
    else {
        return None;
    };

    // ChirpStack v4 sirve su SPA en /; verificamos que responda con HTML.
    let client = Client::builder()
        .timeout(std::time::Duration::from_millis(800))
        .build()
        .ok()?;
    let resp = client
        .get(format!("http://{ip}:8080/"))
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let text = resp.text().await.ok()?;
    if text.to_lowercase().contains("chirpstack") || text.contains("<html") {
        Some(format!("http://{ip}:8080"))
    } else {
        None
    }
}

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChirpstackCreds {
    pub host: String,
    pub api_token: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Application {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeviceProfile {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Tenant {
    pub id: String,
    pub name: String,
}

impl ChirpstackCreds {
    fn client(&self) -> Client {
        Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap_or_default()
    }
}

// ── API functions ─────────────────────────────────────────────────────────────

pub async fn list_tenants(creds: &ChirpstackCreds) -> Result<Vec<Tenant>, String> {
    let resp: proto::ListTenantsResponse = grpc_call(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.TenantService/List",
        proto::ListTenantsRequest { limit: 100 },
    )
    .await
    .map_err(|e| e.to_string_lossy())?;

    Ok(resp
        .result
        .into_iter()
        .map(|t| Tenant { id: t.id, name: t.name })
        .collect())
}

pub async fn list_applications(
    creds: &ChirpstackCreds,
    tenant_id: &str,
) -> Result<Vec<Application>, String> {
    let resp: proto::ListApplicationsResponse = grpc_call(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.ApplicationService/List",
        proto::ListApplicationsRequest {
            limit: 100,
            offset: 0,
            search: String::new(),
            tenant_id: tenant_id.to_string(),
        },
    )
    .await
    .map_err(|e| e.to_string_lossy())?;

    Ok(resp
        .result
        .into_iter()
        .map(|a| Application { id: a.id, name: a.name })
        .collect())
}

pub async fn list_device_profiles(
    creds: &ChirpstackCreds,
    tenant_id: &str,
) -> Result<Vec<DeviceProfile>, String> {
    let resp: proto::ListDeviceProfilesResponse = grpc_call(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.DeviceProfileService/List",
        proto::ListDeviceProfilesRequest {
            limit: 100,
            offset: 0,
            search: String::new(),
            tenant_id: tenant_id.to_string(),
        },
    )
    .await
    .map_err(|e| e.to_string_lossy())?;

    Ok(resp
        .result
        .into_iter()
        .map(|p| DeviceProfile { id: p.id, name: p.name })
        .collect())
}

pub async fn create_application(
    creds: &ChirpstackCreds,
    tenant_id: &str,
    name: &str,
) -> Result<String, String> {
    match grpc_call::<_, proto::CreateApplicationResponse>(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.ApplicationService/Create",
        proto::CreateApplicationRequest {
            application: Some(proto::AppMsg {
                id: String::new(),
                name: name.to_string(),
                description: String::new(),
                tenant_id: tenant_id.to_string(),
            }),
        },
    )
    .await
    {
        Ok(r) => Ok(r.id),
        Err(e) if e.is_already_exists() => {
            let apps = list_applications(creds, tenant_id).await?;
            apps.into_iter()
                .find(|a| a.name == name)
                .map(|a| a.id)
                .ok_or_else(|| format!("Aplicación '{name}' ya existía pero no se encontró"))
        }
        Err(e) => Err(e.to_string_lossy()),
    }
}

pub async fn create_device_profile(
    creds: &ChirpstackCreds,
    tenant_id: &str,
    name: &str,
) -> Result<String, String> {
    match grpc_call::<_, proto::CreateDeviceProfileResponse>(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.DeviceProfileService/Create",
        proto::CreateDeviceProfileRequest {
            device_profile: Some(proto::DeviceProfileMsg {
                id: String::new(),
                tenant_id: tenant_id.to_string(),
                name: name.to_string(),
                region: 5,              // AU915
                mac_version: 4,         // LORAWAN_1_0_4
                reg_params_revision: 5, // RP002_1_0_3
                adr_algorithm_id: "default".to_string(),
                uplink_interval: 3600,
                supports_otaa: true,
            }),
        },
    )
    .await
    {
        Ok(r) => Ok(r.id),
        Err(e) if e.is_already_exists() => {
            let profiles = list_device_profiles(creds, tenant_id).await?;
            profiles
                .into_iter()
                .find(|p| p.name == name)
                .map(|p| p.id)
                .ok_or_else(|| format!("Perfil '{name}' ya existía pero no se encontró"))
        }
        Err(e) => Err(e.to_string_lossy()),
    }
}

pub async fn device_exists(creds: &ChirpstackCreds, dev_eui: &str) -> Result<bool, String> {
    match grpc_call::<_, proto::GetDeviceResponse>(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.DeviceService/Get",
        proto::GetDeviceRequest {
            dev_eui: dev_eui.to_string(),
        },
    )
    .await
    {
        Ok(_) => Ok(true),
        Err(e) if e.is_not_found() => Ok(false),
        Err(e) => Err(e.to_string_lossy()),
    }
}

pub async fn create_or_update_device(
    creds: &ChirpstackCreds,
    dev_eui: &str,
    app_id: &str,
    profile_id: &str,
) -> Result<bool, String> {
    let device = proto::DeviceMsg {
        dev_eui: dev_eui.to_string(),
        name: format!("nodo-{}", &dev_eui[..8.min(dev_eui.len())]),
        description: "Nodo meteorológico".to_string(),
        application_id: app_id.to_string(),
        device_profile_id: profile_id.to_string(),
        skip_fcnt_check: false,
        is_disabled: false,
    };

    let exists = device_exists(creds, dev_eui).await?;

    if exists {
        grpc_call::<_, proto::Empty>(
            &creds.client(),
            &creds.host,
            &creds.api_token,
            "/api.DeviceService/Update",
            proto::UpdateDeviceRequest {
                device: Some(device),
            },
        )
        .await
        .map_err(|e| e.to_string_lossy())?;
        Ok(true)
    } else {
        grpc_call::<_, proto::Empty>(
            &creds.client(),
            &creds.host,
            &creds.api_token,
            "/api.DeviceService/Create",
            proto::CreateDeviceRequest {
                device: Some(device),
            },
        )
        .await
        .map_err(|e| e.to_string_lossy())?;
        Ok(false)
    }
}

pub async fn set_device_keys(
    creds: &ChirpstackCreds,
    dev_eui: &str,
    app_key: &str,
) -> Result<(), String> {
    let keys = proto::DeviceKeys {
        dev_eui: dev_eui.to_string(),
        nwk_key: app_key.to_string(), // LoRaWAN 1.0.x: single root key in nwkKey
        app_key: String::new(),
    };

    // Try create; if it fails with AlreadyExists, update.
    match grpc_call::<_, proto::Empty>(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.DeviceService/CreateKeys",
        proto::CreateDeviceKeysRequest {
            device_keys: Some(keys.clone()),
        },
    )
    .await
    {
        Ok(_) => Ok(()),
        Err(e) if e.is_already_exists() => grpc_call::<_, proto::Empty>(
            &creds.client(),
            &creds.host,
            &creds.api_token,
            "/api.DeviceService/UpdateKeys",
            proto::UpdateDeviceKeysRequest {
                device_keys: Some(keys),
            },
        )
        .await
        .map(|_| ())
        .map_err(|e| e.to_string_lossy()),
        Err(e) => Err(e.to_string_lossy()),
    }
}

pub async fn create_gateway(
    creds: &ChirpstackCreds,
    eui: &str,
    name: &str,
    tenant_id: &str,
) -> Result<(), String> {
    match grpc_call::<_, proto::Empty>(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.GatewayService/Create",
        proto::CreateGatewayRequest {
            gateway: Some(proto::GatewayMsg {
                gateway_id: eui.to_string(),
                name: name.to_string(),
                description: String::new(),
                tenant_id: tenant_id.to_string(),
            }),
        },
    )
    .await
    {
        Ok(_) => Ok(()),
        Err(e) if e.is_already_exists() => Ok(()), // idempotent
        Err(e) => Err(e.to_string_lossy()),
    }
}

pub async fn delete_device_activation(
    creds: &ChirpstackCreds,
    dev_eui: &str,
) -> Result<(), String> {
    // Deactivate resets the active OTAA session (FCnt, session keys).
    match grpc_call::<_, proto::Empty>(
        &creds.client(),
        &creds.host,
        &creds.api_token,
        "/api.DeviceService/Deactivate",
        proto::DeactivateDeviceRequest {
            dev_eui: dev_eui.to_string(),
        },
    )
    .await
    {
        Ok(_) => Ok(()),
        Err(e) if e.is_not_found() => Ok(()), // no active session — fine
        Err(e) => Err(e.to_string_lossy()),
    }
}
