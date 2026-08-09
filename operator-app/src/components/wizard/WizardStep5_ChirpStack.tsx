import { useState } from "react";
import type { WizardState } from "./types";

type RegStatus = "idle" | "registering" | "ok" | "error";

interface Props {
  state: WizardState;
  onReset: () => void;
}

export default function WizardStep5_ChirpStack({ state, onReset }: Props) {
  const [status, setStatus] = useState<RegStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Placeholder: simula register_device_chirpstack hasta sección 9.
  function startRegistration() {
    setStatus("registering");
    setErrorMsg(null);

    setTimeout(() => {
      // Simula invoke("register_device_chirpstack", { devEui, appKey, host })
      setStatus("ok");
    }, 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Registro en ChirpStack
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Registra el dispositivo en el servidor LoRaWAN con el DevEUI y AppKey asignados.
        </p>
      </div>

      {/* Resumen de lo que se va a registrar */}
      <div style={{
        background: "#1a1d2e",
        border: "1px solid #2d3148",
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <Row label="Host ChirpStack"  value={state.chirpstackHost} />
        <Row label="DevEUI"           value={state.devEui} mono />
        <Row label="AppKey"           value={state.appKey} mono />
      </div>

      {/* Estado del registro */}
      {status === "idle" && (
        <div style={{
          padding: "14px 16px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 8,
          fontSize: 13,
          color: "#64748b",
        }}>
          Presioná «Registrar» para crear el dispositivo en ChirpStack.
          Si ya existe, se actualizarán las claves.
        </div>
      )}

      {status === "registering" && (
        <div style={{
          padding: "14px 16px",
          background: "#1e3a5f",
          border: "1px solid #1d4ed8",
          borderRadius: 8,
          fontSize: 13,
          color: "#93c5fd",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⟳</span>
          Conectando con ChirpStack en{" "}
          <code style={{ fontFamily: "monospace" }}>{state.chirpstackHost}</code>…
        </div>
      )}

      {status === "ok" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            padding: "16px",
            background: "#14532d",
            border: "1px solid #166534",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ fontSize: 22, textAlign: "center" }}>✓</div>
            <p style={{ fontSize: 14, color: "#4ade80", textAlign: "center", fontWeight: 600 }}>
              Aprovisionamiento completado
            </p>
            <p style={{ fontSize: 12, color: "#86efac", textAlign: "center" }}>
              El nodo <code style={{ fontFamily: "monospace" }}>{state.devEui}</code> está
              registrado en ChirpStack y listo para operar.
            </p>
          </div>

          <div style={{
            background: "#1a1d2e",
            border: "1px solid #2d3148",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 12,
            color: "#64748b",
          }}>
            <p style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Resumen</p>
            <p>Puerto: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.port}</code></p>
            <p>DevEUI: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.devEui}</code></p>
            <p>WiFi SSID: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.wifiSsid}</code></p>
            <p>ChirpStack: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.chirpstackHost}</code></p>
          </div>
        </div>
      )}

      {status === "error" && errorMsg && (
        <div style={{
          padding: "14px 16px",
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
        La implementación real (sección 9) usará la API REST de ChirpStack v4 para
        crear o actualizar el dispositivo y guardar las credenciales localmente.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {status === "ok" ? (
          <button className="btn btn-primary" onClick={onReset}>
            Nuevo aprovisionamiento
          </button>
        ) : (
          <>
            <div />
            <div style={{ display: "flex", gap: 8 }}>
              {(status === "idle" || status === "error") && (
                <button
                  className="btn btn-primary"
                  onClick={startRegistration}
                >
                  Registrar en ChirpStack
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 12,
        color: "#e2e8f0",
        fontFamily: mono ? "monospace" : "inherit",
        wordBreak: "break-all",
        textAlign: "right",
      }}>
        {value}
      </span>
    </div>
  );
}
