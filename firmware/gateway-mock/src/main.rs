use std::{
    env,
    process,
    thread,
    time::{Duration, Instant},
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Utc;
use rand::Rng;
use rumqttc::{Client, MqttOptions, QoS};
use serde::Serialize;

const DEFAULT_BROKER: &str = "localhost:1883";
const DEFAULT_APP_ID: &str = "1";
const DEFAULT_DEV_EUI: &str = "0000000000000002";
const DEFAULT_DEVICE_ID: u8 = 2;
const DEFAULT_INTERVAL_SECONDS: u64 = 15;
const PAYLOAD_LEN: usize = 14;

#[derive(Debug, Clone)]
struct Config {
    broker: String,
    app_id: String,
    dev_eui: String,
    device_id: u8,
    interval: Duration,
    once: bool,
    start_seq: u16,
}

#[derive(Debug, Clone, Copy)]
struct Reading {
    seq: u16,
    temp_c: f32,
    humidity_pct: f32,
    rain_pulses: u16,
    wind_pulses: u16,
    battery_mv: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChirpstackUplink<'a> {
    deduplication_id: String,
    time: String,
    device_info: DeviceInfo<'a>,
    dev_addr: &'a str,
    adr: bool,
    dr: u8,
    f_cnt: u16,
    f_port: u8,
    confirmed: bool,
    data: String,
    rx_info: Vec<RxInfo<'a>>,
    tx_info: TxInfo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceInfo<'a> {
    application_id: &'a str,
    application_name: &'a str,
    device_profile_id: &'a str,
    device_profile_name: &'a str,
    device_name: &'a str,
    dev_eui: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RxInfo<'a> {
    gateway_id: &'a str,
    uplink_id: u16,
    rssi: i16,
    snr: f32,
    channel: u8,
}

#[derive(Debug, Serialize)]
struct TxInfo {
    frequency: u32,
    modulation: TxModulation,
}

#[derive(Debug, Serialize)]
struct TxModulation {
    lora: LoraModulation,
}

#[derive(Debug, Serialize)]
struct LoraModulation {
    bandwidth: u32,
    spreading_factor: u8,
    code_rate: String,
}

fn main() {
    let config = Config::from_env_and_args().unwrap_or_else(|err| {
        eprintln!("config_error={err}");
        eprintln!("{}", usage());
        process::exit(2);
    });

    let (host, port) = parse_broker(&config.broker).unwrap_or_else(|err| {
        eprintln!("broker_error={err}");
        process::exit(2);
    });

    let topic = format!(
        "application/{}/device/{}/event/up",
        config.app_id, config.dev_eui
    );

    let mut mqtt_options = MqttOptions::new("weather-gateway-mock", host, port);
    mqtt_options.set_keep_alive(Duration::from_secs(30));

    let (client, mut connection) = Client::new(mqtt_options, 10);
    let _connection_handle = thread::spawn(move || {
        for notification in connection.iter() {
            if let Err(err) = notification {
                eprintln!("mqtt_connection_error={err}");
                break;
            }
        }
    });

    println!(
        "gateway_mock_started broker={} topic={} device_id={} interval_seconds={} once={}",
        config.broker,
        topic,
        config.device_id,
        config.interval.as_secs(),
        config.once
    );

    let mut seq = config.start_seq;
    let started_at = Instant::now();

    loop {
        let reading = generate_reading(seq, started_at.elapsed(), config.device_id);
        let payload = build_payload(config.device_id, reading);
        let event = build_event(&config, reading, &payload);
        let json = serde_json::to_vec(&event).expect("serializing uplink event must not fail");

        if let Err(err) = client.publish(&topic, QoS::AtLeastOnce, false, json) {
            eprintln!("mqtt_publish_error seq={} error={err}", reading.seq);
        } else {
            println!(
                "mock_uplink seq={} temp_c={:.2} humidity_pct={:.2} rain_pulses={} wind_pulses={} battery_mv={} payload_hex={}",
                reading.seq,
                reading.temp_c,
                reading.humidity_pct,
                reading.rain_pulses,
                reading.wind_pulses,
                reading.battery_mv,
                to_hex(&payload)
            );
        }

        if config.once {
            thread::sleep(Duration::from_millis(500));
            break;
        }

        seq = seq.wrapping_add(1);
        thread::sleep(config.interval);
    }

    drop(client);
}

impl Config {
    fn from_env_and_args() -> Result<Self, String> {
        let mut config = Self {
            broker: env_value("GATEWAY_MOCK_MQTT_BROKER")
                .unwrap_or_else(|| DEFAULT_BROKER.to_string()),
            app_id: env_value("GATEWAY_MOCK_APP_ID")
                .or_else(|| env_value("CHIRPSTACK_APP_ID"))
                .unwrap_or_else(|| DEFAULT_APP_ID.to_string()),
            dev_eui: env_value("GATEWAY_MOCK_DEV_EUI")
                .unwrap_or_else(|| DEFAULT_DEV_EUI.to_string()),
            device_id: parse_env("GATEWAY_MOCK_DEVICE_ID")?.unwrap_or(DEFAULT_DEVICE_ID),
            interval: Duration::from_secs(
                parse_env("GATEWAY_MOCK_INTERVAL_SECONDS")?
                    .unwrap_or(DEFAULT_INTERVAL_SECONDS),
            ),
            once: parse_bool_env("GATEWAY_MOCK_ONCE")?.unwrap_or(false),
            start_seq: parse_env("GATEWAY_MOCK_START_SEQ")?.unwrap_or(0),
        };

        let mut args = env::args().skip(1);
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--broker" => config.broker = next_value(&mut args, "--broker")?,
                "--app-id" => config.app_id = next_value(&mut args, "--app-id")?,
                "--dev-eui" => config.dev_eui = next_value(&mut args, "--dev-eui")?,
                "--device-id" => {
                    config.device_id = next_value(&mut args, "--device-id")?
                        .parse()
                        .map_err(|_| "--device-id must be a u8".to_string())?
                }
                "--interval-seconds" => {
                    let seconds: u64 = next_value(&mut args, "--interval-seconds")?
                        .parse()
                        .map_err(|_| "--interval-seconds must be a positive integer".to_string())?;
                    config.interval = Duration::from_secs(seconds);
                }
                "--once" => config.once = true,
                "--start-seq" => {
                    config.start_seq = next_value(&mut args, "--start-seq")?
                        .parse()
                        .map_err(|_| "--start-seq must be a u16".to_string())?
                }
                "--help" | "-h" => {
                    println!("{}", usage());
                    process::exit(0);
                }
                unknown => return Err(format!("unknown argument: {unknown}")),
            }
        }

        if config.app_id.trim().is_empty() {
            return Err("app id cannot be empty".to_string());
        }
        if !is_hex_eui64(&config.dev_eui) {
            return Err("--dev-eui must be 16 hexadecimal characters".to_string());
        }
        if config.interval.is_zero() && !config.once {
            return Err("--interval-seconds must be greater than zero unless --once is used".to_string());
        }

        Ok(config)
    }
}

