# firmware-lora-sensor-spike Specification

## Purpose
Spec de referencia del spike inicial de firmware (change `spike-firmware-lora-sensors`, archivado).
Describe el comportamiento del spike: LoRa P2P a 433 MHz, payload CSV de depuración
(`id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento`), sensores DHT22 + MPL115A2 en banco,
binarios `sensor-node` y `receiver-node`. **Supersedida por el change `migrate-lorawan-sx1278`**
(LoRaWAN EU433, payload binario de 14 bytes, gateway single-channel UDP → ChirpStack).
Conservada como registro histórico de las decisiones del spike.
## Requirements
### Requirement: El nodo sensor lee sensores ambientales
El firmware del nodo sensor SHALL leer temperatura y humedad desde un sensor DHT22 y presión desde un sensor MPL115A2 en una placa ESP32 DevKitC V1 usando Rust con ESP-IDF.

Unidades y resolución esperadas para el spike:

- Temperatura: grados Celsius, registrada con resolución mínima de 0.1 C.
- Humedad relativa: porcentaje RH, registrada con resolución mínima de 0.1 %.
- Presión: hPa o kPa, registrada con resolución mínima de 0.1 hPa o kPa equivalente.

#### Scenario: Se registra una lectura ambiental valida
- **GIVEN** el DHT22 y el MPL115A2 están conectados al ESP32 sensor y el firmware está ejecutándose
- **WHEN** se ejecuta el ciclo de lectura del nodo sensor
- **THEN** el log serial incluye valores de temperatura, humedad y presión con sus unidades o nombres de campo claramente documentados

#### Scenario: Se reporta una lectura ambiental invalida
- **GIVEN** el DHT22 o el MPL115A2 está desconectado o devuelve una lectura inválida
- **WHEN** se ejecuta el ciclo de lectura del nodo sensor
- **THEN** el log serial identifica la lectura fallida sin provocar que el firmware se detenga

### Requirement: El nodo sensor cuenta pulsos de lluvia y viento
El firmware del nodo sensor SHALL contar pulsos de un pluviómetro de cubeta basculante con reed switch y de una entrada de viento tratada como pulso/NPN para el spike.

Unidades y resolución esperadas para el spike:

- Lluvia: conteo crudo de pulsos desde el payload transmitido anterior; la calibración final en mm por pulso queda fuera de alcance.
- Viento: conteo crudo de pulsos desde el payload transmitido anterior; la calibración final de velocidad queda fuera de alcance.

#### Scenario: Aumenta el conteo de pulsos de lluvia
- **GIVEN** la entrada del pluviómetro está conectada y el firmware está ejecutándose
- **WHEN** ocurren uno o más pulsos válidos en la entrada de lluvia
- **THEN** el siguiente log serial o payload transmitido reporta un incremento en `pulsos_lluvia`

#### Scenario: Aumenta el conteo de pulsos de viento
- **GIVEN** la entrada de viento está conectada como señal compatible con pulso/NPN confirmado y el firmware está ejecutándose
- **WHEN** ocurren uno o más pulsos válidos en la entrada de viento
- **THEN** el siguiente log serial o payload transmitido reporta un incremento en `pulsos_viento`

#### Scenario: Los contadores operan entre transmisiones
- **GIVEN** el nodo sensor transmite payloads LoRa cada 5 minutos
- **WHEN** ocurren pulsos de lluvia o viento entre dos transmisiones
- **THEN** el siguiente payload transmitido incluye los conteos acumulados de lluvia y viento para ese intervalo

### Requirement: El nodo sensor transmite payloads CSV por LoRa
El firmware del nodo sensor SHALL transmitir un payload CSV compacto de depuración por LoRa P2P a 433 MHz usando el módulo XL1278-SMT/SX1278.

El formato de payload del spike SHALL ser exactamente:

```text
id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento
```

El intervalo de envío del spike SHALL ser de 5 minutos durante operación normal de banco. Este formato CSV es de depuración para el spike y no define el payload binario de producción posterior.

#### Scenario: Se envia un payload LoRa periodico
- **GIVEN** el nodo sensor y el módulo SX1278 están alimentados por USB e inicializados correctamente
- **WHEN** transcurren 5 minutos durante operación normal de banco
- **THEN** el nodo sensor envía un payload CSV por LoRa P2P a 433 MHz

#### Scenario: El payload contiene los datos actuales de sensores y pulsos
- **GIVEN** el nodo sensor completó al menos una lectura de sensores y tiene contadores de pulsos actuales
- **WHEN** se construye el payload LoRa
- **THEN** los campos del payload aparecen en el orden documentado como `id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento`

#### Scenario: Se registra una falla de envio LoRa
- **GIVEN** el módulo SX1278 falla al inicializarse o transmitir
- **WHEN** el nodo sensor intenta enviar un payload
- **THEN** el firmware registra un error LoRa por serial y continúa ejecutándose

### Requirement: El nodo receptor registra payloads LoRa recibidos
El firmware del nodo receptor SHALL ejecutarse en un segundo ESP32 DevKitC V1 con un módulo XL1278-SMT/SX1278 y registrar paquetes LoRa recibidos por USB serial.

#### Scenario: El receptor registra un paquete valido
- **GIVEN** el nodo receptor está ejecutándose con parámetros LoRa compatibles y el nodo sensor transmite un payload CSV válido
- **WHEN** el nodo receptor recibe el paquete
- **THEN** el log serial del receptor incluye el payload CSV crudo y una representación parseada de sus campos

#### Scenario: El receptor rechaza un paquete malformado
- **GIVEN** el nodo receptor recibe un payload que no coincide con la cantidad de campos CSV esperada
- **WHEN** el receptor intenta parsear el payload
- **THEN** el receptor registra el payload como malformado sin provocar que el firmware se detenga

### Requirement: El spike documenta preocupaciones de produccion diferidas
El cambio SHALL documentar que deep sleep, autonomía con batería/panel solar, reenvío WiFi, ingesta backend, calibración BLE desde Android, validación de alcance en campo, constantes finales de calibración y payloads binarios de producción quedan fuera de alcance para este spike.

#### Scenario: Las preocupaciones diferidas son visibles antes de implementar
- **GIVEN** un desarrollador lee los artifacts OpenSpec de este cambio
- **WHEN** inspecciona proposal, design o tasks
- **THEN** puede identificar qué preocupaciones de producción fueron diferidas intencionalmente a cambios posteriores

