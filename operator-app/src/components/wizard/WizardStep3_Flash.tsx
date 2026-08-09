import { useState } from "react";
import type { WizardState } from "./types";

type Status = "idle" | "running" | "ok" | "error";

interface LogLine {
  ts: string;
  text: string;
  kind: "info" | "ok" | "err";
}

interface Props {
  state: WizardState;
  onBack: () => void;
  onNext: () => void;
}

export default function WizardStep3_Flash({ state, onBack, onNext }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);

  function addLog(text: string, kind: LogLine["kind"] = "info") {
    const ts = new Date().toLocaleTimeString("es-AR", { hour12: false });
    setLogs((prev) => [...prev, { ts, text, kind }]);
  }

  // Placeholder: simula el progreso hasta que la sección 7 implemente flash_firmware.
  function startFlash() {
    setStatus("running");
    setLogs([]);
    addLog(`Puerto: ${state.port}`);
    addLog("Verificando conectividad del ESP32…");

    const steps = [
      [600,  "Conectando con esptool…",               "info" as const],
      [1200, "Detectado: ESP32 (chip_id OK)",          "ok"   as const],
      [1800, "Escribiendo firmware en 0x0000…",         "info" as const],
      [3000, "Flash: ████████████████████ 100%",        "info" as const],
      [3200, "Verificando escritura…",                  "info" as const],
      [3600, "✓ Firmware flasheado correctamente",      "ok"   as const],
    ] as const;

    for (const [ms, text, kind] of steps) {
      setTimeout(() => addLog(text, kind), ms);
    }
    setTimeout(() => setStatus("ok"), 3700);
  }

  const logColor = (kind: LogLine["kind"]) => {
    if (kind === "ok")  return "#4ade80";
    if (kind === "err") return "#f87171";
    return "#cbd5e1";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 640 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Flash de firmware
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Escribe el binario del nodo en la memoria flash del ESP32 ({state.port}).
        </p>
      </div>

      {/* Área de log */}
      <div className="log-section" style={{ minHeight: 200 }}>
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
              {status === "idle" ? "Presioná «Flash firmware» para comenzar." : "Iniciando…"}
            </div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-ts">{l.ts}</span>
                <span style={{ color: logColor(l.kind), fontFamily: "monospace", fontSize: 12 }}>
                  {l.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <InfoBox>
        La implementación real (sección 7) invocará el sidecar <code>esptool</code> con{" "}
        <code>write_flash 0x0 firmware.bin</code> y streameará stdout en tiempo real.
      </InfoBox>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={status === "running"}
        >
          ← Atrás
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {status === "idle" && (
            <button className="btn btn-primary" onClick={startFlash}>
              Flash firmware
            </button>
          )}
          {status === "ok" && (
            <button className="btn btn-primary" onClick={onNext}>
              Siguiente → NVS
            </button>
          )}
          {status === "error" && (
            <button className="btn btn-secondary" onClick={() => { setStatus("idle"); setLogs([]); }}>
              Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 6,
      fontSize: 12,
      color: "#64748b",
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}
