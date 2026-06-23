## Context

Este es el primer cambio concreto del proyecto de estación meteorológica autónoma. Todavía no hay código de aplicación, por lo que el diseño se enfoca en validar las hipótesis de firmware y enlace de radio sobre hardware físico antes de avanzar con backend, Android, carcasa, pruebas de campo o autonomía.

El spike usa dos placas ESP32 DevKitC V1 con módulos ESP32-WROOM-32. El nodo sensor lee temperatura/humedad con DHT22, presión con MPL115A2, un pluviómetro de cubeta basculante con reed switch y una entrada de viento por pulsos. El nodo receptor usa la misma placa y un módulo LoRa XL1278-SMT/SX1278 para recibir y registrar paquetes por USB serial. LoRa funciona en modo P2P a 433 MHz.

Flujo extremo a extremo del spike:

```text
Sensores de banco
  DHT22, MPL115A2, reed de lluvia, viento pulso/NPN
        |
        v
Nodo sensor ESP32, Rust + ESP-IDF
  lectura, conteo de pulsos, armado de CSV
        |
        v
XL1278-SMT / SX1278 LoRa P2P, 433 MHz
        |
        v
Nodo receptor ESP32, Rust + ESP-IDF
  recepcion, parseo de CSV, log serial
        |
        v
Monitor serial en notebook
```

El flujo general del proyecto sigue siendo sensor -> ESP32 -> LoRa -> gateway -> backend -> InfluxDB -> frontend, pero este cambio se detiene deliberadamente en el log serial del receptor.

## Goals / Non-Goals

**Goals:**

- Establecer una base de firmware Rust con ESP-IDF para ESP32-WROOM-32 / DevKitC V1.
- Validar lecturas básicas de DHT22 y MPL115A2 en el nodo sensor y registrarlas por serial.
- Contar pulsos de lluvia y viento continuamente entre transmisiones.
- Transmitir un payload CSV compacto cada 5 minutos por LoRa P2P a 433 MHz.
- Recibir, parsear y registrar paquetes en un segundo ESP32 conectado por USB serial.
- Registrar supuestos pendientes de hardware, especialmente la variante de salida del anemómetro y las constantes de calibración.

**Non-Goals:**

- Deep sleep, operación con batería, carga solar o medición de consumo.
- Reenvío por WiFi, FastAPI, InfluxDB, frontend o comportamiento de gateway de producción.
- Implementación de calibración BLE desde Android.
- Carcasa final de campo o dimensiones de modelos 3D.
- Validación de alcance en campo más allá de pruebas cortas de banco/patio.
- Formato binario de producción. El spike usa CSV para depuración sencilla y deja la migración a payload binario para un cambio posterior.
- Calibración real de lluvia/viento. Se pueden documentar constantes placeholder, pero la calibración final queda fuera de alcance.

## Decisions

### Usar Rust con ESP-IDF

Usar el camino ESP-IDF mediante `esp-idf-hal` / `esp-idf-svc` en lugar de `esp-hal` bare-metal.

Motivo: el nodo final necesita BLE para calibración desde Android y el gateway necesita WiFi para reenviar al backend. Empezar con ESP-IDF evita una migración probable de framework después del spike.

Alternativa considerada: `esp-hal` bare-metal. Da más control de bajo nivel y puede ser más liviano, pero aumenta la incertidumbre para integrar BLE/WiFi más adelante.

### Usar dos roles ESP32

Construir dos roles de firmware: transmisor sensor y receptor logger.

Motivo: un segundo ESP32 receptor valida el enlace LoRa extremo a extremo sin requerir backend ni servicio de gateway. Esto mantiene el spike enfocado en el camino hardware/radio.

Alternativa considerada: implementar solo el transmisor sensor e inspeccionar estado SPI/radio localmente. Eso no probaría recepción.

### Usar CSV de depuración para el spike

El nodo sensor envía:

```text
id,seq,temp,hum,pres,pulsos_lluvia,pulsos_viento
```

Motivo: CSV es fácil de inspeccionar en logs seriales, fácil de parsear en el receptor y suficiente para un spike de banco.

