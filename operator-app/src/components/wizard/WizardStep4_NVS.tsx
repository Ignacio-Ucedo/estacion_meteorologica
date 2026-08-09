import { useState } from "react";
import type { WizardState } from "./types";

type Status = "idle" | "generating" | "flashing" | "verifying" | "ok" | "error";

interface Props {
  state: WizardState;
  onBack: () => void;
  onNext: () => void;
}

export default function WizardStep4_NVS({ state, onBack, onNext }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Placeholder: simula generate_nvs_bin + flash_nvs + verify_nvs hasta sección 8.
  function startNvsFlash() {
    setStatus("generating");
    setErrorMsg(null);

    setTimeout(() => {
      // Simula invoke("generate_nvs_bin", { params })
      setStatus("flashing");
    }, 800);

    setTimeout(() => {
      // Simula invoke("flash_nvs", { port, nvsB64 })
      setStatus("verifying");
    }, 2200);

    setTimeout(() => {
      // Simula invoke("verify_nvs", ...)
      setStatus("ok");
    }, 3400);
  }

  const steps: Array<{ label: string; done: boolean; active: boolean }> = [
    {
      label: "Generar partición NVS",
      done: ["flashing", "verifying", "ok"].includes(status),
      active: status === "generating",
    },
    {
      label: `Flash NVS en 0x9000 (${state.port})`,
      done: ["verifying", "ok"].includes(status),
      active: status === "flashing",
    },
    {
      label: "Verificar partición (read-back)",
      done: status === "ok",
      active: status === "verifying",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 540 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Flash de partición NVS
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Genera el binario NVS con las claves OTAA y credenciales WiFi, lo flashea en{" "}
          <code>0x9000</code> y verifica la escritura.
        </p>
      </div>

      {/* Parámetros a escribir */}
      <div style={{
        background: "#1a1d2e",
        border: "1px solid #2d3148",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        fontFamily: "monospace",
      }}>
        <KV label="lorawan/dev_eui" value={state.devEui} />
        <KV label="lorawan/app_eui" value={state.appEui} />
        <KV label="lorawan/app_key" value={state.appKey} />
        <KV label="wifi/ssid" value={state.wifiSsid} />
        <KV label="wifi/pass" value={"*".repeat(state.wifiPass.length)} />
      </div>

      {/* Progress steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: s.active ? "#1e293b" : "#1a1d2e",
              border: `1px solid ${s.done ? "#166534" : s.active ? "#1d4ed8" : "#2d3148"}`,
              borderRadius: 8,
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              background: s.done ? "#166534" : s.active ? "#1d4ed8" : "#2d3148",
              color: s.done || s.active ? "#fff" : "#64748b",
            }}>
              {s.done ? "✓" : s.active ? "…" : "○"}
            </div>
            <span style={{
              fontSize: 13,
              color: s.done ? "#4ade80" : s.active ? "#93c5fd" : "#64748b",
            }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {status === "ok" && (
        <div style={{
          padding: "12px 14px",
          background: "#14532d",
          border: "1px solid #166534",
          borderRadius: 8,
          fontSize: 13,
          color: "#4ade80",
        }}>
          ✓ Partición NVS escrita y verificada correctamente.
        </div>
      )}

      {errorMsg && (
        <div style={{
          padding: "12px 14px",
          background: "#450a0a",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 13,
          color: "#f87171",
        }}>
          ✕ {errorMsg}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
        La implementación real (sección 8) invocará{" "}
        <code>generate_nvs_bin</code> → <code>flash_nvs</code> → <code>verify_nvs</code>.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={status !== "idle" && status !== "error"}
        >
          ← Atrás
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {status === "idle" && (
            <button className="btn btn-primary" onClick={startNvsFlash}>
              Flash NVS
            </button>
          )}
          {status === "ok" && (
            <button className="btn btn-primary" onClick={onNext}>
              Siguiente → ChirpStack
            </button>
          )}
          {status === "error" && (
            <button className="btn btn-secondary" onClick={() => setStatus("idle")}>
              Reintentar
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
