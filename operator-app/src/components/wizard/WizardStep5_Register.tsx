import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WizardState } from "./types";

type SetupState = "loading" | "discovering" | "ready" | "manual";
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
  const [setup, setSetup] = useState<SetupState>("loading");
  const [config, setConfig] = useState<ChirpstackConfig>({ host: "", apiToken: "", appId: "", profileId: "", tenantId: "" });
  const [apps, setApps] = useState<DiscoveredOption[]>([]);
  const [profiles, setProfiles] = useState<DiscoveredOption[]>([]);
  const [tenants, setTenants] = useState<DiscoveredOption[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [phase, setPhase] = useState<RegPhase>("idle");
  const [steps, setSteps] = useState<LogStep[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assocStatus, setAssocStatus] = useState<"none" | "ok" | "warn">("none");
  const [assocMsg, setAssocMsg] = useState<string>("");

  useEffect(() => {
    invoke<ChirpstackConfig>("load_chirpstack_config")
      .then((saved) => {
        setConfig(saved);
        if (saved.apiToken && saved.host) {
          autoDiscover(saved);
        } else if (!saved.host) {
          invoke<string>("discover_and_save_chirpstack_host")
            .then((host) => {
              const updated = { ...saved, host };
              setConfig(updated);
              if (updated.apiToken) autoDiscover(updated);
              else setSetup("manual");
            })
            .catch(() => setSetup("manual"));
        } else {
          setSetup("manual");
        }
      })
      .catch(() => setSetup("manual"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function autoDiscover(cfg: ChirpstackConfig) {
    setSetup("discovering");
    setDiscoverError(null);
    try {
      const result = await invoke<{ applications: DiscoveredOption[]; deviceProfiles: DiscoveredOption[]; tenants: DiscoveredOption[] }>(
        "discover_chirpstack_ids", { host: cfg.host, apiToken: cfg.apiToken }
      );

      let resolved = { ...cfg };
      const knownTenantId = cfg.tenantId || result.tenants[0]?.id || null;
      if (knownTenantId && !resolved.tenantId) resolved.tenantId = knownTenantId;
      setTenants(result.tenants);

      if (result.applications.length === 0 || result.deviceProfiles.length === 0) {
        const defaults = await invoke<{ appId: string; profileId: string; tenantId: string }>(
          "ensure_chirpstack_defaults", { host: cfg.host, apiToken: cfg.apiToken, tenantId: knownTenantId }
        );
        resolved = { ...resolved, appId: defaults.appId, profileId: defaults.profileId, tenantId: defaults.tenantId };
        setApps([{ id: defaults.appId, name: "Estación Meteorológica" }]);
        setProfiles([{ id: defaults.profileId, name: "AU915 Node" }]);
      } else {
        setApps(result.applications);
        setProfiles(result.deviceProfiles);
        if (!resolved.appId && result.applications.length === 1) resolved.appId = result.applications[0].id;
        if (!resolved.profileId && result.deviceProfiles.length === 1) resolved.profileId = result.deviceProfiles[0].id;
      }

      setConfig(resolved);
      const allReady = resolved.host && resolved.apiToken && resolved.appId && resolved.profileId && resolved.tenantId;
      setSetup(allReady ? "ready" : "manual");
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setDiscoverError(msg);
      setSetup("manual");
    }
  }

  const configComplete = !!(config.host && config.apiToken && config.tenantId && config.appId && config.profileId);

  function formatEui(eui: string): string {
    return eui.match(/.{2}/g)?.join(":").toUpperCase() ?? eui;
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

    try {
      await invoke<string>("register_device_chirpstack", {
        host: config.host, apiToken: config.apiToken,
        appId: config.appId, profileId: config.profileId,
        devEui: state.devEui, appKey: state.appKey,
      });
      updateStep(1, { status: "ok", detail: state.devEui });
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      updateStep(1, { status: "error", detail: msg });
      setPhase("error");
      setErrorMsg(msg);
      return;
    }

    try {
      await invoke("reset_device_activation", {
        devEui: state.devEui, host: config.host, apiToken: config.apiToken,
      });
      updateStep(2, { status: "ok" });
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      updateStep(2, { status: "error", detail: msg });
      setPhase("error");
      setErrorMsg(msg);
      return;
    }

    await invoke("save_chirpstack_config", {
      host: config.host, apiToken: config.apiToken, appId: config.appId,
      profileId: config.profileId, tenantId: config.tenantId,
    }).catch(() => {});

    setPhase("done");

    if (backendUrl && selectedCustomerId) {
      const stationId = `dev-${state.devEui.slice(0, 8).toLowerCase()}`;
      invoke("associate_station_to_customer", { backendUrl, stationId, ownerId: selectedCustomerId })
        .then(() => { setAssocStatus("ok"); setAssocMsg("Dispositivo asociado al cliente"); })
        .catch((err: unknown) => {
          setAssocStatus("warn");
          setAssocMsg(typeof err === "string" ? err : "No se pudo asociar el dispositivo");
        });
    }
  }

  // ── Loading / discovering ──────────────────────────────────────────────────
  if (setup === "loading" || setup === "discovering") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 13 }}>
        <span style={{ fontSize: 16 }}>⟳</span>
        {setup === "loading" ? "Cargando configuración…" : "Conectando con ChirpStack…"}
      </div>
    );
  }

  // ── Registering ────────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#93c5fd" }}>
          <span style={{ fontSize: 16 }}>⟳</span>
          Registrando en ChirpStack…
        </div>
        {steps.length > 0 && <StepLog steps={steps} />}
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
        <div style={{
          padding: "16px", background: "#14532d", border: "1px solid #166534",
          borderRadius: 8, display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
        }}>
          <div style={{ fontSize: 22 }}>✓</div>
          <p style={{ fontSize: 14, color: "#4ade80", fontWeight: 600, textAlign: "center" }}>El gateway está listo para operar</p>
          <p style={{ fontSize: 12, color: "#86efac", textAlign: "center" }}>Gateway y device registrados, FCnt reseteado.</p>
        </div>
        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
        }}>
          <InfoRow label="Gateway EUI" value={formatEui(state.gatewayEui)} />
          <InfoRow label="Device EUI" value={state.devEui} />
          <InfoRow label="WiFi SSID" value={state.wifiSsid} />
          <InfoRow label="ChirpStack" value={config.host} />
        </div>
        <StepLog steps={steps} />
        {assocStatus === "ok" && (
          <div style={{ padding: "8px 14px", background: "#14532d", border: "1px solid #166534", borderRadius: 8, fontSize: 12, color: "#4ade80" }}>
            ✓ {assocMsg}
          </div>
        )}
        {assocStatus === "warn" && (
          <div style={{ padding: "8px 14px", background: "#1c1a0a", border: "1px solid #854d0e", borderRadius: 8, fontSize: 12, color: "#fbbf24" }}>
            ⚠ {assocMsg}
          </div>
        )}
        <button className="btn btn-primary" onClick={onReset}>Nuevo aprovisionamiento</button>
      </div>
    );
  }

  // ── Ready (auto-resolved) ──────────────────────────────────────────────────
  if (setup === "ready" && phase === "idle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>Registro en ChirpStack</h3>
          <p style={{ fontSize: 13, color: "#64748b" }}>Todo está configurado. Confirmá para registrar el gateway y el device.</p>
        </div>

        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>ChirpStack</p>
          <ConfigRow label="Host" value={config.host} mono />
          <ConfigRow label="Application" value={appName(config.appId, apps)} />
          <ConfigRow label="Device Profile" value={appName(config.profileId, profiles)} />
        </div>

        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Identidades</p>
          <ConfigRow label="Gateway EUI" value={formatEui(state.gatewayEui)} mono />
          <ConfigRow label="Device EUI" value={state.devEui} mono />
          <ConfigRow label="WiFi SSID" value={state.wifiSsid} />
        </div>

        {steps.length > 0 && <StepLog steps={steps} />}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setSetup("manual")}>
            Editar configuración
          </button>
          <button className="btn btn-primary" onClick={runRegistration}>
            Registrar en ChirpStack
          </button>
        </div>
      </div>
    );
  }

  // ── Manual form ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>Registro en ChirpStack</h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>Completá los campos faltantes para continuar.</p>
      </div>

      <div style={{
        background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
      }}>
        <InfoRow label="Gateway EUI" value={state.gatewayEui ? formatEui(state.gatewayEui) : "⚠ no disponible"} warn={!state.gatewayEui} />
        <InfoRow label="Device EUI" value={state.devEui} />
      </div>

      {discoverError && (
        <div style={{ padding: "10px 14px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 12, color: "#f87171" }}>
          ✕ {discoverError}
        </div>
      )}

      <div style={{ background: "#0f1117", border: "1px solid #2d3148", borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!config.apiToken && (
          <p style={{ fontSize: 12, color: "#f59e0b" }}>
            ⚠ Ingresá el API Token en <strong>Configuración → ChirpStack API Token</strong> para no tener que ingresarlo acá.
          </p>
        )}

        <ManualField label="Host ChirpStack" value={config.host}
          onChange={(v) => setConfig((c) => ({ ...c, host: v }))} placeholder="http://192.168.1.10:8080" />
        <ManualField label="API Token" value={config.apiToken} type="password"
          onChange={(v) => setConfig((c) => ({ ...c, apiToken: v }))} placeholder="eyJ0eXAiOiJKV1Qi…" />

        <SelectOrText label="Tenant ID" value={config.tenantId} options={tenants}
          onChange={(v) => setConfig((c) => ({ ...c, tenantId: v }))} placeholder="UUID del tenant" />
        <SelectOrText label="Application ID" value={config.appId} options={apps}
          onChange={(v) => setConfig((c) => ({ ...c, appId: v }))} placeholder="UUID de la aplicación" />
        <SelectOrText label="Device Profile ID" value={config.profileId} options={profiles}
          onChange={(v) => setConfig((c) => ({ ...c, profileId: v }))} placeholder="UUID del perfil" />

        <button className="btn btn-secondary" style={{ fontSize: 12, alignSelf: "flex-start" }}
          disabled={!config.apiToken || !config.host}
          onClick={() => autoDiscover(config)}>
          Descubrir IDs automáticamente
        </button>
      </div>

      {phase === "error" && errorMsg && (
        <div style={{ padding: "12px 14px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
          ✕ {errorMsg}
        </div>
      )}
      {steps.length > 0 && <StepLog steps={steps} />}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {phase === "error" && (
          <button className="btn btn-secondary" onClick={() => { setPhase("idle"); setErrorMsg(null); setSteps([]); }}>Reintentar</button>
        )}
        <button className="btn btn-primary" onClick={runRegistration} disabled={!configComplete}>
          Registrar en ChirpStack
        </button>
      </div>
    </div>
  );
}

function appName(id: string, options: { id: string; name: string }[]): string {
  return options.find((o) => o.id === id)?.name ?? id.slice(0, 12) + "…";
}

function StepLog({ steps }: { steps: LogStep[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 14px",
          background: "#1a1d2e",
          border: `1px solid ${s.status === "ok" ? "#166534" : s.status === "error" ? "#7f1d1d" : "#2d3148"}`,
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 12, marginTop: 1, flexShrink: 0,
            color: s.status === "ok" ? "#4ade80" : s.status === "error" ? "#f87171" : "#64748b" }}>
            {s.status === "ok" ? "✓" : s.status === "error" ? "✕" : "○"}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, color: s.status === "ok" ? "#4ade80" : s.status === "error" ? "#f87171" : "#64748b" }}>
              {s.label}
            </span>
            {s.detail && <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{s.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfigRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#e2e8f0", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all", textAlign: "right" }}>{value}</span>
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

function ManualField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} style={inputStyle} />
    </label>
  );
}

function SelectOrText({ label, value, options, onChange, placeholder }: {
  label: string; value: string; options: { id: string; name: string }[];
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
      {options.length > 1 ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="">— seleccioná —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} style={inputStyle} />
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 6,
  color: "#e2e8f0", fontSize: 13, padding: "7px 10px",
  fontFamily: "monospace", width: "100%", boxSizing: "border-box",
};
