import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import PortSelector from "../PortSelector";
import { isGateway, type DeviceType, type WizardState } from "./types";

interface Props {
  state: WizardState;
  deviceType: DeviceType;
  onUpdate: (u: Partial<WizardState>) => void;
  onNext: () => void;
}

export default function WizardStep1_Port({ state, deviceType, onUpdate, onNext }: Props) {
  const gateway = isGateway(deviceType);
  const [readingEui, setReadingEui] = useState(false);
  const [euiError, setEuiError] = useState<string | null>(null);

  async function handleNext() {
    if (!gateway) {
      onNext();
      return;
    }

    setReadingEui(true);
    setEuiError(null);
    try {
      const eui = await invoke<string>("read_gateway_eui", { port: state.port });
      onUpdate({ gatewayEui: eui });
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setEuiError(msg);
      onUpdate({ gatewayEui: "" });
    } finally {
      setReadingEui(false);
      onNext();
    }
  }

  function formatEui(eui: string): string {
    return eui.match(/.{2}/g)?.join(":").toUpperCase() ?? eui;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Seleccionar puerto USB
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Conectá el ESP32 por USB. Solo se listan chips ESP32 conocidos (CP210x, CH340, FTDI).
        </p>
      </div>

      <PortSelector
        selectedPort={state.port}
        onSelect={(port) => onUpdate({ port })}
      />

      {/* Resultado de lectura de EUI (solo gateways) */}
      {gateway && state.gatewayEui && (
        <div style={{
          padding: "10px 14px",
          background: "#0a1f0a",
          border: "1px solid #166534",
          borderRadius: 8,
          fontSize: 13,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          <span style={{ color: "#4ade80", fontWeight: 600 }}>EUI del gateway:</span>
          <code style={{ color: "#86efac", fontFamily: "monospace", letterSpacing: "0.05em" }}>
            {formatEui(state.gatewayEui)}
          </code>
        </div>
      )}

      {gateway && euiError && (
        <div style={{
          padding: "10px 14px",
          background: "#1c1a0a",
          border: "1px solid #854d0e",
          borderRadius: 8,
          fontSize: 12,
          color: "#fbbf24",
          lineHeight: 1.5,
        }}>
          No se pudo leer el EUI del gateway: {euiError}<br />
          <span style={{ color: "#94a3b8" }}>El wizard puede continuar; el EUI se reportará como error en el Step 5.</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          className="btn btn-primary"
          disabled={!state.port || readingEui}
          onClick={handleNext}
        >
          {readingEui ? "Leyendo EUI…" : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}
