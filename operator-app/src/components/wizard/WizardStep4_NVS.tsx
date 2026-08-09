import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WizardState } from "./types";

type Phase = "idle" | "flashing" | "verifying" | "ok" | "error";

interface LogLine {
  ts: string;
  text: string;
  level: "info" | "ok" | "err";
}

interface FlashLogEvent {
  level: string;
  text: string;
}

interface Props {
  state: WizardState;
  onBack: () => void;
  onNext: () => void;
}

export default function WizardStep4_NVS({ state, onBack, onNext }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function addLog(text: string, level: LogLine["level"] = "info") {
    const ts = new Date().toLocaleTimeString("es-AR", { hour12: false });
    setLogs((prev) => [...prev, { ts, text, level }]);
  }

  const nvsParams = {
    dev_eui_hex: state.devEui,
    app_eui_hex: state.appEui,
    app_key_hex: state.appKey,
    wifi_ssid: state.wifiSsid,
    wifi_pass: state.wifiPass,
  };

  async function startNvsFlash() {
    setPhase("flashing");
    setLogs([]);
    setVerified(null);

    const unlisten = await listen<FlashLogEvent>("nvs-log", (e) => {
      addLog(e.payload.text, e.payload.level as LogLine["level"]);
    });

    try {
      // 8.1: flash NVS en 0x9000
      await invoke("flash_nvs", { port: state.port, params: nvsParams });

      // 8.2: verify read-back
      setPhase("verifying");
      const ok = await invoke<boolean>("verify_nvs", {
        port: state.port,
        params: nvsParams,
      });
      setVerified(ok);
      setPhase(ok ? "ok" : "error");
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setPhase("error");
      addLog(`✕ ${msg}`, "err");
    } finally {
      unlisten();
    }
  }

  const steps = [
    {
      label: `Generar partición NVS (${state.devEui})`,
      done: ["verifying", "ok", "error"].includes(phase) && phase !== "idle",
      active: phase === "flashing",
    },
    {
      label: `Flash en 0x9000 (${state.port})`,
      done: ["verifying", "ok"].includes(phase),
      active: phase === "flashing",
    },
    {
      label: "Verificar partición (read-back byte a byte)",
      done: phase === "ok",
      active: phase === "verifying",
    },
  ];

  const logColor = (level: LogLine["level"]) => {
    if (level === "ok") return "#4ade80";
    if (level === "err") return "#f87171";
    return "#cbd5e1";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Flash de partición NVS
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Escribe las claves OTAA y credenciales WiFi en la partición NVS del ESP32.
        </p>
      </div>

      {/* Parámetros */}
      <div style={{ background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontFamily: "monospace" }}>
        <KV label="lorawan/dev_eui" value={state.devEui} />
        <KV label="lorawan/app_eui" value={state.appEui} />
        <KV label="lorawan/app_key" value={state.appKey} />
        <KV label="wifi/ssid" value={state.wifiSsid} />
        <KV label="wifi/pass" value={"•".repeat(Math.min(state.wifiPass.length, 12))} />
      </div>

      {/* Progress steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s) => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 14px",
            background: s.active ? "#1e293b" : "#1a1d2e",
            border: `1px solid ${s.done ? "#166534" : s.active ? "#1d4ed8" : "#2d3148"}`,
            borderRadius: 8,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              background: s.done ? "#166534" : s.active ? "#1d4ed8" : "#2d3148",
              color: s.done || s.active ? "#fff" : "#64748b",
            }}>
              {s.done ? "✓" : s.active ? "…" : "○"}
            </div>
            <span style={{ fontSize: 13, color: s.done ? "#4ade80" : s.active ? "#93c5fd" : "#64748b" }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Log */}
      {(logs.length > 0 || phase !== "idle") && (
        <div className="log-section" style={{ maxHeight: 200 }}>
          <div className="log-header">
            <span className="log-title">Salida de esptool</span>
            {phase === "verifying" && <span style={{ fontSize: 12, color: "#60a5fa" }}>● verificando</span>}
            {phase === "ok" && <span style={{ fontSize: 12, color: "#4ade80" }}>✓ ok</span>}
            {phase === "error" && <span style={{ fontSize: 12, color: "#f87171" }}>✕ error</span>}
          </div>
          <div className="log-container">
            {logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-ts">{l.ts}</span>
                <span style={{ color: logColor(l.level), fontFamily: "monospace", fontSize: 12 }}>
                  {l.text}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Resultado verificación */}
      {verified === true && (
        <div style={{ padding: "12px 14px", background: "#14532d", border: "1px solid #166534", borderRadius: 8, fontSize: 13, color: "#4ade80" }}>
          ✓ Partición NVS verificada correctamente (coincide byte a byte).
        </div>
      )}
      {verified === false && (
        <div style={{ padding: "12px 14px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
          ✕ La verificación falló: los datos leídos no coinciden con el binario generado.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={phase === "flashing" || phase === "verifying"}
        >
          ← Atrás
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {phase === "error" && (
            <button className="btn btn-secondary" onClick={() => { setPhase("idle"); setLogs([]); }}>
              Reintentar
            </button>
          )}
          {phase === "idle" && (
            <button className="btn btn-primary" onClick={startNvsFlash}>
              Flash NVS
            </button>
          )}
          {phase === "ok" && (
            <button className="btn btn-primary" onClick={onNext}>
              Siguiente → ChirpStack
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, color: "#94a3b8" }}>
      <span style={{ color: "#64748b", minWidth: 160 }}>{label}</span>
      <span style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
