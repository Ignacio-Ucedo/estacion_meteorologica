## Context

El firmware `gateway-node-mock` ya implementa toda la lógica necesaria en Rust: protocolo Semtech UDP Packet Forwarder, OTAA con ChirpStack, construcción de frames LoRaWAN con crypto real, y generación de lecturas sintéticas con `MockEnvironmentSensor`. La lógica no-ESP32 de ese binario (módulos `lorawan`, `udp_forwarder`, `payload`, `sensors`) es Rust puro sin dependencias de ESP-IDF y puede reutilizarse directamente en el backend Tauri.

El virtual gateway es la primera sección de la Operator App. Establece el scaffold Tauri que luego reutilizará el flash wizard (`operator-flash-app`).

## Goals / Non-Goals

**Goals:**
- Gateway completamente en software: sin ESP32, sin radio LoRa, sin WiFi
- Reutilizar código del firmware existente vía crate compartido en el workspace Cargo
- UI con control start/stop, log en tiempo real, configuración de OTAA keys y host ChirpStack
- Estado de la sesión en memoria (no persistente entre reinicios de la app)
- Scaffold Tauri mínimo con navegación lateral extensible por futuros changes

**Non-Goals:**
- No persiste sesión LoRaWAN entre reinicios de la app (reinicia OTAA al arrancar)
- No simula RF ni canal LoRa (inyecta UDP directo al Gateway Bridge de ChirpStack)
- No reemplaza el gateway ESP32 en producción
- No implementa el flash wizard (eso es `operator-flash-app`)

## Decisions

### Workspace Cargo compartido entre firmware y operator-app
**Decisión**: Extraer los módulos Rust puros del firmware (`lorawan`, `udp_forwarder`, `payload`, `sensors`) a un crate `weather-core` en el workspace raíz. Tanto `firmware/` como `operator-app/src-tauri/` lo declaran como dependencia.

**Alternativas:**
- Duplicar el código en operator-app: rompe DRY, diverge al actualizar firmware
- Importar firmware/ completo como dependencia: arrastra dependencias ESP-IDF que no compilan en x86

**Rationale**: Los módulos `lorawan`, `udp_forwarder`, `payload` y `sensors` ya son Rust puro (sin `esp_idf_*`). Separarlos en `weather-core/` los hace testeables en el host y reutilizables. Es el paso de madurez natural del codebase.

### Tarea tokio en el backend Tauri, no proceso separado
**Decisión**: El gateway virtual corre como una tarea `tokio::spawn` dentro del proceso Tauri, controlada mediante comandos Tauri (`start_gateway`, `stop_gateway`). El estado se comparte con `Arc<Mutex<GatewayState>>` en el `AppState`.

**Alternativas:**
- Sidecar separado (proceso hijo): más aislamiento pero IPC complejo y distribución más difícil
- Web Worker en el frontend: imposible acceder a UDP desde JS en Tauri

**Rationale**: Tauri ya corre un runtime tokio. La tarea puede emitir eventos al frontend con `app_handle.emit()` para el log en tiempo real. El control start/stop es trivial con un `CancellationToken`. Sin overhead de IPC.

### Sesión LoRaWAN en memoria, OTAA en cada arranque
**Decisión**: La sesión (DevAddr, NwkSKey, AppSKey, FCnt) se guarda solo en memoria. Cada vez que el operario inicia el gateway, hace OTAA fresh.

**Alternativas:**
- Persistir sesión en Tauri Store: evita un join por arranque pero añade estado mutable persistente

**Rationale**: El virtual gateway es una herramienta de verificación de infraestructura, no un dispositivo de producción. El join OTAA es parte del test (verifica que ChirpStack procesa JoinRequests correctamente). Un join fallido es información útil, no un error a ocultar.

### OTAA keys: entrada manual en la UI + carga desde nvs_mock.csv
**Decisión**: La UI muestra tres campos editables (DevEUI, AppEUI, AppKey) con un botón "Cargar desde nvs_mock.csv" que lee el archivo del proyecto vía Tauri dialog.

**Alternativas:**
- Solo hardcodear: poco flexible para distintos entornos
- Solo CSV: obliga al operario a tener el archivo a mano

**Rationale**: El flujo más común para el equipo de desarrollo es cargar desde `firmware/nvs_mock.csv`. La entrada manual cubre el caso de entornos distintos (staging, producción).

## Data Flow

