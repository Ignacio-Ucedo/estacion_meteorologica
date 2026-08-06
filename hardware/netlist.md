# Netlist — Estación Meteorológica

Conexiones completas para dibujar los esquemáticos en KiCad.
Cada **net** es una señal eléctrica: todos los pines listados bajo ella van conectados entre sí.

> **Nota de conectores:** Los sensores (anemómetro, veleta, AM2302) usan conectores de aviación circular tipo XLR.
> En el proveedor pedís "XLR hembra X pines panel-mount" para la PCB, o "XLR macho X pines cable" para el cable del sensor.
> Las borneras de tornillo se piden como "bornera 2 vías paso 5 mm" (para batería y pluviómetro).

---

## NODO SENSOR

> **Radio**: módulo LR1121 con firmware Modem-E v2.1.0 (AU915, stack LoRaWAN 1.0.4 en chip).
> Prerequisite de hardware: flashear Modem-E antes de conectar (ver tarea 1.1 y `hardware/flashing-modem-e.md`).
> Antena recomendada: **yagi 915 MHz (≥ 9 dBi)** conectada vía pigtail U.FL → SMA.

### Componentes

| Ref  | Valor / Modelo                        | Descripción                                             | Estado    |
|------|---------------------------------------|---------------------------------------------------------|-----------|
| U1   | ESP32 DevKitC V1                      | MCU principal, 30 pines                                 | TENEMOS   |
| U2   | LR1121 breakout (Waveshare Core1121   | Módulo LoRa AU915, conector U.FL/SMA, Modem-E v2.1.0   | COMPRAR   |
|      | o Seeed Wio-LR1121)                   | flashed como prerequisito                               |           |
| U3   | MP1584EN o LM2596     | Buck (step-down) 12 V → 3.3 V (módulo prearmado OK para PoC) | COMPRAR |
| J1   | Bornera 2p (2 vías)   | Conector batería 12 V (positivo arriba)                 | COMPRAR   |
| J2   | XLR 5p macho          | Conector AM2302 (dentro de pantalla de radiación) — cable termina en hembra 5p; solo 3 pines en uso (VCC/GND/DATA), 2 NC — medir antes de cablear | TENEMOS |
| J3   | Bornera 2p (2 vías)   | Conector pluviómetro reed switch (contacto seco)        | COMPRAR   |
| J4   | XLR 3p macho          | Conector anemómetro — XLR hembra 3p cable-mount a comprar | TENEMOS |
| J5   | XLR 5p macho          | Conector veleta — XLR hembra 5p cable-mount a comprar   | COMPRAR   |
| R1   | 100 kΩ 1%             | Divisor batería — resistencia superior                  | TENEMOS   |
| R2   | 33 kΩ 1%              | Divisor batería — resistencia inferior                  | TENEMOS   |
| R3   | 10 kΩ                 | Pull-up DHT22 DATA                                      | TENEMOS   |
| R4   | 100 kΩ                | Divisor veleta — resistencia superior (ver nota)        | TENEMOS   |
| R5   | 10 kΩ                 | Pull-up anemómetro NPN — **DNP si push-pull**           | TENEMOS   |
| R6   | 10 kΩ                 | Pull-up GPIO5/NSS — strapping pin, obligatorio          | TENEMOS   |
| R7   | 33 kΩ                 | Divisor veleta — resistencia inferior (ver nota)        | TENEMOS   |
| C1   | 100 µF / 25 V electro | Bulk entrada buck                                       | COMPRAR   |
| C2   | 100 µF / 10 V electro | Bulk salida 3.3 V                                       | COMPRAR   |
| C3   | 100 nF cerámico       | Bypass 3.3 V                                            | TENEMOS   |
| C4   | 100 nF cerámico       | Filtro RC ADC batería                                   | TENEMOS   |
| C5   | 100 nF cerámico       | Filtro RC ADC veleta                                    | TENEMOS   |
| ANT  | Antena yagi 915 MHz ≥ 9 dBi | Pigtail U.FL → SMA incluido en breakout LR1121      | COMPRAR   |

---

### Nets

#### `+12V`
| Ref | Pin | Nota |
|-----|-----|------|
| J1  | 1   | Positivo batería |
| U3  | VIN | Entrada buck |
| C1  | +   | Bulk entrada (electrolítico, + hacia arriba) |
| R1  | 1   | Extremo superior del divisor batería |
| R4  | 1   | Extremo superior del divisor veleta (si salida 12 V) |

