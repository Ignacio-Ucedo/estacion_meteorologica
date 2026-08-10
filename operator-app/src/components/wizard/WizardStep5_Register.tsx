import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WizardState } from "./types";

type RegPhase = "idle" | "running" | "done" | "error";

interface ChirpstackConfig {
  host: string;
  apiToken: string;
  appId: string;
  profileId: string;
  tenantId: string;
}

interface DiscoveredOption {
  id: string;
  name: string;
}

interface DiscoverResult {
  applications: DiscoveredOption[];
  deviceProfiles: DiscoveredOption[];
  tenants: DiscoveredOption[];
}

interface LogStep {
  label: string;
  status: "pending" | "ok" | "error";
  detail?: string;
}

interface Props {
  state: WizardState;
  onReset: () => void;
  backendUrl?: string;
  selectedCustomerId?: string;
}

export default function WizardStep5_Register({ state, onReset, backendUrl = "", selectedCustomerId = "" }: Props) {
  const [config, setConfig] = useState<ChirpstackConfig>({
    host: "",
    apiToken: "",
    appId: "",
    profileId: "",
    tenantId: "",
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [phase, setPhase] = useState<RegPhase>("idle");
  const [steps, setSteps] = useState<LogStep[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [apps, setApps] = useState<DiscoveredOption[]>([]);
  const [profiles, setProfiles] = useState<DiscoveredOption[]>([]);
  const [tenants, setTenants] = useState<DiscoveredOption[]>([]);
  const [assocStatus, setAssocStatus] = useState<"none" | "ok" | "warn">("none");
  const [assocMsg, setAssocMsg] = useState<string>("");

  useEffect(() => {
    invoke<ChirpstackConfig>("load_chirpstack_config")
      .then((saved) => setConfig(saved))
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  const configComplete =
    config.host.trim() &&
    config.apiToken.trim() &&
    config.tenantId.trim() &&
    config.appId.trim() &&
    config.profileId.trim();

  async function discover() {
    if (!config.apiToken.trim()) {
      setDiscoverError("Ingresá el token de API primero.");
      return;
    }
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const result = await invoke<DiscoverResult>("discover_chirpstack_ids", {
        host: config.host,
        apiToken: config.apiToken,
      });
      setApps(result.applications);
      setProfiles(result.deviceProfiles);
      setTenants(result.tenants);
      if (result.applications.length === 1) {
        setConfig((c) => ({ ...c, appId: result.applications[0].id }));
      }
      if (result.deviceProfiles.length === 1) {
        setConfig((c) => ({ ...c, profileId: result.deviceProfiles[0].id }));
      }
      if (result.tenants.length === 1) {
        setConfig((c) => ({ ...c, tenantId: result.tenants[0].id }));
      }
    } catch (err: unknown) {
      setDiscoverError(typeof err === "string" ? err : String(err));
    } finally {
      setDiscovering(false);
    }
  }

  function updateStep(index: number, update: Partial<LogStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
  }

  async function runRegistration() {
    const initialSteps: LogStep[] = [
      { label: `Registrar gateway ${formatEui(state.gatewayEui)}`, status: "pending" },
      { label: `Registrar device ${state.devEui.slice(0, 8)}…`, status: "pending" },
      { label: "Resetear frame counter (próximo join limpio)", status: "pending" },
    ];
    setSteps(initialSteps);
    setPhase("running");
    setErrorMsg(null);

    // Paso 1: registrar gateway (infraestructura LoRaWAN)
    updateStep(0, { status: "pending" });
    if (!state.gatewayEui) {
      updateStep(0, { status: "error", detail: "EUI del gateway no disponible (fallo en Step 1)" });
      setPhase("error");
      setErrorMsg("EUI del gateway vacío. Volvé al Step 1 y confirmá el puerto.");
      return;
    }
    try {
      await invoke("register_gateway", {
        eui: state.gatewayEui,
        name: `gateway-${state.gatewayEui.slice(0, 8)}`,
        host: config.host,
        apiToken: config.apiToken,
        tenantId: config.tenantId,
      });
      updateStep(0, { status: "ok", detail: `EUI ${formatEui(state.gatewayEui)}` });
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      updateStep(0, { status: "error", detail: msg });
      setPhase("error");
      setErrorMsg(msg);
      return;
    }

    // Paso 2: registrar device (OTAA keys del pool)
    try {
      await invoke<string>("register_device_chirpstack", {
        host: config.host,
        apiToken: config.apiToken,
        appId: config.appId,
        profileId: config.profileId,
        devEui: state.devEui,
        appKey: state.appKey,
      });
      updateStep(1, { status: "ok", detail: state.devEui });
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      updateStep(1, { status: "error", detail: msg });
      setPhase("error");
      setErrorMsg(msg);
      return;
    }

    // Paso 3: resetear FCnt (borrar sesión OTAA activa)
    try {
      await invoke("reset_device_activation", {
        devEui: state.devEui,
        host: config.host,
        apiToken: config.apiToken,
      });
      updateStep(2, { status: "ok" });
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      updateStep(2, { status: "error", detail: msg });
      setPhase("error");
      setErrorMsg(msg);
      return;
    }

    // Persistir credenciales para reutilizar
    await invoke("save_chirpstack_config", {
      apiToken: config.apiToken,
      appId: config.appId,
      profileId: config.profileId,
      tenantId: config.tenantId,
    }).catch(() => {});

    setPhase("done");

    // Asociar station al cliente seleccionado (no-bloqueante)
    if (backendUrl && selectedCustomerId) {
      const stationId = `dev-${state.devEui.slice(0, 8).toLowerCase()}`;
      invoke("associate_station_to_customer", {
        backendUrl,
        stationId,
        ownerId: selectedCustomerId,
      })
        .then(() => { setAssocStatus("ok"); setAssocMsg("Dispositivo asociado al cliente"); })
        .catch((err: unknown) => {
          setAssocStatus("warn");
          setAssocMsg(typeof err === "string" ? err : "No se pudo asociar el dispositivo");
        });
    }
  }

  function formatEui(eui: string): string {
    return eui.match(/.{2}/g)?.join(":").toUpperCase() ?? eui;
  }

  if (!configLoaded) {
    return <div style={{ color: "#64748b", fontSize: 13 }}>Cargando configuración…</div>;
  }

  if (phase === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
        <div style={{
          padding: "24px 20px",
          background: "#14532d",
          border: "1px solid #166534",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}>
          <div style={{ fontSize: 28 }}>✓</div>
          <p style={{ fontSize: 15, color: "#4ade80", fontWeight: 600, textAlign: "center" }}>
            El gateway está listo para operar
          </p>
          <p style={{ fontSize: 12, color: "#86efac", textAlign: "center" }}>
            Gateway registrado en ChirpStack, device con keys OTAA reales, FCnt reseteado.
          </p>
        </div>
        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12,
        }}>
          <p style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Identidades</p>
          <InfoRow label="Gateway EUI" value={formatEui(state.gatewayEui)} />
          <InfoRow label="Device EUI" value={state.devEui} />
          <InfoRow label="WiFi SSID" value={state.wifiSsid} />
          <InfoRow label="ChirpStack" value={config.host} />
        </div>
        <StepLog steps={steps} />
        {assocStatus === "ok" && (
          <div style={{
            padding: "8px 14px", background: "#14532d", border: "1px solid #166534",
            borderRadius: 8, fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 8,
          }}>
            ✓ {assocMsg}
          </div>
        )}
        {assocStatus === "warn" && (
          <div style={{
            padding: "8px 14px", background: "#1c1a0a", border: "1px solid #854d0e",
            borderRadius: 8, fontSize: 12, color: "#fbbf24", display: "flex", alignItems: "center", gap: 8,
          }}>
            ⚠ {assocMsg}
          </div>
        )}
        <button className="btn btn-primary" onClick={onReset}>
          Nuevo aprovisionamiento
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Registro en ChirpStack
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Registra el gateway y el device en ChirpStack, y resetea el FCnt para un join limpio.
        </p>
      </div>

      {/* Resumen de identidades */}
      <div style={{
        background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
      }}>
        <InfoRow label="Gateway EUI" value={state.gatewayEui ? formatEui(state.gatewayEui) : "⚠ no disponible"} warn={!state.gatewayEui} />
        <InfoRow label="Device EUI" value={state.devEui} />
        <InfoRow label="AppKey" value={state.appKey} />
      </div>

      {/* Credenciales ChirpStack */}
      {phase === "idle" && (
        <div style={{
          background: "#0f1117", border: "1px solid #2d3148", borderRadius: 8,
          padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Credenciales ChirpStack</p>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Host</span>
            <input type="text" value={config.host}
              onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
              placeholder="http://192.168.1.10:8080"
              style={inputStyle} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>API Token</span>
            <input type="password" value={config.apiToken}
              onChange={(e) => setConfig((c) => ({ ...c, apiToken: e.target.value }))}
              placeholder="eyJ0eXAiOiJKV1Qi…"
              style={inputStyle} />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-secondary"
              onClick={discover}
              disabled={discovering || !config.apiToken.trim() || !config.host.trim()}
              style={{ fontSize: 12 }}>
              {discovering ? "Descubriendo…" : "Descubrir IDs"}
            </button>
            {discoverError && <span style={{ fontSize: 12, color: "#f87171" }}>{discoverError}</span>}
          </div>

          <SelectField label="Tenant ID" value={config.tenantId}
            onChange={(v) => setConfig((c) => ({ ...c, tenantId: v }))}
            options={tenants} placeholder="UUID del tenant" />

          <SelectField label="Application ID" value={config.appId}
            onChange={(v) => setConfig((c) => ({ ...c, appId: v }))}
            options={apps} placeholder="UUID de la aplicación" />

          <SelectField label="Device Profile ID" value={config.profileId}
            onChange={(v) => setConfig((c) => ({ ...c, profileId: v }))}
            options={profiles} placeholder="UUID del perfil de dispositivo" />
        </div>
      )}

      {/* Log de progreso (durante ejecución y en error) */}
      {steps.length > 0 && <StepLog steps={steps} />}

      {/* Error */}
      {phase === "error" && errorMsg && (
        <div style={{
          padding: "12px 14px", background: "#450a0a", border: "1px solid #7f1d1d",
          borderRadius: 8, fontSize: 13, color: "#f87171", lineHeight: 1.6,
        }}>
          ✕ {errorMsg}
        </div>
      )}

      {/* Hint idle */}
      {phase === "idle" && (
        <div style={{
          padding: "12px 14px", background: "#1e293b", border: "1px solid #334155",
          borderRadius: 8, fontSize: 13, color: "#64748b",
        }}>
          {configComplete
            ? "Presioná «Registrar» para completar el aprovisionamiento."
            : "Completá las credenciales de ChirpStack para continuar."}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {phase === "error" && (
          <button className="btn btn-secondary" onClick={() => { setPhase("idle"); setErrorMsg(null); setSteps([]); }}>
            Reintentar
          </button>
        )}
        {phase === "idle" && (
          <button className="btn btn-primary" disabled={!configComplete} onClick={runRegistration}>
            Registrar en ChirpStack
          </button>
        )}
      </div>
    </div>
  );
}

function StepLog({ steps }: { steps: LogStep[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "9px 14px",
          background: "#1a1d2e",
          border: `1px solid ${s.status === "ok" ? "#166534" : s.status === "error" ? "#7f1d1d" : "#2d3148"}`,
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 12, marginTop: 1, flexShrink: 0,
            color: s.status === "ok" ? "#4ade80" : s.status === "error" ? "#f87171" : "#64748b" }}>
            {s.status === "ok" ? "✓" : s.status === "error" ? "✕" : "○"}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13,
              color: s.status === "ok" ? "#4ade80" : s.status === "error" ? "#f87171" : "#64748b" }}>
              {s.label}
            </span>
            {s.detail && (
              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{s.detail}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: warn ? "#fbbf24" : "#e2e8f0", fontFamily: "monospace", wordBreak: "break-all", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: DiscoveredOption[];
  placeholder: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
      {options.length > 0 ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="">— seleccioná —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name} ({o.id.slice(0, 8)}…)</option>
          ))}
        </select>
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} style={inputStyle} />
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#1a1d2e",
  border: "1px solid #2d3148",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 13,
  padding: "7px 10px",
  fontFamily: "monospace",
  width: "100%",
  boxSizing: "border-box",
};
