# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Autonomous weather station: ESP32 (Rust) firmware reads a DHT22 sensor plus
pulse-counting rain gauge and anemometer inputs, transmits readings over
LoRaWAN (star topology, EU433 band plan, OTAA) using SX1278 modules to a
single-channel gateway ESP32, which forwards packets via the Semtech UDP
Packet Forwarder Protocol to a self-hosted ChirpStack network server; ChirpStack
delivers uplinks to a FastAPI backend (via MQTT) storing time-series data in
InfluxDB. A React frontend visualizes the history, and a Kotlin/Jetpack Compose
Android app handles field calibration over BLE plus verification against the
backend API. 3D-printed enclosure files round out the deliverables.

The full stack (firmware, gateway, backend, Android app, 3D models) is only
partially implemented today:
- `frontend/` — a React + Vite + TypeScript dashboard shell exists with mock
  data (no real API integration yet).
- Firmware, gateway, backend, Android, and 3D components do not have code
  yet — only OpenSpec planning artifacts (see below) describing the first
  firmware spike.

This repo is driven by **OpenSpec spec-driven development** — read
`openspec/config.yaml` first; it contains the authoritative project context,
architecture decisions, and per-component rules (proposal/specs/design/tasks)
that apply to every change. Do not duplicate that content from memory —
re-read it, since the stack section there is explicitly marked as the
living source of truth and may be amended as real implementation choices
diverge from the initial recommendation.

## OpenSpec workflow

This project uses the `openspec` CLI (installed at `/usr/sbin/openspec`) to
manage spec-driven changes under `openspec/`:
- `openspec/config.yaml` — schema (`spec-driven`) and project rules.
- `openspec/specs/<capability>/spec.md` — current main specs (source of
  truth for shipped capabilities).
- `openspec/changes/<change-name>/` — active change proposals, each with
  `proposal.md`, `design.md`, `tasks.md`, and `specs/<capability>/spec.md`
  (delta spec).
- `openspec/changes/archive/` — completed, archived changes.

Useful commands:
```bash
openspec list --json                              # list active changes
openspec status --change "<name>" --json           # artifact/task progress
openspec instructions <artifact-id> --change "<name>" --json
```

Several OpenSpec skills exist (in `.codex/skills/`) and are also exposed as
Claude Code skills: `openspec-explore` (think/investigate, never implement),
`openspec-propose` (scaffold a new change with proposal/design/tasks),
`openspec-apply-change` (implement tasks from an existing change one at a
time, checking off `tasks.md` as you go), `openspec-archive-change` (archive
a finished change), `openspec-sync-specs` (merge a change's delta specs into
the main specs). Prefer these workflows over hand-editing files under
`openspec/` when starting, continuing, or finishing a change.

### Commit convention (enforced by project rules)

Conventional Commits, scoped by component:
```
<tipo>(<scope>): <descripción>
```
- `tipo`: feat, fix, docs, refactor, test, chore, build, perf
- `scope`: firmware, gateway, backend, frontend, android, 3d, docs
- Breaking changes: `!` after type/scope, or a `BREAKING CHANGE:` footer
  (e.g. a LoRa payload format change)

Examples: `feat(firmware): agregar lectura de pulsos del anemómetro`,
`fix(backend): corregir agregación horaria en InfluxDB`.

Each task in a change's `tasks.md` lists a suggested commit message in this
format — use it when implementing that task.

### Rules to apply when writing OpenSpec artifacts

From `openspec/config.yaml` (`rules:` section) — keep these in mind whenever
authoring or reviewing proposals/specs/design/tasks, not just when running
the OpenSpec skills:
- **Proposals** must name every affected component (firmware, gateway,
  backend, frontend, android, 3d, docs), note expected power/battery impact
  for firmware changes, flag whether comms changes alter the LoRa binary
  format or send frequency, and include a rollback plan for changes to
  firmware already deployed in the field.
- **Specs** use Given/When/Then-style scenarios; sensor requirements must
  state unit/range/resolution; LoRa requirements must state exact payload
  structure, send frequency, and behavior on signal loss; Android specs must
  separate BLE-direct calibration flows from REST-API verification flows;
  backend specs must define the API contract (paths, payloads).
