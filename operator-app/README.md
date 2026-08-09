# Operator App

Aplicación de escritorio (Tauri v2 + React) para aprovisionar nodos de la
estación meteorológica: flashea firmware, escribe claves OTAA + WiFi en la
partición NVS del ESP32, y registra el dispositivo en ChirpStack v4.

---

## Instalación (usuario final)

Descargá el instalador correspondiente a tu sistema desde
[GitHub Releases](https://github.com/Ignacio-Ucedo/estacion_meteorologica/releases).

| Plataforma | Archivo | Instrucciones |
|------------|---------|---------------|
| Linux | `.AppImage` | `chmod +x OperatorApp_*.AppImage && ./OperatorApp_*.AppImage` |
| Linux | `.deb` | `sudo dpkg -i operator-app_*.deb` |
| Windows | `.msi` | Doble clic → siguiente → instalar |
| macOS | `.dmg` | Abrir → arrastrar a Aplicaciones |

### Linux — permisos USB

Para que la app pueda acceder a los puertos serie (ESP32 por USB), creá un
archivo de reglas udev:

```bash
sudo tee /etc/udev/rules.d/99-esp32-usb.rules <<'EOF'
# Silicon Labs CP210x (CP2102/CP2104)
SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", MODE="0666", TAG+="uaccess"
# WCH CH340/CH341
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", MODE="0666", TAG+="uaccess"
# FTDI FT232
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", MODE="0666", TAG+="uaccess"
# ESP32-S3 nativo (USB-OTG)
SUBSYSTEM=="tty", ATTRS{idVendor}=="303a", MODE="0666", TAG+="uaccess"
EOF
sudo udevadm control --reload
sudo udevadm trigger
```

Reconectá el ESP32 después de aplicar las reglas. Alternativamente:

```bash
sudo usermod -aG dialout $USER
# Cerrar sesión y volver a iniciar para que tome efecto
```

### macOS — Gatekeeper

Si macOS bloquea la app por no estar firmada:

```bash
xattr -cr /Applications/OperatorApp.app
```

---

## Desarrollo

### Prerequisitos

- Rust (stable) + `cargo`
- Node.js ≥ 18 + npm
- **Linux**: `sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev`
  (Arch: `sudo pacman -S webkit2gtk-4.1`)
- Stack de infra corriendo: `cd infra && docker compose up -d`
- `python3 -m pip install esptool` — para el sidecar de desarrollo

### Modo desarrollo

```bash
cd operator-app
npm install
npm run tauri dev
```

El sidecar de esptool en desarrollo es un script shell (`binaries/esptool-*-linux-gnu`)
que delega a `python3 -m esptool`. En producción, el CI descarga el binario
standalone de esptool v4.8.1 y lo substituye antes de `tauri build`.

### Build local

```bash
npm run tauri build
```

> Requiere el sidecar real en `binaries/esptool-{target-triple}`.
> Descargalo desde [espressif/esptool releases](https://github.com/espressif/esptool/releases/tag/v4.8.1)
> y renombralo al triple de tu arquitectura (ej. `esptool-x86_64-unknown-linux-gnu`).

---

## Flujo de aprovisionamiento

1. **Puerto USB** — seleccioná el ESP32 conectado
2. **Configuración** — WiFi SSID/pass, host ChirpStack, DevEUI+AppKey asignados del pool
3. **Firmware** — descargá el `.bin` desde GitHub Releases o seleccioná uno local; flashealo
4. **NVS** — flashea y verifica la partición NVS con las claves OTAA y credenciales WiFi
5. **ChirpStack** — registra el device automáticamente vía API REST v4

---

## Troubleshooting

| Síntoma | Causa probable |
|---------|----------------|
| Puerto USB no aparece | Instalar udev rules (ver sección de permisos USB) |
| `Permission denied` / `[Errno 13]` en el flash | Permisos USB no configurados |
| `JoinAccept timeout` en todos los intentos | Verificar que ChirpStack tiene el device registrado con DevEUI/AppKey correcto |
| `uplink UDP falló` | Verificar que el host es `127.0.0.1:1700` y no `localhost:1700` |
| App no abre en Linux | Instalar `libwebkit2gtk-4.1-0` |
| Pool agotado | Importar un nuevo CSV con pares DevEUI+AppKey vía el panel de configuración |