fn generate_reading(seq: u16, elapsed: Duration, device_id: u8) -> Reading {
    let minutes = elapsed.as_secs_f32() / 60.0;
    let cycle = (minutes / 60.0) * std::f32::consts::TAU;
    let mut rng = rand::thread_rng();

    let temp_c = 21.5 + cycle.sin() * 4.5 + rng.gen_range(-0.35..0.35);
    let humidity_pct = (62.0 - cycle.sin() * 12.0 + rng.gen_range(-1.5..1.5)).clamp(25.0, 95.0);
    let rain_pulses = if seq % 18 == 0 {
        rng.gen_range(1..=4)
    } else {
        0
    };
    let wind_pulses = (18.0 + cycle.cos() * 8.0 + rng.gen_range(0.0..6.0)).round() as u16;
    let battery_mv = 4100u16.saturating_sub(((seq as u32 + device_id as u32) / 12) as u16);

    Reading {
        seq,
        temp_c,
        humidity_pct,
        rain_pulses,
        wind_pulses,
        battery_mv,
    }
}

fn build_payload(device_id: u8, reading: Reading) -> [u8; PAYLOAD_LEN] {
    let mut payload = [0u8; PAYLOAD_LEN];
    let temp_x100 = (reading.temp_c * 100.0).round() as i16;
    let humidity_x100 = (reading.humidity_pct * 100.0).round() as u16;

    payload[0] = device_id;
    payload[1..3].copy_from_slice(&reading.seq.to_le_bytes());
    payload[3..5].copy_from_slice(&temp_x100.to_le_bytes());
    payload[5..7].copy_from_slice(&humidity_x100.to_le_bytes());
    payload[7..9].copy_from_slice(&reading.rain_pulses.to_le_bytes());
    payload[9..11].copy_from_slice(&reading.wind_pulses.to_le_bytes());
    payload[11..13].copy_from_slice(&reading.battery_mv.to_le_bytes());
    payload[13] = crc8_maxim(&payload[..13]);

    payload
}

