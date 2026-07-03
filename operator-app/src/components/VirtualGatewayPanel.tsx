import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import GatewayLog, { LogEntry } from "./GatewayLog";
import { fetchUsers, createStation, claimStation, getBackendUrl, BackendUser } from "../api/backend";

interface GatewayConfig {
  dev_eui: string;
  app_eui: string;
  app_key: string;
  host: string;
  interval_secs: number;
}

type GatewayStatus = "stopped" | "connecting" | "running" | "error";

const STATUS_LABEL: Record<GatewayStatus, string> = {
  stopped: "Detenido",
  connecting: "Conectando...",
  running: "Corriendo",
  error: "Error",
};

const STATUS_COLOR: Record<GatewayStatus, string> = {
  stopped: "#64748b",
  connecting: "#f59e0b",
  running: "#22c55e",
  error: "#ef4444",
};

function isHex(s: string, len: number): boolean {
  return /^[0-9a-fA-F]+$/.test(s.replace(/[:\- ]/g, "")) &&
    s.replace(/[:\- ]/g, "").length === len * 2;
}

function UserSelect({
  users,
  value,
  onChange,
  disabled,
}: {
  users: BackendUser[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const selected = users.find((u) => u.id === value);
  const [query, setQuery] = useState(selected?.username ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep input text in sync when selection changes externally (e.g. on load)
  useEffect(() => {
    if (selected) setQuery(selected.username);
  }, [selected?.username]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selected?.username ?? "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected?.username]);

  const filtered = query.trim()
    ? users.filter((u) => u.username.toLowerCase().includes(query.toLowerCase()))
    : users;

  function handleSelect(u: BackendUser) {
    onChange(u.id);
    setQuery(u.username);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className="field-input"
        style={{ width: "100%" }}
        placeholder="Buscar usuario…"
        value={query}
        disabled={disabled}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: "6px",
          overflow: "hidden", maxHeight: "160px", overflowY: "auto",
        }}>
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "8px 10px", background: u.id === value ? "#2d3148" : "transparent",
                color: u.id === value ? "#60a5fa" : "#e2e8f0",
                border: "none", cursor: "pointer", fontSize: "13px", fontFamily: "monospace",
              }}
              onMouseEnter={(e) => { if (u.id !== value) (e.currentTarget as HTMLButtonElement).style.background = "#232638"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = u.id === value ? "#2d3148" : "transparent"; }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(u)}
            >
              {u.username}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VirtualGatewayPanel() {
  const [config, setConfig] = useState<GatewayConfig>(() => {
    try {
      const saved = localStorage.getItem("gateway_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        // OTAA keys are not persisted for security — only host and interval
        return { dev_eui: "", app_eui: "", app_key: "", host: parsed.host ?? "127.0.0.1:1700", interval_secs: parsed.interval_secs ?? 30 };
      }
    } catch {}
    return { dev_eui: "", app_eui: "", app_key: "", host: "127.0.0.1:1700", interval_secs: 30 };
  });
  const [status, setStatus] = useState<GatewayStatus>("stopped");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(() =>
    localStorage.getItem("gateway_selected_user_id") ?? ""
  );

  // Persist host + interval (not OTAA keys)
  useEffect(() => {
    localStorage.setItem("gateway_config", JSON.stringify({ host: config.host, interval_secs: config.interval_secs }));
  }, [config.host, config.interval_secs]);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((e) => console.error("fetchUsers failed:", e));
  }, []);

  useEffect(() => {
    localStorage.setItem("gateway_selected_user_id", selectedUserId);
  }, [selectedUserId]);

  useEffect(() => {
    let cancelled = false;
    const unlisten: (() => void)[] = [];

    const setupListeners = async () => {
      const unsubLog = await listen<{ level: string; msg: string; ts: string }>(
        "gateway_log",
        (e) => {
          setLogs((prev) => {
            const next = [...prev, { level: e.payload.level, msg: e.payload.msg, ts: e.payload.ts }];
            return next.length > 500 ? next.slice(next.length - 500) : next;
          });
        }
      );
      const unsubStatus = await listen<string>("gateway_status", (e) => {
        setStatus(e.payload as GatewayStatus);
      });
      if (cancelled) {
        unsubLog();
        unsubStatus();
        return;
      }
      unlisten.push(unsubLog, unsubStatus);
    };

    setupListeners();
    return () => {
      cancelled = true;
      unlisten.forEach((u) => u());
    };
  }, []);

  const isRunning = status === "running" || status === "connecting";

  const configValid =
    isHex(config.dev_eui, 8) &&
    (config.app_eui === "" || isHex(config.app_eui, 8)) &&
    isHex(config.app_key, 16) &&
    config.host.trim().length > 0 &&
    selectedUserId !== "";

  async function handleStart() {
    try {
      const devEuiClean = config.dev_eui.replace(/[:\- ]/g, "").toLowerCase();
      const short = devEuiClean.slice(0, 8);
      const stationId = `dev-${short}`;
      // Intenta crear; si ya existe (409) la reclaima para este usuario
      await createStation({
        name: `Auto ${short}`,
        location: "Virtual",
        status: "online",
        user_id: selectedUserId || null,
      });
      await claimStation(stationId, selectedUserId);
      await invoke("start_gateway", { config });
    } catch (e) {
      setLogs((prev) => [
        ...prev,
        { level: "ERROR", msg: String(e), ts: new Date().toTimeString().slice(0, 8) },
      ]);
    }
  }

  async function handleStop() {
    await invoke("stop_gateway");
  }


  async function handleLoadCsv() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (!path) return;
    try {
      const loaded = await invoke<GatewayConfig>("load_nvs_csv", { path });
      setConfig((prev) => ({
        ...prev,
        dev_eui: loaded.dev_eui,
        app_eui: loaded.app_eui,
        app_key: loaded.app_key,
      }));
    } catch (e) {
      alert(String(e));
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Gateway Virtual</h2>
        <div className="status-badge" style={{ color: STATUS_COLOR[status] }}>
          <span className="status-dot" style={{ background: STATUS_COLOR[status] }} />
          {STATUS_LABEL[status]}
        </div>
      </div>

      <div className="panel-body">
        <div className="config-section">
          <div className="field-row">
            <label className="field-label">Usuario</label>
            <UserSelect
              users={users}
              value={selectedUserId}
              onChange={setSelectedUserId}
              disabled={isRunning}
            />
          </div>

          <div className="divider" />

          <div className="field-row">
            <label className="field-label">DevEUI</label>
            <input
              className={`field-input ${config.dev_eui && !isHex(config.dev_eui, 8) ? "invalid" : ""}`}
              value={config.dev_eui}
              onChange={(e) => setConfig((c) => ({ ...c, dev_eui: e.target.value }))}
              placeholder="0011223344556677"
              disabled={isRunning}
            />
          </div>
          <div className="field-row">
            <label className="field-label">AppEUI</label>
            <input
              className={`field-input ${config.app_eui && !isHex(config.app_eui, 8) ? "invalid" : ""}`}
              value={config.app_eui}
              onChange={(e) => setConfig((c) => ({ ...c, app_eui: e.target.value }))}
              placeholder="0000000000000000"
              disabled={isRunning}
            />
          </div>
          <div className="field-row">
            <label className="field-label">AppKey</label>
            <input
              className={`field-input ${config.app_key && !isHex(config.app_key, 16) ? "invalid" : ""}`}
              value={config.app_key}
              onChange={(e) => setConfig((c) => ({ ...c, app_key: e.target.value }))}
              placeholder="00112233445566778899AABBCCDDEEFF"
              disabled={isRunning}
            />
          </div>
          <div className="field-row">
            <button className="btn btn-secondary" onClick={handleLoadCsv} disabled={isRunning}>
              Cargar desde nvs_mock.csv
            </button>
          </div>

          <div className="divider" />

          <div className="field-row">
            <label className="field-label">ChirpStack host</label>
            <input
              className="field-input"
              value={config.host}
              onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
              placeholder="localhost:1700"
              disabled={isRunning}
            />
          </div>
          <div className="field-row">
            <label className="field-label">Intervalo (s)</label>
            <input
              className="field-input field-input--sm"
              type="number"
              min={5}
              max={300}
              value={config.interval_secs}
              onChange={(e) =>
                setConfig((c) => ({ ...c, interval_secs: parseInt(e.target.value, 10) || 30 }))
              }
              disabled={isRunning}
            />
          </div>

          <div className="actions">
            {!isRunning ? (
              <button
                className="btn btn-primary"
                onClick={handleStart}
                disabled={!configValid}
              >
                ▶ Iniciar
              </button>
            ) : (
              <button className="btn btn-danger" onClick={handleStop}>
                ■ Detener
              </button>
            )}
          </div>
        </div>

        <GatewayLog entries={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  );
}
