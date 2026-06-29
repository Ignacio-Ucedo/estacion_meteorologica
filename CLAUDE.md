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
   ESP32 sensor node (Rust, esp-rs, SX1278)
        │  LoRaWAN EU433 — 433.175 MHz SF7BW125, OTAA, uplink every 10 min
        │  FRMPayload 14 bytes: device_id (u8), seq (u16 LE),
        │  temp_c*100 (i16 LE), hum*100 (u16 LE), lluvia_pulsos (u16 LE),
        │  viento_pulsos (u16 LE), bateria_mv (u16 LE), crc8
        ▼
   ESP32 single-channel gateway (Rust, SX1278 + WiFi)
        │  [POC limitation: 1 fixed channel, not full LoRaWAN spec-compliant]
        │  Semtech UDP Packet Forwarder Protocol → ChirpStack
        ▼
   ChirpStack v4 (Docker, self-hosted, EU433)
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

**Hardware note**: SX1278 modules (137–525 MHz) are used throughout.
AU915 (902–928 MHz, Argentina's LoRaWAN regulatory band plan) would require
SX1276/SX1262; this is deferred to a future change. EU433 is used for the
prototype because it matches the available hardware.

Note the **firmware spike currently in progress** (see
`openspec/changes/spike-firmware-lora-sensors/`) deliberately diverges from
the target design above to de-risk hardware first: it uses ESP-IDF
(`esp-idf-hal`/`esp-idf-svc`) rather than bare-metal `esp-hal`, LoRa P2P
(not LoRaWAN), a debug CSV payload (`id,seq,temp,hum,pres,pulsos_lluvia,
pulsos_viento`) instead of the fixed binary payload, an MPL115A2 pressure
sensor in addition to the DHT22, and explicitly defers deep sleep,
battery/solar power, WiFi, the backend, BLE calibration, and field-range
validation to later changes.

The **LoRaWAN migration** is tracked in
`openspec/changes/migrate-lorawan-sx1278/` — it supersedes the archived
`migrate-lorawan-sx1276` change (which assumed SX1276/AU915 hardware that
was not acquired).

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
