import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isGateway, type DeviceType, type WizardState } from "./types";

type SetupState = "loading" | "discovering" | "ready" | "manual";
type RegStatus = "idle" | "registering" | "ok" | "error";

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

interface Props {
  state: WizardState;
  deviceType: DeviceType;
  onReset: () => void;
  backendUrl?: string;
  selectedCustomerId?: string;
}

export default function WizardStep5_ChirpStack({ state, deviceType, onReset, backendUrl = "", selectedCustomerId = "" }: Props) {
  if (isGateway(deviceType)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
        <div style={{
          padding: "24px 20px", background: "#14532d", border: "1px solid #166534",
          borderRadius: 8, display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
        }}>
          <div style={{ fontSize: 28 }}>✓</div>
          <p style={{ fontSize: 15, color: "#4ade80", fontWeight: 600, textAlign: "center" }}>
            Gateway configurado correctamente
          </p>
          <p style={{ fontSize: 12, color: "#86efac", textAlign: "center" }}>
            Firmware y WiFi flasheados. El gateway se conectará automáticamente a ChirpStack al encenderse.
          </p>
        </div>
        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#64748b",
        }}>
          <p style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Resumen</p>
          <p>Puerto: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.port}</code></p>
          <p>WiFi SSID: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.wifiSsid}</code></p>
          <p>Firmware: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.firmwarePath.split("/").pop() ?? state.firmwarePath}</code></p>
        </div>
        <button className="btn btn-primary" onClick={onReset}>Nuevo aprovisionamiento</button>
      </div>
    );
  }

  const [setup, setSetup] = useState<SetupState>("loading");
  const [config, setConfig] = useState<ChirpstackConfig>({ host: "", apiToken: "", appId: "", profileId: "", tenantId: "" });
  const [apps, setApps] = useState<DiscoveredOption[]>([]);
  const [profiles, setProfiles] = useState<DiscoveredOption[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const [status, setStatus] = useState<RegStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string>("");
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

      // Siempre asegurar que existan los recursos canónicos; idempotente.
      const defaults = await invoke<{ appId: string; profileId: string; tenantId: string }>(
        "ensure_chirpstack_defaults", { host: cfg.host, apiToken: cfg.apiToken, tenantId: knownTenantId }
      );
      resolved = { ...resolved, appId: defaults.appId, profileId: defaults.profileId, tenantId: defaults.tenantId };

      const allApps = result.applications.length > 0 ? result.applications : [{ id: defaults.appId, name: "weather-station" }];
      const allProfiles = result.deviceProfiles.length > 0 ? result.deviceProfiles : [{ id: defaults.profileId, name: "esp32-sensor-au915" }];
      setApps(allApps);
      setProfiles(allProfiles);

      setConfig(resolved);
      const allReady = resolved.host && resolved.apiToken && resolved.appId && resolved.profileId;
      setSetup(allReady ? "ready" : "manual");
    } catch (err: unknown) {
      setDiscoverError(typeof err === "string" ? err : String(err));
      setSetup("manual");
    }
  }

  const configComplete = !!(config.host && config.apiToken && config.appId && config.profileId);

  async function register() {
    if (!configComplete) return;
    setStatus("registering");
    setErrorMsg(null);
    try {
      const msg = await invoke<string>("register_device_chirpstack", {
        host: config.host, apiToken: config.apiToken,
        appId: config.appId, profileId: config.profileId,
        devEui: state.devEui, appKey: state.appKey,
      });
      await invoke("save_chirpstack_config", {
        host: config.host, apiToken: config.apiToken, appId: config.appId, profileId: config.profileId,
      });
      await invoke("log_provisioning", {
        devEui: state.devEui, port: state.port ?? "", wifiSsid: state.wifiSsid,
        chirpstackHost: config.host, status: "ok", firmwareFile: state.firmwarePath,
        paramsJson: JSON.stringify({ devEui: state.devEui, wifiSsid: state.wifiSsid, chirpstackHost: config.host }),
      });
      setResultMsg(msg);
      setStatus("ok");

      if (backendUrl && selectedCustomerId) {
        const stationId = `dev-${state.devEui.slice(0, 8).toLowerCase()}`;
        invoke("associate_station_to_customer", { backendUrl, stationId, ownerId: selectedCustomerId })
          .then(() => { setAssocStatus("ok"); setAssocMsg("Dispositivo asociado al cliente"); })
          .catch((err: unknown) => {
            setAssocStatus("warn");
            setAssocMsg(typeof err === "string" ? err : "No se pudo asociar el dispositivo");
          });
      }
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      await invoke("log_provisioning", {
        devEui: state.devEui, port: state.port ?? "", wifiSsid: state.wifiSsid,
        chirpstackHost: config.host, status: "partial", firmwareFile: state.firmwarePath,
        paramsJson: JSON.stringify({ error: msg }),
      }).catch(() => {});
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  // ── Loading / discovering ──────────────────────────────────────────────────
  if (setup === "loading" || setup === "discovering") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 13 }}>
          <span style={{ fontSize: 16 }}>⟳</span>
          {setup === "loading" ? "Cargando configuración…" : "Conectando con ChirpStack…"}
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === "ok") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
        <div style={{
          padding: "16px", background: "#14532d", border: "1px solid #166534",
          borderRadius: 8, display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 22, textAlign: "center" }}>✓</div>
          <p style={{ fontSize: 14, color: "#4ade80", textAlign: "center", fontWeight: 600 }}>Aprovisionamiento completado</p>
          <p style={{ fontSize: 12, color: "#86efac", textAlign: "center" }}>{resultMsg}</p>
        </div>
        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#64748b",
        }}>
          <p style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Resumen</p>
          <Row label="DevEUI" value={state.devEui} mono />
          <Row label="WiFi SSID" value={state.wifiSsid} />
          <Row label="ChirpStack" value={config.host} mono />
        </div>
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
  if (setup === "ready" && status === "idle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>Registro en ChirpStack</h3>
          <p style={{ fontSize: 13, color: "#64748b" }}>Todo está configurado. Confirmá para registrar el device.</p>
        </div>
        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
        }}>
          <ConfigRow label="ChirpStack" value={config.host} />
          <ConfigRow label="Application" value={appName(config.appId, apps)} />
          <ConfigRow label="Device Profile" value={appName(config.profileId, profiles)} />
          <ConfigRow label="DevEUI" value={state.devEui} mono />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setSetup("manual")}>
            Editar configuración
          </button>
          <button className="btn btn-primary" onClick={register}>
            Registrar en ChirpStack
          </button>
        </div>
      </div>
    );
  }

  // ── Registering ────────────────────────────────────────────────────────────
  if (status === "registering") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#93c5fd", maxWidth: 520 }}>
        <span style={{ fontSize: 16 }}>⟳</span>
        Conectando con ChirpStack en <code style={{ fontFamily: "monospace" }}>{config.host}</code>…
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

      {discoverError && (
        <div style={{ padding: "10px 14px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 12, color: "#f87171" }}>
          ✕ No se pudo auto-configurar: {discoverError}
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

      {status === "error" && errorMsg && (
        <div style={{ padding: "12px 14px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
          ✕ {errorMsg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {status === "error" && (
          <button className="btn btn-secondary" onClick={() => { setStatus("idle"); setErrorMsg(null); }}>Reintentar</button>
        )}
        <button className="btn btn-primary" onClick={register} disabled={!configComplete}>
          Registrar en ChirpStack
        </button>
      </div>
    </div>
  );
}

function appName(id: string, options: { id: string; name: string }[]): string {
  return options.find((o) => o.id === id)?.name ?? id.slice(0, 12) + "…";
}

function ConfigRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#e2e8f0", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#e2e8f0", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all", textAlign: "right" }}>{value}</span>
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