> ⚠ **Veleta — confirmar tensión de alimentación** antes de conectar R4 a +12V.
> Si la veleta se alimenta con 5V, R4 va a +5V (necesitás un net +5V separado del buck o usar los 5V del USB).
> Si se alimenta con 3.3V, R4 va a +3.3V y el divisor no hace falta.

#### `GND`
| Ref | Pin | Nota |
|-----|-----|------|
| J1  | 2   | Negativo batería |
| U3  | GND-IN  | GND entrada buck |
| U3  | GND-OUT | GND salida buck |
| C1  | −   | |
| C2  | −   | |
| C3  | −   | |
| C4  | −   | |
| C5  | −   | |
| R2  | 2   | Extremo inferior divisor batería |
| R7  | 2   | Extremo inferior divisor veleta |
| U1  | GND | Todos los pines GND del DevKitC |
| U2  | GND | |
| J2  | TBD | AM2302 GND — medir |
| J3  | 2   | Reed switch (contacto seco, sin polaridad) |
| J4  | 2   | Anemómetro GND |
| J5  | 2   | Veleta GND |

#### `+3.3V`
| Ref | Pin | Nota |
|-----|-----|------|
| U3  | VOUT | Salida buck |
| C2  | +    | Bulk salida |
| C3  | +    | Bypass cerámico — lo más cerca posible del pin 3V3 del ESP32 |
| U1  | 3V3  | Alimentar aquí directamente, bypass el LDO onboard |
| U2  | VCC  | |
| R3  | 1    | Pull-up DHT22 |
| R5  | 1    | Pull-up anemómetro (DNP si push-pull) |
| R6  | 1    | Pull-up NSS/GPIO5 |
| J2  | TBD  | AM2302 VDD — medir |
| J4  | 1    | Anemómetro VCC |
| J5  | 1    | Veleta VCC — **confirmar antes de conectar, ver nota arriba** |

#### `BAT_ADC` → GPIO35
| Ref | Pin | Nota |
|-----|-----|------|
| R1  | 2   | Extremo inferior de R1 |
| R2  | 1   | Extremo superior de R2 |
| C4  | +   | Filtro RC (en paralelo con R2) |
| U1  | GPIO35 | Input-only ADC — sin pull-up interno |

> `bateria_mv = adc_mv / 0.248`  (R1=100k, R2=33k → ratio 0.248)

#### `VELETA_ADC` → GPIO34
| Ref | Pin | Nota |
|-----|-----|------|
| R4  | 2   | Extremo inferior de R4 |
| R7  | 1   | Extremo superior de R7 |
| C5  | +   | Filtro RC (en paralelo con R7) |
| J5  | 3   | Señal SIG de la veleta |
| U1  | GPIO34 | Input-only ADC — sin pull-up interno |

> ⚠ **Pinout del conector de 5 pines de la veleta: DESCONOCIDO — medir antes de conectar.**
> Identificar VCC, GND y SIG con multímetro. Los pines 4 y 5 son TBD (posiblemente NC o calefactor de condensación).
> El divisor R4/R7 asume salida analógica 0–5V → 0–3.3V. Si la salida ya es 0–3.3V, R4/R7/C5 no hacen falta (SIG directo a GPIO34).

> ⚠ **El payload actual (14 bytes) NO tiene campo para dirección de viento.**
> Agregar `veleta_dir` requiere un change en firmware + backend. Pendiente.

#### `DHT22_DATA`
| Ref | Pin | Nota |
|-----|-----|------|
| J2  | TBD | AM2302 DATA — medir con multímetro para identificar el pin de señal en el XLR 5p |
| R3  | 2   | Extremo del pull-up hacia la señal |
| U1  | GPIO4 | Cable máx ~1 m |

#### `LR1121_SCK`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO18 | SPI CLK |
| U2  | SCK    | |

#### `LR1121_MISO`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO19 | SPI MISO |
| U2  | MISO   | |

#### `LR1121_MOSI`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO23 | SPI MOSI |
| U2  | MOSI   | |

#### `LR1121_NSS`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO5  | ⚠ Strapping pin — R6 obligatorio |
| U2  | NSS    | Chip select, activo-bajo |
| R6  | 2      | Extremo del pull-up hacia la señal |

#### `LR1121_RST`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO14 | |
| U2  | NRESET | |

#### `LR1121_BUSY`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO27 | **Nuevo respecto a SX1278** — obligatorio en LR1121 (no hay BUSY en SX1278) |
| U2  | BUSY   | Activo-alto: indica que el chip procesa un comando SPI |

