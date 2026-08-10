import { useState } from "react";
import { INITIAL_STATE, type DeviceType, type WizardState } from "./types";
import WizardStep1_Port from "./WizardStep1_Port";
import WizardStep2_Config from "./WizardStep2_Config";
import WizardStep3_Flash from "./WizardStep3_Flash";
import WizardStep4_NVS from "./WizardStep4_NVS";
import WizardStep5_ChirpStack from "./WizardStep5_ChirpStack";

const STEPS = ["Puerto", "Config", "Firmware", "NVS", "ChirpStack"] as const;

interface Props {
  title: string;
  deviceType: DeviceType;
}

export default function FlashWizard({ title, deviceType }: Props) {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const patch = (updates: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...updates }));

  const goTo = (step: WizardState["step"]) => patch({ step });

  const reset = () => setState(INITIAL_STATE);

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <WizardStep1_Port state={state} onUpdate={patch} onNext={() => goTo(2)} />;
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
        return <WizardStep3_Flash state={state} deviceType={deviceType} onUpdate={patch} onBack={() => goTo(2)} onNext={() => goTo(4)} />;
      case 4:
        return <WizardStep4_NVS state={state} deviceType={deviceType} onBack={() => goTo(3)} onNext={() => goTo(5)} />;
      case 5:
        return <WizardStep5_ChirpStack state={state} deviceType={deviceType} onReset={reset} />;
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <StepIndicator current={state.step} />
      </div>
      <div className="panel-body" style={{ flexDirection: "column" }}>
        {renderStep()}
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={num} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div
                style={{
                  width: 20,
                  height: 1,
                  background: done ? "#2563eb" : "#2d3148",
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                borderRadius: 6,
                background: active ? "#1e3a5f" : "transparent",
              }}
            >
              <div
                style={{
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
                }}
              >
                {done ? "✓" : num}
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: active ? "#93c5fd" : done ? "#60a5fa" : "#64748b",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
