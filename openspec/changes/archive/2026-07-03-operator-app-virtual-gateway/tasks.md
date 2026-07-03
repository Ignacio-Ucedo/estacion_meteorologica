## 1. Extraer crate `weather-core` (prerequisito compartido con firmware)

- [x] 1.1 Crear `weather-core/Cargo.toml` como workspace member en `Cargo.toml` raíz. Dependencias: `aes`, `cmac`, `rand`, `serde`. Sin dependencias ESP-IDF. Commit sugerido: `chore(firmware): extraer weather-core como crate compartido del workspace`.
- [x] 1.2 Mover módulos Rust puros del firmware a `weather-core/src/`: `lorawan/` (crypto, frame, session), `udp_forwarder/`, `payload/`, `sensors/`. Verificar que no tienen imports de `esp_idf_*` ni `esp_idf_hal`. Commit incluido en 1.1.
- [x] 1.3 Actualizar `firmware/Cargo.toml` para referenciar `weather-core = { path = "../weather-core" }` y actualizar los `use` statements del firmware para apuntar a `weather_core::`. Verificar que `cargo build --target xtensa-esp32-espidf` sigue compilando sin cambios de comportamiento. Commit sugerido: `refactor(firmware): usar weather-core para módulos compartidos`.
- [x] 1.4 Verificar que `weather-core` compila en el host (`cargo build -p weather-core`) sin toolchain xtensa. No requiere hardware. Commit incluido en 1.3.

## 2. Scaffold de la Operator App (Tauri)

- [x] 2.1 Inicializar el proyecto Tauri en `operator-app/` con `create-tauri-app` (React + TypeScript + Vite). Configurar `tauri.conf.json`: nombre `Operator App`, identificador `com.estacion.operator`. Commit sugerido: `feat(operator-app): scaffold inicial Tauri + React`.
- [x] 2.2 Implementar `Sidebar.tsx` con ítem "Gateway Virtual" activo y estructura extensible para futuros ítems (Flash ESP32, Setup ChirpStack). Aplicar estilos mínimos. Commit incluido en 2.1.
- [x] 2.3 Verificar que `tauri dev` levanta la app en Linux con la barra lateral visible y el panel principal vacío. No requiere hardware. **BLOQUEADO: requiere `sudo pacman -S webkit2gtk-4.1` en el sistema.**

## 3. Backend Rust — Integración de `weather-core` y estado compartido

- [x] 3.1 Agregar `weather-core = { path = "../../weather-core" }` a `operator-app/src-tauri/Cargo.toml`. Agregar `tokio-util` (para `CancellationToken`). Commit incluido en tarea de implementación.
- [x] 3.2 Implementar `operator-app/src-tauri/src/state.rs`: struct `GatewayConfig` (dev_eui, app_eui, app_key, host, interval_secs) y `GatewayState` (status: Stopped/Connecting/Running/Error, cancellation token, log buffer). Exponer como `AppState` en Tauri. Commit sugerido: `feat(operator-app): agregar AppState con GatewayState`.
- [x] 3.3 Implementar `operator-app/src-tauri/src/gateway/task.rs`: tarea tokio que replica el loop de `firmware/src/bin/gateway-node-mock.rs` usando `weather_core::udp_forwarder` y `weather_core::lorawan`. Emite eventos Tauri `gateway_log` con cada acción. Soporta cancelación via `CancellationToken`. No requiere hardware. Commit sugerido: `feat(operator-app): implementar GatewayTask tokio con weather-core`.
- [x] 3.4 Implementar comandos Tauri en `operator-app/src-tauri/src/commands/gateway.rs`: `start_gateway(config: GatewayConfig)` que spawna la tarea, `stop_gateway()` que cancela el token, `load_nvs_csv(path: String)` que parsea el CSV y retorna `GatewayConfig` parcial. Commit incluido en 3.3.

## 4. Frontend — Panel de Gateway Virtual

- [x] 4.1 Implementar `VirtualGatewayPanel.tsx`: formulario con campos DevEUI, AppEUI, AppKey, host ChirpStack, intervalo. Botón "Cargar desde CSV" que invoca `load_nvs_csv`. Validación de formato hex en cada campo. Commit sugerido: `feat(operator-app): implementar VirtualGatewayPanel con formulario de configuración`.
- [x] 4.2 Implementar botones "Iniciar" / "Detener" que invocan `start_gateway` / `stop_gateway`. Mostrar estado (`detenido` / `conectando` / `corriendo` / `error`) con indicador visual (color + texto). Commit incluido en 4.1.
- [x] 4.3 Implementar `GatewayLog.tsx`: lista de líneas con timestamp, nivel y mensaje. Scroll automático al último evento. Límite de 500 líneas con purga de las más antiguas. Suscribirse al evento Tauri `gateway_log`. Commit sugerido: `feat(operator-app): implementar GatewayLog con scroll automático`.
- [x] 4.4 Implementar persistencia de configuración (host + intervalo) usando localStorage. Las OTAA keys no se persisten. Commit sugerido: `feat(operator-app): persistir configuración de host e intervalo entre sesiones`.

## 5. Validación end-to-end

- [x] 5.1 Con `docker compose up -d` (ChirpStack + backend corriendo) y el device con las OTAA keys del `nvs_mock.csv` registrado en ChirpStack: iniciar el gateway virtual desde la app, verificar que el log muestra JoinAccept y uplinks sucesivos. No requiere hardware.
- [x] 5.2 Verificar en el dashboard React que los gráficos muestran datos con `device_id=3` y valores de temperatura/humedad que varían entre uplinks. No requiere hardware.
- [x] 5.3 Verificar que al detener el gateway y volverlo a iniciar, se realiza un nuevo OTAA join exitoso (la sesión anterior en ChirpStack se reemplaza correctamente). No requiere hardware.
- [x] 5.4 Verificar que un integrante del grupo sin ESP32 puede ejecutar `tauri dev` y ver datos reales en el dashboard siguiendo solo los pasos: `docker compose up -d`, cargar nvs_mock.csv en la app, clic en Iniciar. No requiere hardware.
