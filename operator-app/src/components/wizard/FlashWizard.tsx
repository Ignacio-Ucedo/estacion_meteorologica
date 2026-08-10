import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  INITIAL_STATE,
  isGateway,
  type DeviceType,
  type FirmwareCheck,
  type FirmwareStatus,
  type WizardState,
} from "./types";
import WizardStep1_Port from "./WizardStep1_Port";
import WizardStep2_Config from "./WizardStep2_Config";
import WizardStep3_Flash from "./WizardStep3_Flash";
import WizardStep4_NVS from "./WizardStep4_NVS";
import WizardStep5_ChirpStack from "./WizardStep5_ChirpStack";
import WizardStep5_Register from "./WizardStep5_Register";

const STEPS_NODE    = ["Puerto", "Config", "Firmware", "NVS", "ChirpStack"] as const;
const STEPS_GATEWAY = ["Puerto", "Config", "Firmware", "NVS", "Registro"]   as const;

interface Props {
  title: string;
  deviceType: DeviceType;
}

export default function FlashWizard({ title, deviceType }: Props) {
  const gateway = isGateway(deviceType);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [firmwareCheck, setFirmwareCheck] = useState<FirmwareCheck>({ state: "loading" });

  useEffect(() => {
    invoke<FirmwareStatus>("check_firmware_update")
      .then((status) => setFirmwareCheck({ state: "ready", status }))
      .catch((err: string) => setFirmwareCheck({ state: "error", msg: err }));
  }, []);

  const patch = (updates: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...updates }));

  const goTo = (step: WizardState["step"]) => patch({ step });

  const reset = () => setState(INITIAL_STATE);

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <WizardStep1_Port state={state} deviceType={deviceType} onUpdate={patch} onNext={() => goTo(2)} />;
      case 2:
        return (
          <WizardStep2_Config
            state={state}
            deviceType={deviceType}
            onUpdate={patch}
            onBack={() => goTo(1)}
            onNext={() => goTo(3)}
          />
        );
      case 3:
        return (
          <WizardStep3_Flash
            state={state}
            deviceType={deviceType}
            firmwareCheck={firmwareCheck}
            onUpdate={patch}
            onBack={() => goTo(2)}
            onNext={() => goTo(4)}
          />
        );
      case 4:
        return <WizardStep4_NVS state={state} deviceType={deviceType} onBack={() => goTo(3)} onNext={() => goTo(5)} />;
      case 5:
        return gateway
          ? <WizardStep5_Register state={state} onReset={reset} />
          : <WizardStep5_ChirpStack state={state} deviceType={deviceType} onReset={reset} />;
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <FirmwareChip check={firmwareCheck} />
          <StepIndicator current={state.step} steps={gateway ? STEPS_GATEWAY : STEPS_NODE} />
        </div>
      </div>
      <div className="panel-body" style={{ flexDirection: "column" }}>
        {renderStep()}
      </div>
    </div>
  );
}

function FirmwareChip({ check }: { check: FirmwareCheck }) {
  if (check.state === "loading") {
    return (
      <div style={chip("#1a1d2e", "#2d3148")}>
        <Dot color="#475569" />
        <span style={{ color: "#64748b" }}>Verificando firmware…</span>
      </div>
    );
  }

  if (check.state === "error") {
    return (
      <div style={chip("#1c1a0a", "#854d0e")}>
        <Dot color="#f59e0b" />
        <span style={{ color: "#fbbf24" }}>Sin caché · Sin internet</span>
      </div>
    );
  }

  const { status } = check;

  if (!status.needs_update && status.cached_tag) {
    return (
      <div style={chip("#0a1f0a", "#166534")}>
        <Dot color="#4ade80" />
        <span style={{ color: "#4ade80" }}>Flash offline disponible</span>
        <Tag>{status.cached_tag}</Tag>
      </div>
    );
  }

  if (status.needs_update && status.cached_tag) {
    return (
      <div style={chip("#0a1120", "#1d4ed8")}>
        <Dot color="#60a5fa" />
        <span style={{ color: "#93c5fd" }}>Actualización disponible</span>
        <Tag muted>{status.cached_tag}</Tag>
        <span style={{ color: "#475569", fontSize: 10 }}>→</span>
        <Tag>{status.latest_tag}</Tag>
      </div>
    );
  }

  return (
    <div style={chip("#0a1120", "#1d4ed8")}>
      <Dot color="#60a5fa" />
      <span style={{ color: "#93c5fd" }}>Requiere descarga</span>
      <Tag>{status.latest_tag}</Tag>
    </div>
  );
}

function chip(bg: string, border: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 8px",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 6,
    fontSize: 11,
    whiteSpace: "nowrap",
  };
}

function Dot({ color }: { color: string }) {
  return <span style={{ fontSize: 7, color, lineHeight: 1 }}>●</span>;
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <code style={{
      fontSize: 10,
      padding: "1px 4px",
      borderRadius: 3,
      background: muted ? "#1e293b" : "#1e3a5f",
      color: muted ? "#64748b" : "#60a5fa",
      fontFamily: "monospace",
    }}>
      {children}
    </code>
  );
}

function StepIndicator({ current, steps }: { current: number; steps: readonly string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {steps.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={num} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div style={{ width: 20, height: 1, background: done ? "#2563eb" : "#2d3148" }} />
            )}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: 6,
              background: active ? "#1e3a5f" : "transparent",
            }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
                background: done ? "#1d4ed8" : active ? "#3b82f6" : "#2d3148",
                color: done || active ? "#fff" : "#64748b",
              }}>
                {done ? "✓" : num}
              </div>
              <span style={{
                fontSize: 11,
                color: active ? "#93c5fd" : done ? "#60a5fa" : "#64748b",
                fontWeight: active ? 600 : 400,
              }}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
