# Operator App — Gateway Virtual

Aplicación de escritorio (Tauri + React) que simula el gateway LoRaWAN desde la PC,
sin necesitar hardware ESP32. Realiza OTAA join real contra ChirpStack y envía uplinks
sintéticos con temperatura, humedad, lluvia y viento.

## Prerequisitos

- Rust (stable) + `cargo`
- Node.js ≥ 18 + npm
- **Linux**: `webkit2gtk-4.1` — en Arch: `sudo pacman -S webkit2gtk-4.1`
- Stack de infra corriendo: `cd infra && docker compose up -d`

## Iniciar en modo desarrollo

```bash
cd operator-app
npm install
cargo tauri dev
```

## Flujo de uso

1. **Cargar claves OTAA**: clic en "Cargar desde nvs_mock.csv" → seleccionar `firmware/nvs_mock.csv`
2. **Verificar host**: campo "ChirpStack host" debe decir `127.0.0.1:1700`
3. **Iniciar**: clic en ▶ Iniciar — el log muestra `JoinAccept ok` en unos segundos
4. Los uplinks se envían cada 30 s (configurable); los datos aparecen en el dashboard React (`cd frontend && npm run dev`)

## Troubleshooting

| Síntoma | Causa probable |
|---------|----------------|
| Botón "Cargar CSV" no abre diálogo | Faltan permisos de `tauri-plugin-dialog` (ya corregido en esta versión) |
| `JoinAccept timeout` en todos los intentos | Verificar que ChirpStack tiene el device registrado con el DevEUI/AppKey del CSV; ver `infra/SETUP.md` sección 3 |
| `uplink UDP falló` | Verificar que el host es `127.0.0.1:1700` y no `localhost:1700` (en algunos sistemas `localhost` resuelve a IPv6) |
| App no abre en Linux | Instalar `webkit2gtk-4.1` |