```
  Operator App (Tauri)
  ┌─────────────────────────────────────────────────────────┐
  │  React UI                                               │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │  VirtualGatewayPanel                             │   │
  │  │  [▶ Iniciar] [■ Detener]                         │   │
  │  │  DevEUI / AppEUI / AppKey  [Cargar CSV]          │   │
  │  │  ChirpStack host: localhost:1700                 │   │
  │  │  Intervalo: 30s                                  │   │
  │  │  ──────────────────────────────────────────────  │   │
  │  │  Log: > OTAA join ok dev_addr=01A2B3C4           │   │
  │  │        > Uplink #3 temp=23.1°C hum=58%           │   │
  │  └──────────────────────────────────────────────────┘   │
  │         │ invoke("start_gateway", config)               │
  │         ▼                                               │
  │  Rust backend (tokio)                                   │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │  GatewayTask (tokio::spawn)                      │   │
  │  │  ┌────────────────────────────────────────────┐  │   │
  │  │  │  loop {                                    │  │   │
  │  │  │    1. send_pull_data (keepalive 30s)       │  │   │
  │  │  │    2. recv PULL_RESP → send_tx_ack         │  │   │
  │  │  │    3. MockEnvSensor.read() → BinaryPayload │  │   │
  │  │  │    4. LorawanSession.encrypt_uplink()      │  │   │
  │  │  │    5. build_rxpk_json() → send_push_data() │  │   │
  │  │  │    6. emit("gateway_log", msg) al frontend │  │   │
  │  │  │    7. sleep(interval)                      │  │   │
  │  │  │  }                                         │  │   │
  │  │  └────────────────────────────────────────────┘  │   │
  │  └──────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────┘
         │ UDP (Semtech Packet Forwarder Protocol)
         ▼
  ChirpStack Gateway Bridge :1700
         │ MQTT
         ▼
  ChirpStack Network Server
         │ MQTT event/up
         ▼
  FastAPI backend → PostgreSQL → Frontend dashboard
```

## Estado de la tarea gateway

```
  [Detenido]
      │  start_gateway(config)
      ▼
  [Conectando / OTAA join]
      │  JoinAccept recibido
      ▼
  [Corriendo] ──── stop_gateway() ──▶ [Detenido]
      │  error UDP / timeout
      ▼
  [Error] ──── retry manual ──▶ [Conectando]
```

## Estructura de archivos

```
weather-core/           ← nuevo crate compartido (workspace member)
  Cargo.toml
  src/
    lib.rs
    lorawan/            ← movido desde firmware/src/lorawan/
    udp_forwarder/      ← movido desde firmware/src/udp_forwarder/
    payload/            ← movido desde firmware/src/payload/
    sensors/            ← movido desde firmware/src/sensors/

operator-app/
  package.json          ← React frontend
  src/
    App.tsx
    components/
      Sidebar.tsx
      VirtualGatewayPanel.tsx
      GatewayLog.tsx
  src-tauri/
    Cargo.toml          ← depende de weather-core
    src/
      main.rs
      commands/
        gateway.rs      ← start_gateway, stop_gateway, load_nvs_csv
      state.rs          ← AppState con Arc<Mutex<GatewayState>>
      gateway/
        task.rs         ← tokio task principal del gateway
```

## Risks / Trade-offs

- **Split del crate firmware/** → Si los módulos tienen imports de ESP-IDF mezclados con lógica pura, la extracción puede requerir refactors. Mitigación: hacer spike de compilación del crate `weather-core` en el host antes de escribir el resto.
- **Versión de tokio en Tauri**: Tauri 2.x usa tokio internamente; hay que asegurarse de no crear un segundo runtime. Mitigación: usar `tauri::async_runtime::spawn` en lugar de `tokio::spawn` directamente.
- **OTAA crypto en host**: el módulo `lorawan::crypto` usa AES puro (sin aceleración de hardware). En el ESP32 era suficiente; en el host es trivialmente rápido.

## Migration Plan

1. Crear crate `weather-core/` en el workspace raíz y mover módulos puros del firmware
2. Actualizar `firmware/Cargo.toml` para depender de `weather-core` en lugar de tener los módulos inline
3. Verificar que el firmware compila igual (compilación cruzada xtensa no se ve afectada)
4. Crear `operator-app/` con scaffold Tauri mínimo
5. Implementar `GatewayTask` en `src-tauri/src/gateway/task.rs` usando `weather-core`
6. Implementar la UI React

Rollback: si el split del crate rompe la compilación del firmware, revertir el workspace al estado anterior; los módulos son código inmutable bien conocido.

## Open Questions

- ¿El `MockEnvironmentSensor` actual genera variación suficientemente realista para testear los gráficos, o necesita un modo de variación más configurable desde la UI? (Probable respuesta: el ciclo triangular actual es suficiente para infraestructura; la variación visual no es el objetivo.)
