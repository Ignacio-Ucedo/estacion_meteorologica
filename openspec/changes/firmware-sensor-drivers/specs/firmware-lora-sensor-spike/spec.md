## MODIFIED Requirements

### Requirement: El nodo sensor lee sensores ambientales

El firmware del nodo sensor SHALL leer temperatura y humedad desde un sensor DHT22/AM2302 en GPIO4 usando `Dht22EnvironmentSensor` (feature `hardware`) o `MockEnvironmentSensor` (feature `mock-sensors`) en una placa ESP32 DevKitC V1 usando Rust con ESP-IDF.

El campo `pressure_hpa` de `EnvironmentReading` no tiene sensor físico en el nodo LoRaWAN definitivo y SHALL fijarse en `0.0` por `Dht22EnvironmentSensor`. No se transmite presión en el payload binario.

Unidades y resolución en producción:

- Temperatura: grados Celsius, resolución 0.1 °C, rango −40–+80 °C.
- Humedad relativa: porcentaje RH, resolución 0.1 %RH, rango 0–100 %RH.

#### Scenario: Se registra una lectura ambiental válida (hardware real)

- **GIVEN** el DHT22 está conectado a GPIO4 y el firmware se ejecuta con feature `hardware`
- **WHEN** se ejecuta el ciclo de lectura del nodo sensor
- **THEN** el log serial incluye valores de temperatura (°C) y humedad (%RH) con sus unidades, y el payload binario contiene `temp_c_x100` e `hum_x100` con los valores medidos

#### Scenario: Se reporta una lectura ambiental inválida

- **GIVEN** el DHT22 está desconectado o devuelve un CRC inválido
- **WHEN** se ejecuta el ciclo de lectura del nodo sensor
- **THEN** el log serial identifica la lectura fallida, `temp_c_x100` se fija en `i16::MIN` y `hum_x100` en 0 como centinela, sin detener el firmware