- **Design docs** must include an end-to-end data-flow diagram
  (sensor → ESP32 → LoRa → gateway → backend/FastAPI → InfluxDB → frontend),
  cover error/reconnection handling (LoRa signal loss, disconnected/invalid
  sensor, gateway offline), state the InfluxDB schema (measurement, tags,
  fields) for backend changes, note firmware memory/CPU impact, and list
  BLE services/characteristics for Android changes.
- **Tasks** are grouped by component; firmware tasks must say whether they
  need real hardware (not just simulation); Android tasks must say whether
  they need a field test against the real station.

## Architecture (target, per OpenSpec context)

```
DHT22 + rain-gauge/anemometer pulses
        │
   ESP32 sensor node (Rust, esp-idf-hal/svc)
   └── lr1121-modem-e crate (FFI → SWDR009 C SDK)
        │  LR1121 runs Modem-E v2.1.0 (LoRaWAN 1.0.4 certified, in-chip stack)
        │  Band plan: AU915 sub-band 2, OTAA, uplink every 10 min
        │  Canal fijo PoC: 916.8 MHz SF7BW125 (canal 8, sub-band 2)
        │  FRMPayload 14 bytes: device_id (u8), seq (u16 LE),
        │  temp_c*100 (i16 LE), hum*100 (u16 LE), lluvia_pulsos (u16 LE),
        │  viento_pulsos (u16 LE), bateria_mv (u16 LE), crc8
        │  Pinout: SCK=18, MISO=19, MOSI=23, NSS=5, RST=14, BUSY=27, DIO1=26
        ▼
   ESP32 single-channel gateway (Rust, esp-idf-hal/svc + WiFi)
   └── lr1121-transceiver crate (FFI → lr11xx_driver SWDR001 C SDK)
        │  LR1121 in transceiver mode (factory firmware)
        │  Listens on 916.8 MHz SF7BW125 (fixed PoC channel)
        │  [POC limitation: 1 fixed channel, not full LoRaWAN spec-compliant]
        │  Semtech UDP Packet Forwarder Protocol → ChirpStack
        ▼
   ChirpStack v4 (Docker, self-hosted, AU915 sub-band 2)
        │  Decrypts FRMPayload, verifies MIC
        │  MQTT: application/{appId}/device/{devEUI}/event/up
        ▼
   FastAPI backend  ──────────────►  InfluxDB (time series)
        │  paho-mqtt client          measurement: weather_reading
        │  REST API                  (alt: Postgres+TimescaleDB)
        ├──────────────► React + Recharts/Chart.js frontend
        └──────────────► Android app (Kotlin/Compose) — verification flow
   ESP32 sensor node  ◄───── BLE ─────  Android app — calibration flow
```

**Hardware note**: LR1121 modules (sub-GHz HF port: 150–960 MHz) are used
throughout, operating in the AU915 band (915–928 MHz) — Argentina's (ENACOM)
LoRaWAN regulatory band plan. Breakout boards (Waveshare Core1121, Seeed Wio-LR1121)
include U.FL/SMA connectors for external antennas.

**Dual driver approach**:
- **Nodo sensor**: LR1121 runs **Modem-E v2.1.0** (LoRaWAN stack embedded in chip).
  The ESP32 uses `lr1121-modem-e` crate (wraps SWDR009 via FFI).
- **Gateway**: LR1121 in **transceiver mode** (factory firmware) for raw LoRa RX.
  The ESP32 uses `lr1121-transceiver` crate (wraps SWDR001/lr11xx_driver via FFI).

The **LR1121/AU915 migration** is tracked in
`openspec/changes/migrate-lr1121-au915/` — supersedes the archived
`migrate-lorawan-sx1278` change (SX1278/EU433, lacked antenna connectors)
and the archived `migrate-lorawan-sx1276` change (SX1276/AU915 hardware not acquired).

## Frontend (`frontend/`)

React 19 + TypeScript + Vite. Package manager: pnpm (see
`pnpm-lock.yaml`/`pnpm-workspace.yaml`).

```bash
cd frontend
pnpm install
pnpm dev        # vite dev server on 127.0.0.1
pnpm build      # tsc -b && vite build
pnpm preview    # preview production build
```

There is no test or lint script configured yet. `App.tsx` currently renders
the main dashboard shell (sidebar nav, station status panel, metric cards)
entirely from in-file mock data (`station`, `navItems`, `metrics`) — no API
client exists yet, and only the "Dashboard" nav item is wired as active;
other nav items are visual-only per the `add-main-dashboard-ui` change spec.
