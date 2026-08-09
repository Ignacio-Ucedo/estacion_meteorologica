import PortSelector from "../PortSelector";
import type { WizardState } from "./types";

interface Props {
  state: WizardState;
  onUpdate: (u: Partial<WizardState>) => void;
  onNext: () => void;
}

export default function WizardStep1_Port({ state, onUpdate, onNext }: Props) {
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

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          className="btn btn-primary"
          disabled={!state.port}
          onClick={onNext}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
