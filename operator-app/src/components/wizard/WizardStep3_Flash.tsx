import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { WizardState } from "./types";

type Status = "idle" | "running" | "ok" | "error";

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

export default function WizardStep3_Flash({ state, onBack, onNext }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [firmwarePath, setFirmwarePath] = useState<string>("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al último log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function addLog(text: string, level: LogLine["level"] = "info") {
    const ts = new Date().toLocaleTimeString("es-AR", { hour12: false });
    setLogs((prev) => [...prev, { ts, text, level }]);
  }

  async function selectFirmware() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Firmware ESP32", extensions: ["bin"] }],
    });
    if (typeof selected === "string") {
      setFirmwarePath(selected);
    }
  }

  async function startFlash() {
    if (!firmwarePath) return;
    setStatus("running");
    setLogs([]);
    setErrorMsg(null);

    // Escuchar eventos de log en tiempo real
    const unlisten = await listen<FlashLogEvent>("flash-log", (e) => {
      addLog(e.payload.text, e.payload.level as LogLine["level"]);
    });

    try {
      await invoke("flash_firmware", {
        port: state.port,
        firmwarePath,
      });
      setStatus("ok");
      addLog("✓ Flash completado con éxito", "ok");
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setStatus("error");
      setErrorMsg(msg);
      addLog(`✕ ${msg}`, "err");
    } finally {
      unlisten();
    }
  }

  const logColor = (level: LogLine["level"]) => {
    if (level === "ok") return "#4ade80";
    if (level === "err") return "#f87171";
    return "#cbd5e1";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 640 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Flash de firmware
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Puerto:{" "}
          <code style={{ fontFamily: "monospace", color: "#60a5fa" }}>{state.port}</code>
        </p>
      </div>

      {/* Selección de firmware */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={selectFirmware}
          disabled={status === "running"}
        >
          Seleccionar .bin…
        </button>
        {firmwarePath ? (
          <code style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {firmwarePath}
          </code>
        ) : (
          <span style={{ fontSize: 13, color: "#475569" }}>
            Seleccioná el firmware .bin compilado
          </span>
        )}
      </div>

      {/* Área de log */}
      <div className="log-section" style={{ minHeight: 220, maxHeight: 300 }}>
        <div className="log-header">
          <span className="log-title">Salida de esptool</span>
          {status === "running" && (
            <span style={{ fontSize: 12, color: "#60a5fa" }}>● en curso</span>
          )}
          {status === "ok" && (
            <span style={{ fontSize: 12, color: "#4ade80" }}>✓ completado</span>
          )}
          {status === "error" && (
            <span style={{ fontSize: 12, color: "#f87171" }}>✕ error</span>
          )}
        </div>
        <div className="log-container">
          {logs.length === 0 ? (
            <div className="log-empty">
              {!firmwarePath
                ? "Seleccioná un archivo .bin para comenzar."
                : "Presioná «Flash firmware» para comenzar."}
            </div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-ts">{l.ts}</span>
                <span style={{ color: logColor(l.level), fontFamily: "monospace", fontSize: 12 }}>
                  {l.text}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Error de permisos USB */}
      {status === "error" && errorMsg?.includes("dialout") && (
        <div style={{
          padding: "12px 14px",
          background: "#1c1017",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 12,
          color: "#f87171",
          lineHeight: 1.7,
        }}>
          <strong>Error de permisos USB</strong>
          <pre style={{ marginTop: 6, fontFamily: "monospace", fontSize: 11, color: "#fca5a5", background: "#0f0a0a", padding: "6px 8px", borderRadius: 4 }}>
            sudo usermod -aG dialout $USER{"\n"}
            # Luego cerrá sesión y volvé a iniciarla
          </pre>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={status === "running"}
        >
          ← Atrás
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {status === "error" && (
            <button
              className="btn btn-secondary"
              onClick={() => { setStatus("idle"); setLogs([]); setErrorMsg(null); }}
            >
              Reintentar
            </button>
          )}
          {status === "idle" && (
            <button
              className="btn btn-primary"
              disabled={!firmwarePath}
              onClick={startFlash}
            >
              Flash firmware
            </button>
          )}
          {status === "ok" && (
            <button className="btn btn-primary" onClick={onNext}>
              Siguiente → NVS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
