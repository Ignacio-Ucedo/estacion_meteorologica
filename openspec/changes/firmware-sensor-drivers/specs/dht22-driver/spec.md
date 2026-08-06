## ADDED Requirements

### Requirement: El firmware lee temperatura y humedad desde DHT22 real

El firmware del nodo sensor SHALL leer temperatura y humedad desde un sensor DHT22/AM2302 conectado a GPIO4 (pull-up R3 10 kΩ) usando el periférico RMT del ESP32 vía `esp-idf-hal`.

Unidades y resolución:
- Temperatura: grados Celsius, resolución 0.1 °C, rango −40–+80 °C.
- Humedad relativa: porcentaje RH, resolución 0.1 %RH, rango 0–100 %RH.

La implementación SHALL exponerse como `Dht22EnvironmentSensor` implementando el trait `EnvironmentSensor` de `weather-core::sensors`.

#### Scenario: Lectura exitosa del DHT22

- **GIVEN** el sensor DHT22 está conectado a GPIO4 y alimentado, y el firmware se ejecuta con feature `hardware`
- **WHEN** se invoca `read_environment()` en `Dht22EnvironmentSensor`
- **THEN** retorna `Ok(EnvironmentReading)` con `temp_c` en rango [−40.0, 80.0] y `humidity_rh` en rango [0.0, 100.0]

#### Scenario: Timeout o error de comunicación DHT22

- **GIVEN** el sensor DHT22 está desconectado o no responde dentro del timeout RMT
- **WHEN** se invoca `read_environment()`
- **THEN** retorna `Err(SensorError::Dht22Unavailable)` sin hacer panic ni detener el firmware

#### Scenario: Lectura inválida por CRC DHT22

- **GIVEN** el sensor DHT22 responde pero el byte de checksum no coincide con la suma de los 4 bytes de datos
- **WHEN** se procesa la respuesta RMT
- **THEN** retorna `Err(SensorError::InvalidReading)` y el loop principal registra el error por serial y continúa con valor centinela

#### Scenario: Build sin hardware usa MockEnvironmentSensor

- **GIVEN** el proyecto se compila sin feature `hardware` (modo simulación)
- **WHEN** el nodo sensor se inicializa
- **THEN** usa `MockEnvironmentSensor` y el firmware compila y ejecuta sin acceder a GPIO4
