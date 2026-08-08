# Resultados — Validación Etapa 1: Gateway Mock

**Fecha**: 2026-08-08  
**Duración sesión**: ~5 h  
**Resultado global**: PASS ✓

---

## Pipeline validado

```
Operator App (Virtual Gateway)
  → ChirpStack AU915 (Docker, 127.0.0.1:1700)
  → HTTP integration → FastAPI backend
  → InfluxDB
  → React frontend
```

---

## Observaciones por fase

### OTAA Join
- JoinAccept recibido dentro de los 30 s del primer JoinRequest ✓
- `dev_addr` asignado: `013a2352`

### Uplinks AU915
- Frecuencia: **916.8 MHz** (canal 8, sub-band 2) ✓
- Modulación: SF7BW125, CR 4/5 ✓
- `regionConfigId`: `au915_2` ✓
- FCnt sesión: 11 → 20+ (incremento continuo, sin pérdidas) ✓
- Intervalo entre uplinks: ~31 s ✓

### Payload (14 bytes)
- `device_id`: 3 ✓
- `seq`: incrementa 1:1 con FCnt ✓
- `temp_c`: ciclo triangular 15.0–25.0 °C — observado 15.13–17.91 °C en la sesión ✓
- `hum`: ciclo correspondiente (~70–75 %) ✓
- `lluvia_pulsos` / `viento_pulsos`: valores variables ✓
- `bateria_mv`: **4200** (spec decía 3700 — desvío menor, valor constante y consistente)
- CRC8: OK ✓

### Backend / InfluxDB
- Endpoint `/integrations/chirpstack/uplink` recibe POSTs correctamente ✓
- 8+ puntos en `weather_reading` con `device_id=3` en los últimos 6 min ✓
- Temperatura variando entre lecturas (no valor fijo) ✓

### Frontend
- Dashboard carga datos reales del backend (`http://localhost:8000`) ✓
- Temperatura y humedad variables, ciclo triangular visible ✓
- Sin errores en consola DevTools ✓

---

## Bugs encontrados y resueltos

| # | Descripción | Causa raíz | Resolución |
|---|---|---|---|
| 1 | `Invalid device-profile region` en JoinRequest | Device profile `esp32-sensor-eu433` (EU433) asignado al device; existía también `esp32-sensor-au915` pero el device apuntaba al viejo | Actualizar `device_profile_id` del device vía gRPC; fix en `chirpstack-provision.py` para detectar y corregir profile incorrecto |
| 2 | HTTP integration apuntaba a `localhost:8000` | Al reescribir `sync_chirpstack` en Tauri se perdió la sustitución `localhost→backend` | Fix en `chirpstack.rs`; integración actualizada a `http://backend:8000` vía gRPC |
| 3 | `cargo build` fallaba en crates lr1121 | API `esp-idf-hal 0.46.2` cambió: `PinDriver<Pin, Mode>` → `PinDriver<Mode>`, `is_low()`/`is_high()` retornan `bool` directamente | Actualizar firmas en `lr1121-modem-e/src/lib.rs` y `lr1121-transceiver/src/lib.rs` |
| 4 | `vite: command not found` en Operator App | `tauri.conf.json` usaba `npm run dev` pero dependencias no instaladas | Fix a `pnpm dev`; `npm install` en operator-app |
| 5 | `build_rxpk_json` — argumentos en orden incorrecto y faltaba `freq_mhz` | Firma de la función cambió (agregó `freq_mhz: f64`) sin actualizar los call sites | Corregir las dos llamadas en `operator-app/src-tauri/src/gateway/task.rs` |

---

## Desvíos del spec

- `bateria_mv=4200` en lugar de 3700. El firmware mock genera un valor fijo distinto al documentado. No afecta la validación funcional del pipeline.

---

## Latencia end-to-end observada

- Timestamp uplink en Operator App → punto visible en frontend: **< 5 s**
- (Uplink generado ~22:58:22 → punto en InfluxDB con timestamp `22:58:22.393`)

---

## Conclusión

El pipeline completo funciona sin hardware LoRa real. La Etapa 1 está validada. Las etapas 2–5 requieren hardware físico (LR1121, ESP32) y se desbloquean progresivamente según disponibilidad.
