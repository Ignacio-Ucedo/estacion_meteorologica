## Context

El gateway actual es un binario único (`gateway-node.rs`) compilado con el target global del workspace (`xtensa-esp32-espidf`). Cambiar el target global a `xtensa-esp32s3-espidf` rompería la build del nodo sensor (que también usa el ESP32 clásico). La solución es mantener el target global para el sensor y agregar una configuración de build separada solo para el gateway S3.

**Hardware disponible vs. objetivo:**

| Hardware              | Estado       | Target Cargo                    | Uso                        |
|-----------------------|--------------|---------------------------------|----------------------------|
| ESP32 30-pin clásico  | TENEMOS      | `xtensa-esp32-espidf` (actual)  | PoC + nodo sensor          |
| ESP32-S3 DevKitC 38p  | A COMPRAR    | `xtensa-esp32s3-espidf` (nuevo) | Gateway definitivo         |

**Pinout SX1278 en gateway actual vs. ESP32-S3 DevKitC:**

| Señal SX1278 | GPIO actual (ESP32) | GPIO propuesto (S3) | Notas                                         |
|--------------|---------------------|---------------------|-----------------------------------------------|
| SCK          | 18                  | 18                  | Válido en S3, no strapping pin                |
| MISO         | 19                  | 19                  | Válido en S3                                  |
| MOSI         | 23                  | 23 (o 11)           | GPIO23 válido; GPIO11 alternativa HSPI S3     |
| NSS (CS)     | 5                   | 5                   | Válido — S3 NO tiene GPIO5 como strapping pin |
| RST          | 14                  | 14                  | Válido en S3                                  |
| DIO0         | 26                  | 26                  | Válido en S3 DevKitC 38p                      |

**Strapping pins del ESP32-S3** (a evitar como salidas en arranque): GPIO0, GPIO3, GPIO45, GPIO46. El GPIO5 del ESP32-S3 no es strapping pin (a diferencia del ESP32 clásico donde GPIO5 sí tiene comportamiento de strapping en boot).

**Reserva de GPIOs para módulos futuros en ESP32-S3:**

| Módulo   | Señal    | GPIO reservado | Notas                                              |
|----------|----------|----------------|----------------------------------------------------|
| W5500    | CS       | GPIO10         | SPI2 CS libre; no conflicta con SX1278 (GPIO5)    |
| W5500    | INT      | GPIO9          | Input con pull-up interno                          |
| SIM7000G | TX (S3→M)| GPIO17         | UART1 TX en S3; libre en DevKitC 38p              |
| SIM7000G | RX (M→S3)| GPIO16         | UART1 RX en S3; libre en DevKitC 38p              |
| SIM7000G | PWR_KEY  | GPIO15         | GPIO de control de encendido del módulo            |
| ADC alim | VIN_MON  | GPIO4          | ADC1 ch3; libre en S3 DevKitC; sin conflicto WiFi |

W5500 y SIM7000G compartirían el bus SPI2 con SX1278 usando CS distintos (GPIO5 para SX1278, GPIO10 para W5500). El SIM7000G usa UART propio.

## Goals / Non-Goals

**Goals:**
- Configuración de build separada para compilar `gateway-node` con `xtensa-esp32s3-espidf` sin tocar el build del sensor.
- Verificar y documentar que el pinout SPI del SX1278 es válido en el ESP32-S3.
- Reservar y documentar GPIOs para W5500, SIM7000G y ADC de alimentación en `hardware/netlist.md`.

**Non-Goals:**
- Implementar drivers W5500, SIM7000G ni ADC de alimentación.
- Modificar la lógica de `gateway-node.rs` (el firmware es idéntico para ambos targets en esta etapa).
- Agregar soporte Ethernet o cellular al gateway en este change.
- Cambiar el build del nodo sensor.

## Decisions

### D1: Configuración de build separada — subcarpeta con `.cargo/config.toml` propio

Opción A (elegida): crear `firmware/gateway-s3/.cargo/config.toml` con target `xtensa-esp32s3-espidf` y variables MCU/ESP_IDF específicas. El binario `gateway-node` se compila desde ese directorio con `cargo build --bin gateway-node`. El `.cargo/config.toml` principal en `firmware/` no se modifica.

Opción B descartada: feature flags de Cargo para seleccionar target — Cargo no soporta seleccionar el target de compilación por feature; los features son para código fuente, no para el toolchain target.

Opción C descartada: modificar el workspace target global a S3 — rompe la build del sensor-node en ESP32 clásico hasta que se migre ese hardware también.

### D2: Reutilizar `gateway-node.rs` sin modificación

El firmware `gateway-node.rs` es agnóstico del SoC concreto (usa abstracciones `esp-idf-hal`). No se necesita un archivo fuente separado para el S3 en esta etapa. La misma fuente compila para ambos targets.

### D3: GPIO5 como NSS del SX1278 — seguro en ESP32-S3

Confirmado: GPIO5 es strapping pin solo en el ESP32 clásico (selecciona SDIO/SPI boot). En el ESP32-S3, los strapping pins son GPIO0, GPIO3, GPIO45 y GPIO46. Por tanto, GPIO5 puede usarse como NSS del SX1278 sin riesgo de comportamiento inesperado en el boot del S3.

### D4: W5500 en SPI2 compartido con SX1278

El ESP32-S3 tiene SPI2 (FSPI) y SPI3 disponibles. Usar SPI2 para ambos (SX1278 + W5500) con CS distintos es la solución más simple y ahorra un bus SPI. La separación se garantiza por CS (GPIO5 vs. GPIO10); los módulos no están activos simultáneamente a nivel de driver.

## Risks / Trade-offs

- **[Risk] GPIO23 en ESP32-S3** → En algunos DevKitC 38-pin, GPIO23 está disponible pero puede estar conectado al LED onboard en variantes de placa. Verificar con el modelo específico adquirido antes de compilar. Mitigación: alternativa MOSI = GPIO11 (HSPI S3 nativo).
- **[Risk] ESP_IDF_VERSION para esp32s3** → La versión `v5.2.2` usada actualmente es compatible con ESP32-S3; verificar que `esp-idf-hal 0.46` tiene soporte S3 estable. El cambio de target es el riesgo principal de compilación.
- **[Risk] ADC1 vs WiFi en S3** → A diferencia del ESP32 clásico, el ESP32-S3 no tiene conflicto entre ADC y WiFi en ningún canal ADC. Riesgo eliminado en el S3.

## Migration Plan

1. Crear `firmware/gateway-s3/` con `.cargo/config.toml` apuntando a `xtensa-esp32s3-espidf`.
2. Verificar que `cargo build --bin gateway-node` compila desde ese directorio (sin hardware S3 aún — solo verificar que el toolchain acepta el target).
3. Documentar pinout SX1278 válido en S3 y reservas W5500/SIM7000G en `hardware/netlist.md`.
4. Cuando se adquiera el ESP32-S3: flashear, verificar boot serial, confirmar que el gateway funciona igual que en el ESP32 clásico.

**Rollback**: borrar `firmware/gateway-s3/`. El resto del repo no se modifica.

## Open Questions

- **OQ1**: ¿El modelo específico de ESP32-S3 DevKitC 38p a comprar tiene GPIO23 libre o conectado a LED onboard? Determina si MOSI = GPIO23 o GPIO11.
- **OQ2**: ¿Los módulos W5500 y SIM7000G a adquirir tienen interfaz SPI (W5500 sí, estándar) y confirmación de niveles de tensión compatibles con 3.3 V? → Bloquea el cambio de reserva si se descubre incompatibilidad.
