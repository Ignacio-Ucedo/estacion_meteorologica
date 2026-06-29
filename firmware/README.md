# Firmware — Estación Meteorológica

Rust + ESP-IDF firmware para dos ESP32 DevKitC V1: nodo sensor y gateway LoRaWAN.

## Binarios

| Binario | Descripción |
|---|---|
| `sensor-node` | Nodo sensor con sensores físicos (DHT22, pluviómetro, anemómetro). Requiere hardware soldado. |
| `sensor-node-mock` | Nodo sensor con datos simulados. Misma pila LoRaWAN que el nodo real; útil para validar el pipeline sin sensores físicos. |
| `gateway-node` | Gateway ESP32 single-channel UDP packet forwarder → ChirpStack. Requiere WiFi y credenciales en env. |

## Requisitos del entorno

```bash
cargo install espup ldproxy espflash
espup install
```

Para el gateway, definir antes de compilar:

```bash
export WIFI_SSID="tu_red"
export WIFI_PASS="tu_clave"
export CHIRPSTACK_HOST="ip_del_host_docker"
```

## Compilar

```bash
cargo build --bin sensor-node
cargo build --bin sensor-node-mock
cargo build --bin gateway-node
```

## Flashear

```bash
cargo espflash flash --bin sensor-node --monitor
cargo espflash flash --bin sensor-node-mock --monitor
cargo espflash flash --bin gateway-node --monitor
```

## Setup de ChirpStack y registro de dispositivos

Ver `infra/SETUP.md` para levantar el stack Docker (ChirpStack + InfluxDB + Mosquitto)
y registrar gateway y nodos en ChirpStack antes de flashear.

## Notas de hardware

Ver `firmware/docs/hardware-assumptions.md` para el mapa de pines de referencia y
limitaciones documentadas del prototipo.

## Limitaciones del prototipo

- Gateway single-channel: opera en 433.175 MHz SF7BW125 fijo. No es spec-compliant con
  LoRaWAN EU433 (requeriría 3 canales); suficiente para un nodo en canal fijo.
- DHT22 en `sensor-node`: el driver GPIO no está implementado aún; usa `UnwiredEnvironmentSensor`
  (retorna error) hasta que se suelde el sensor y se agregue el driver.
- Pulsos de lluvia/viento en `sensor-node`: las ISR de GPIO están declaradas pero no conectadas
  al hardware; los contadores siempre devuelven 0 hasta completar el wiring.
- `sensor-node-mock` cubre ambas limitaciones con datos deterministicos plausibles.
