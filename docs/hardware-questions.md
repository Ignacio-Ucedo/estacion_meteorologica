# Preguntas y respuestas de hardware para los esquemáticos

Decisiones tomadas antes del diseño de esquemáticos del nodo sensor y gateway.

---

## Marco: PoC vs Producto

La estación física es **prestada**. Criterio general:

- **PoC:** reutilizar todo lo que sirva de la estación prestada (batería, sensores,
  caja, módulo GSM) para validar la cadena estación → gateway → mundo.
- **Producto:** cada componente debe quedar especificado y fijado para fabricación
  repetible. Se define *después* de confirmar el PoC.

---

## 1. Anemómetro — variante de salida

**Estado: TBD (diferido) — no bloquea el resto.**

Anemómetro de cazoletas, sin marca. Salida por conector tipo XLR/aviación de 3 pines.
Inferencia: 3 conductores = VCC + GND + SIG → sensor activo, probablemente Hall con
salida por pulsos. Descarta RS485 (necesitaría 4 hilos).

Falta confirmar si SIG es **open-collector NPN** (pull-up a 3.3V en GPIO33) o
**push-pull/Hall** (directo a GPIO33). Procedimiento pendiente:

1. Identificar pines VCC/GND/SIG. Alimentar primero con 3.3V.
2. Multímetro DC entre SIG y GND, girar cazoletas: salta 0V↔VCC = push-pull;
   queda en alto y baja sola = open-collector.
3. ⚠️ Nunca superar 3.3V en GPIO33.

Producto: fijar anemómetro con salida y calibración documentadas (pulsos/rev → m/s).

---

## 2. Pluviómetro — variante de salida

**Decisión: comprar uno nuevo.**

El cuerpo existente es un embudo/colector de aluminio sin mecanismo de cubeta basculante
ni salida eléctrica → no sirve. Se descarta.

Criterio de compra:
- Tipping bucket con **reed switch** (contacto seco) → compatible directo con GPIO32
  (pull-up interno del ESP32), tal como asume el firmware.
- Con **mm/pulso documentado** (típico 0.2 mm/pulso) → fija la constante de calibración
  que estaba pendiente.

---

## 3. DHT22

**Estado: CONFIRMADO ✅**

Sensor **AM2302** (variante cableada del DHT22), marcado "SAIR AM2302". Cableado a
conector de aviación de 3 pines. El driver DHT22 del firmware sirve sin cambios.

---

## 4. Alimentación del nodo sensor

**PoC: reutilizar la SLA 12V 5Ah existente.**

⚠️ Se encontró descargada. Las SLA que reposan descargadas se sulfatan y pierden
capacidad permanentemente → su salud es dudosa. Para el PoC: cargar y usar (es gratis).

**Producto: LiFePO4 12V (4S), ~3–4 Ah, con BMS integrado.**

Justificación: misma tensión nominal (12V) que reutiliza el panel existente; 2000+ ciclos
vs 200–500 de la SLA; no se sulfata en reposo; descarga profunda 80–90% vs 50% SLA.
Controlador de carga con perfil LiFePO4 (PWM 10A o MPPT chico).

**Panel existente (~60×40 cm):** ~30–50W, 12V nominal (Voc ~18–22V). Sobredimensionado
para un nodo LoRa → margen amplio. Verificar Pmax/Vmp/Voc en la etiqueta.

**Implicancias esquemático (igual PoC y producto, ambos 12V):**
- Buck 12V→3.3V (MP1584 o LM2596) alimentando pin 3V3 del ESP32.
- Divisor de batería para ADC: dimensionado a ~15V máx → 3.3V (ej. 100k + 33k,
  con 100nF en la resistencia inferior).
- Rango `battery_mv` real: 10000–14600 mV (SLA) / 10000–14600 mV (LiFePO4 4S).
  El campo u16 del payload aguanta hasta 65535 mV. ✅
  — *Nota: el spec original documentaba 0–4200 mV asumiendo celda LiPo individual;
  corregido en `payload.rs` y en el design doc de `migrate-lorawan-sx1278`.*