#### `LR1121_DIO1`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO26 | Reusa el net anterior `SX1278_DIO0` |
| U2  | DIO1   | Pin de eventos Modem-E (JOINED, TX_DONE, etc.) |

#### `LLUVIA_REED`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO32 | Pull-up **interno** del ESP32 activado por firmware (`INPUT_PULLUP`) |
| J3  | 1      | Un extremo del reed switch |

> J3 pin 2 va a GND. Reed switch es contacto seco — sin polaridad, cualquier orientación.

#### `VIENTO_NPN`
| Ref | Pin | Nota |
|-----|-----|------|
| U1  | GPIO33 | |
| J4  | 3      | Señal SIG del anemómetro |
| R5  | 2      | Extremo del pull-up (**DNP si push-pull**) |

---

### Resumen de GPIOs usados — Nodo Sensor

| GPIO | Función           | Tipo          | Nota |
|------|-------------------|---------------|------|
| 4    | DHT22 DATA        | Digital I/O   | |
| 5    | LR1121 NSS        | SPI CS (strapping pin) | R6 pull-up obligatorio |
| 14   | LR1121 RESET      | Digital OUT   | |
| 18   | LR1121 SCK        | SPI CLK       | |
| 19   | LR1121 MISO       | SPI MISO      | |
| 23   | LR1121 MOSI       | SPI MOSI      | |
| 26   | LR1121 DIO1       | Digital IN    | Eventos Modem-E (JOINED, TX_DONE) |
| 27   | LR1121 BUSY       | Digital IN    | **Nuevo** — no existía en SX1278 |
| 32   | Pluviómetro reed  | Digital IN    | Pull-up interno |
| 33   | Anemómetro NPN    | Digital IN    | |
| 34   | Veleta ADC        | ADC input-only | TBD, pinout desconocido |
| 35   | Batería ADC       | ADC input-only | |

### Pins sin conectar del LR1121 (nodo)

DIO2, DIO3, DIO9/RFSW — sin conectar en esta rev. Validar según breakout adquirido.

---

## GATEWAY

> **PoC vs target:** La PoC usa el ESP32 DevKitC V1 de 30 pines (TENEMOS) alimentado por USB.
> El diseño target agrega backhauls alternativos y alimentación a batería.
> Radio: LR1121 en modo transceiver (firmware de fábrica, sin Modem-E).
> Antena recomendada: **omnidireccional 915 MHz (2–5 dBi)**, conector SMA hembra.

### Componentes

| Ref   | Valor / Modelo                        | Descripción                                                          | Estado   |
|-------|---------------------------------------|----------------------------------------------------------------------|----------|
| U1    | ESP32 DevKitC V1 (30p)               | MCU gateway PoC — WiFi, alimentación USB                             | TENEMOS  |
| U1-T  | ESP32-S3 DevKitC (38p)               | MCU gateway target — change `gateway-esp32s3-target`                 | FUTURO   |
| U2    | LR1121 breakout (Waveshare Core1121  | Módulo LoRa AU915 en modo transceiver — RX 903.9 MHz SF7BW125        | COMPRAR  |
|       | o Seeed Wio-LR1121)                  | NO flashear Modem-E en el gateway (modo transceiver requerido)        |          |
| U3    | Buck (step-down) MP1584/LM2596 | 12 V → 3.3 V para alimentación a batería                                 | FUTURO   |
| U4    | W5500 módulo SPI            | Ethernet backhaul                                                           | FUTURO   |
| U5    | SIM7000G breakout           | Cellular backhaul (LTE-M / NB-IoT / GPRS)                                  | FUTURO   |
| J1    | Bornera 2p (2 vías)         | Conector batería 12 V — para alimentación autónoma                          | FUTURO   |
| R6    | 10 kΩ                       | Pull-up GPIO5/NSS — strapping pin, obligatorio                              | TENEMOS  |
| R8    | 100 kΩ 1%                   | Divisor batería gateway — resistencia superior                               | FUTURO   |
| R9    | 33 kΩ 1%                    | Divisor batería gateway — resistencia inferior                               | FUTURO   |
| C6    | 100 nF cerámico             | Filtro RC ADC batería gateway                                                | FUTURO   |
| C7    | 100 µF / 25 V electro       | Bulk entrada buck gateway                                                    | FUTURO   |
| C8    | 100 µF / 10 V electro       | Bulk salida 3.3 V gateway                                                    | FUTURO   |
| ANT   | Antena omnidireccional 915 MHz (2–5 dBi) | Conector SMA hembra                                        | COMPRAR  |

---

### Nets