Alternativa considerada: payload binario de tamaño fijo. Sigue siendo la dirección prevista para producción por menor tiempo de aire y menor consumo, pero complicaría la depuración temprana de hardware.

### Tratar el anemómetro como pulso/NPN hasta confirmar

El anemómetro previsto es RS-FSJT-N01, pero todavía no está confirmada la variante exacta de salida. El spike asume entrada pulso/NPN solo después de confirmar esa variante en la unidad física o en la documentación de compra.

Motivo: las variantes RS485 Modbus, tensión, lazo de corriente y pulso/NPN requieren interfaces y protección eléctrica distintas con el ESP32. El spike no debe diseñar silenciosamente para la interfaz equivocada.

Alternativa considerada: soportar todas las variantes en el primer spike. Eso ampliaría demasiado el alcance de hardware.

### Contar pulsos continuamente entre envíos

Los contadores de lluvia y viento permanecen activos independientemente del intervalo de transmisión LoRa de 5 minutos.

Motivo: los eventos de lluvia y viento pueden ocurrir entre envíos; el intervalo de transmisión no debe definir la capacidad eléctrica de capturar pulsos.

Alternativa considerada: muestrear solo al momento de enviar. Eso perdería eventos y no validaría la arquitectura real de la estación.

## Risks / Trade-offs

- [SX1278 a 433 MHz puede tener restricciones regulatorias] -> Confirmar las reglas ENACOM aplicables para operación de baja potencia en 433 MHz antes de despliegue en campo; para este spike, mantener pruebas locales y de baja potencia.
- [La variante del anemómetro puede no ser pulso/NPN] -> Condicionar el cableado final a la confirmación de etiqueta/ficha técnica; si la unidad es RS485, 0-5V, 0-10V o 4-20mA, crear un cambio posterior para la interfaz de hardware.
- [Las entradas GPIO del ESP32 pueden dañarse con niveles incompatibles] -> Usar adaptación de nivel, pull-ups/pull-downs, optoacoplamiento, divisores o módulos de interfaz según la salida confirmada del sensor.
- [DHT22 puede ser sensible a tiempos bajo RTOS] -> Mantener las lecturas aisladas y registrar errores explícitos; aceptar esta limitación del spike si luego cambia la elección de sensor.
- [MPL115A2 requiere manejo de compensación/calibración interna] -> Usar el flujo de compensación documentado por el sensor en la capa de driver y registrar lecturas inválidas de forma distinguible.
- [CSV es ineficiente como payload LoRa] -> Mantener CSV acotado al spike y agregar una tarea posterior para migrar a binario de tamaño fijo antes de campo/autonomía.
- [Sin deep sleep no hay evidencia de autonomía] -> No usar este spike para afirmar preparación para batería o panel solar.
- [Un enlace LoRa exitoso en banco no prueba alcance en campo] -> Agregar un cambio posterior de rango/link budget luego de validar el enlace básico de firmware.

## Migration Plan

Este es un prototipo nuevo sin firmware desplegado. La implementación debe comenzar creando un workspace de firmware con dos roles o binarios ejecutables para `sensor-node` y `receiver-node`.

El despliegue del spike es manual, flasheando por USB las dos placas ESP32 DevKitC V1. El rollback consiste en flashear la imagen previa conocida como funcional o borrar la placa si todavía no existe una imagen previa.

## Open Questions

- Que pines GPIO exactos se usarán para DHT22, I2C del MPL115A2, SPI/NSS/RST/DIO del SX1278, entrada de lluvia y entrada de viento.
- Que driver/crate Rust LoRa se seleccionará para SX1278 sobre SPI con ESP-IDF.
- Cuales son los requisitos eléctricos confirmados del anemómetro una vez comprado.
- Que constantes placeholder de calibración se usarán para lluvia y viento durante el spike.
- Que parámetros LoRa se usarán para validación de banco: spreading factor, bandwidth, coding rate, sync word, potencia de transmisión y preamble length.
- Que formato de log serial se usará para lecturas inválidas de sensores y paquetes LoRa inválidos o perdidos.