fn build_event<'a>(
    config: &'a Config,
    reading: Reading,
    payload: &[u8; PAYLOAD_LEN],
) -> ChirpstackUplink<'a> {
    ChirpstackUplink {
        deduplication_id: format!("gateway-mock-{}-{}", config.dev_eui, reading.seq),
        time: Utc::now().to_rfc3339(),
        device_info: DeviceInfo {
            application_id: &config.app_id,
            application_name: "weather-station",
            device_profile_id: "gateway-mock-profile",
            device_profile_name: "gateway-mock-eu433",
            device_name: "gateway-mock-synthetic",
            dev_eui: &config.dev_eui,
        },
        dev_addr: "00000000",
        adr: false,
        dr: 5,
        f_cnt: reading.seq,
        f_port: 1,
        confirmed: false,
        data: STANDARD.encode(payload),
        rx_info: vec![RxInfo {
            gateway_id: "gateway-mock",
            uplink_id: reading.seq,
            rssi: -57,
            snr: 9.5,
            channel: 0,
        }],
        tx_info: TxInfo {
            frequency: 433_175_000,
            modulation: TxModulation {
                lora: LoraModulation {
                    bandwidth: 125_000,
                    spreading_factor: 7,
                    code_rate: "CR_4_5".to_string(),
                },
            },
        },
    }
}

fn crc8_maxim(data: &[u8]) -> u8 {
    let mut crc = 0u8;
    for byte in data {
        crc ^= byte;
        for _ in 0..8 {
            if crc & 0x01 != 0 {
                crc = (crc >> 1) ^ 0x31;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

fn parse_broker(broker: &str) -> Result<(&str, u16), String> {
    let (host, port) = broker
        .rsplit_once(':')
        .ok_or_else(|| "broker must use host:port format".to_string())?;
    let port = port
        .parse()
        .map_err(|_| "broker port must be a valid u16".to_string())?;
    if host.trim().is_empty() {
        return Err("broker host cannot be empty".to_string());
    }
    Ok((host, port))
}

fn is_hex_eui64(value: &str) -> bool {
    value.len() == 16 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn env_value(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn parse_env<T>(name: &str) -> Result<Option<T>, String>
where
    T: std::str::FromStr,
{
    env_value(name)
        .map(|value| value.parse().map_err(|_| format!("{name} is invalid")))
        .transpose()
}

fn parse_bool_env(name: &str) -> Result<Option<bool>, String> {
    env_value(name)
        .map(|value| match value.to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "y" => Ok(true),
            "0" | "false" | "no" | "n" => Ok(false),
            _ => Err(format!("{name} must be true or false")),
        })
        .transpose()
}

fn next_value(args: &mut impl Iterator<Item = String>, flag: &str) -> Result<String, String> {
    args.next()
        .ok_or_else(|| format!("{flag} expects a value"))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn usage() -> &'static str {
    "usage: cargo run -- [--broker host:port] [--app-id id] [--dev-eui hex16] [--device-id u8] [--interval-seconds n] [--start-seq n] [--once]"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_backend_compatible_binary_payload() {
        let payload = build_payload(
            2,
            Reading {
                seq: 7,
                temp_c: 23.45,
                humidity_pct: 56.78,
                rain_pulses: 3,
                wind_pulses: 12,
                battery_mv: 4100,
            },
        );

        assert_eq!(to_hex(&payload), "02070029092e1603000c0004102e");
    }

    #[test]
    fn chirpstack_event_contains_backend_fields() {
        let config = Config {
            broker: DEFAULT_BROKER.to_string(),
            app_id: "1".to_string(),
            dev_eui: DEFAULT_DEV_EUI.to_string(),
            device_id: 2,
            interval: Duration::from_secs(10),
            once: true,
            start_seq: 0,
        };
        let reading = Reading {
            seq: 1,
            temp_c: 20.0,
            humidity_pct: 50.0,
            rain_pulses: 0,
            wind_pulses: 8,
            battery_mv: 4095,
        };
        let payload = build_payload(config.device_id, reading);
        let json = serde_json::to_value(build_event(&config, reading, &payload)).unwrap();

        assert_eq!(json["deviceInfo"]["devEui"], DEFAULT_DEV_EUI);
        assert_eq!(json["data"], STANDARD.encode(payload));
        assert!(json["time"].as_str().unwrap().contains('T'));
    }
}