#### `+12V` *(FUTURO — solo con alimentación a batería)*
| Ref | Pin | Nota |
|-----|-----|------|
| J1  | 1   | Positivo batería |
| U3  | VIN | Entrada buck |
| C7  | +   | Bulk entrada |
| R8  | 1   | Extremo superior divisor batería |

#### `+3.3V`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | 3V3   | Salida LDO onboard (PoC: vía USB; target: vía U3 buck o USB) |
| C8  | +     | Bulk salida *(FUTURO — solo con U3 poblado)* |
| U2  | VCC   | |
| U4  | 3V3   | W5500 *(FUTURO)* |
| R6  | 1     | Pull-up NSS |

#### `GND`
| Ref | Pin | Nota |
|-----|-----|------|
| J1  | 2   | Negativo batería *(FUTURO)* |
| U3  | GND-IN / GND-OUT | *(FUTURO)* |
| C7  | −   | *(FUTURO)* |
| C8  | −   | *(FUTURO)* |
| C6  | −   | *(FUTURO)* |
| R9  | 2   | Extremo inferior divisor batería *(FUTURO)* |
| U1/U1-T | GND | |
| U2  | GND | |
| U4  | GND | *(FUTURO)* |
| U5  | GND | *(FUTURO)* |

#### `BAT_GW_ADC` → GPIO TBD *(FUTURO)*
| Ref | Pin | Nota |
|-----|-----|------|
| R8  | 2   | Extremo inferior de R8 |
| R9  | 1   | Extremo superior de R9 |
| C6  | +   | Filtro RC |
| U1-T | GPIO TBD | En S3: cualquier ADC pin — sin conflicto ADC2/WiFi |

> Mismo circuito que el nodo sensor (ratio 0.248). En PoC (30-pin ESP32) NO usar con WiFi activo — conflicto ADC2.

#### `LR1121_SCK`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | GPIO18 | SPI bus compartido con W5500 *(FUTURO)* |
| U2  | SCK    | |
| U4  | SCK    | W5500 *(FUTURO)* |

#### `LR1121_MISO`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | GPIO19 | |
| U2  | MISO   | |
| U4  | MISO   | W5500 *(FUTURO)* |

#### `LR1121_MOSI`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | GPIO23 | |
| U2  | MOSI   | |
| U4  | MOSI   | W5500 *(FUTURO)* |

#### `LR1121_NSS`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | GPIO5  | ⚠ Strapping pin — R6 obligatorio |
| U2  | NSS    | |
| R6  | 2      | |

#### `ETH_NSS` *(FUTURO)*
| Ref | Pin | Nota |
|-----|-----|------|
| U1-T | GPIO TBD | CS dedicado para W5500 — no comparte con SX1278 |
| U4   | CS       | |

#### `ETH_INT` *(FUTURO)*
| Ref | Pin | Nota |
|-----|-----|------|
| U1-T | GPIO TBD | Interrupción W5500 |
| U4   | INT      | |

#### `LR1121_RST`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | GPIO14 | |
| U2  | NRESET | |

#### `LR1121_BUSY`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | GPIO27 | **Nuevo respecto a SX1278** — obligatorio en LR1121 |
| U2  | BUSY   | Activo-alto |

#### `LR1121_DIO1`
| Ref | Pin | Nota |
|-----|-----|------|
| U1/U1-T | GPIO26 | |
| U2  | DIO1   | RX_DONE interrupt (modo transceiver) |

#### `SIM_TX` *(FUTURO — UART ESP32 → SIM7000G)*
| Ref | Pin | Nota |
|-----|-----|------|
| U1-T | GPIO TBD | TX del ESP32 → RX del SIM7000G |
| U5   | RXD      | |

#### `SIM_RX` *(FUTURO)*
| Ref | Pin | Nota |
|-----|-----|------|
| U1-T | GPIO TBD | RX del ESP32 ← TX del SIM7000G |
| U5   | TXD      | |

#### `SIM_PWRKEY` *(FUTURO)*
| Ref | Pin | Nota |
|-----|-----|------|
| U1-T | GPIO TBD | Control de encendido del SIM7000G (pulso >1 s) |
| U5   | PWRKEY   | |

### Pins sin conectar del LR1121 (gateway)

DIO2, DIO3, DIO9/RFSW — sin conectar en esta rev. Validar según breakout adquirido.

---

## Lista de compras

### PoC — compras inmediatas