---

## 5. Alimentación y backhaul del gateway

**MCU del gateway: ESP32-S3 DevKitC.**

Justificación: más RAM, USB nativo, BLE5, mejor margen para reenvío/buffering.
El nodo sensor mantiene el ESP32 clásico DevKitC V1.

⚠️ **Impacto en build:** el crate `firmware/` compila hoy con target único
`xtensa-esp32-espidf`. El gateway en ESP32-S3 requiere `xtensa-esp32s3-espidf`.
Opciones a resolver en un change futuro: separar en dos crates, o pasar el target
explícito como flag de compilación para el gateway.

**Backhaul modular (WiFi default, celular opcional):**
- WiFi: default del ESP32-S3 (ya implementado en el firmware).
- Celular: **breakout SIM7000G** (LTE-M/NB-IoT/GPRS + GNSS), comandos AT por UART.

**Módulo SIM7000G de la estación existente: NO reutilizar directamente.**

Hallazgo: el SIM7000G está montado en una placa custom "Dropper V2.5" que integra
un microcontrolador PIC18F47Q10 + fuente 12V + antenas GSM/GPS. Es probablemente
el cerebro de la estación original (PIC lee sensores → SIM7000G → nube). Reutilizar
solo el módulo SIM7000G implicaría desoldar el chip o tapear la UART.
→ Decisión: comprar un **breakout dedicado SIM7000G** limpio.

**Antena WiFi (tipo MT7681): no comprar por ahora.**
Mejora el backhaul WiFi al router, no el alcance LoRa. El ESP32-S3-WROOM-1 estándar
trae antena PCB; solo la variante WROOM-1U tiene U.FL/IPEX. Prioridad: antena 433 MHz
para LoRa.

⚠️ **Backhaul celular no está planificado en ningún change activo.** El firmware de
gateway actual solo usa WiFi y compila correctamente. El SIM7000G es alcance nuevo
que necesita su propio change cuando llegue el momento.

---

## 6. Enclosure / caja

- **Nodo:** reutilizar la caja existente (va bajo el panel solar, ya está hecha).
- **Gateway:** diseñar de cero (directorio `3d/`). Definir IP según ubicación.

---

## 7. GPIO5 (NSS del SX1278) — strapping pin

**Decisión: mantener GPIO5 como NSS + pull-up externo de 10k a 3.3V.**

NSS idlea en alto; el pull-up garantiza el nivel correcto para el strapping pin al boot.
Sin cambio de firmware.

Alternativa si se prefiere evitar dependencia del pull-up: mover NSS a GPIO17 (libre,
no-strapping) → cambio de 1 línea en `sensor-node.rs` y `gateway-node.rs`.

---

## 8. Cantidad de nodos

**Decisión: 1 nodo en esta versión.**

Nodos con canal/SF fijo (ADR off, sin hopping) son compatibles con el single-channel
gateway. Al usar ChirpStack + LoRaWAN real, migrar a concentrador multicanal
(SX1302/SX1308, tipo RAK/Dragino) es swap de hardware transparente para backend y
firmware del nodo.

---

## Pendientes para cerrar

- [ ] **Anemómetro:** medir con multímetro (open-collector vs push-pull; identificar pines VCC/GND/SIG).
- [ ] **Pluviómetro:** comprar tipping bucket con reed switch y mm/pulso documentado.
- [ ] **SIM7000G:** comprar breakout dedicado para el gateway.
- [ ] **Antena 433 MHz:** comprar para el SX1278 (prioridad sobre antena WiFi).
- [ ] **Panel solar:** verificar Pmax/Vmp/Voc en la etiqueta.
- [ ] **Change futuro:** separar targets de build (esp32 para nodo / esp32s3 para gateway).
- [ ] **Change futuro:** backhaul celular SIM7000G en gateway.