| Ítem | Especificación | Nota |
|------|---------------|------|
| LR1121 breakout × 2 | Waveshare Core1121 o Seeed Wio-LR1121 (conector U.FL/SMA, SPI 3.3 V) | 1 para nodo (Modem-E), 1 para gateway (transceiver) |
| Pluviómetro | Tipping bucket con reed switch, mm/pulso documentado | No tenemos — prioritario |
| Batería 12V (nodo) | SLA 12V nueva ≥5Ah, o LiFePO4 12V 4S ~4Ah con BMS | SLA existente posiblemente sulfatada — comprar nueva |
| Buck (step-down) nodo | Módulo MP1584 o LM2596, 12V→3.3V, 1A mín | Para el nodo sensor |
| Antena yagi 915 MHz | ≥ 9 dBi, pigtail U.FL → SMA | Nodo sensor (prueba de rango) |
| Antena omnidireccional 915 MHz | 2–5 dBi, SMA hembra | Gateway |
| Bornera 2 vías paso 5 mm | Paso 5 mm, tornillo, bornes para 1.5–2.5 mm² | 2 unidades nodo (J1 batería + J3 pluviómetro) |
| XLR hembra 3p cable-mount | Cable-mount, para extremo sensor del cable del anemómetro | Anemómetro tiene macho en base |
| XLR hembra 5p cable-mount | Cable-mount, para extremo sensor del cable de la veleta | Veleta tiene macho en base; confirmar pinout antes de cablear |
| C1 | 100 µF / 25 V electrolítico | Bulk entrada buck nodo |
| C2 | 100 µF / 10 V electrolítico | Bulk salida 3.3 V nodo |

### Target — compras futuras (post-PoC)

| Ítem | Especificación | Nota |
|------|---------------|------|
| ESP32-S3 DevKitC | 38 pines, USB-C onboard, WiFi+BT | Reemplaza el 30-pin en el gateway; necesario para backhauls múltiples sin conflicto ADC2/WiFi |
| W5500 módulo SPI | Ethernet 10/100 vía SPI | Backhaul Ethernet y Starlink (vía router) |
| SIM7000G breakout | LTE-M / NB-IoT / GPRS, SIM nano | Backhaul cellular |
| Batería 12V (gateway) | LiFePO4 12V 4S ~4Ah con BMS | Alimentación autónoma del gateway en campo |
| Buck (step-down) gateway | Módulo MP1584 o LM2596, 12V→3.3V, 1A mín | Para gateway con batería |
| Bornera 2 vías paso 5 mm | Ídem nodo | 1 unidad: J1 batería gateway |
| C7 | 100 µF / 25 V electrolítico | Bulk entrada buck gateway |
| C8 | 100 µF / 10 V electrolítico | Bulk salida 3.3 V gateway |
| Batería 12V (nodo, producto final) | LiFePO4 12V 4S ~4Ah con BMS | Reemplaza SLA de PoC |

## Pendientes antes de cerrar el esquemático

- [ ] **AM2302 — pinout XLR 5p**: medir con multímetro. Identificar VCC, GND y DATA; los 2 pines restantes son NC.
- [ ] **Veleta — pinout XLR 5p**: medir con multímetro. Identificar VCC, GND, SIG y los 2 pines restantes (NC o calefactor).
- [ ] **Veleta — tensión de alimentación**: confirmar si es 3.3 V, 5 V o 12 V. Define adónde conectar R4.
- [ ] **Anemómetro — confirmar NPN vs push-pull**: define si R5 se puebla o DNP.
- [ ] **Veleta — change de firmware + payload**: agregar campo `veleta_dir` (payload actual de 14 bytes no lo incluye).

## Notas comunes

1. **GPIO5 strapping pin**: sin R6 el ESP32 puede bootear en modo de descarga. Siempre poblar.
2. **Antena antes de encender**: nunca energizar el LR1121 sin antena conectada — puede dañar el PA.
3. **GPIO34 y GPIO35**: input-only en el ESP32 clásico. Sin pull-up ni pull-down interno disponible.
4. **Target de build**: nodo = `xtensa-esp32-espidf`, gateway = `xtensa-esp32s3-espidf` (change futuro).
5. **LR1121 BUSY pin obligatorio**: a diferencia del SX1278, el LR1121 requiere que el host espere que BUSY baje (activo-alto) antes de leer la respuesta de cualquier comando SPI. Ver `firmware/lr1121-modem-e/src/lib.rs` y `firmware/lr1121-transceiver/src/lib.rs`.
6. **Prerequisite de flash (solo nodo)**: el LR1121 del nodo debe tener Modem-E v2.1.0 flashed una única vez antes de operar. El LR1121 del gateway NO debe flashearse con Modem-E.
