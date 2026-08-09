import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WizardState } from "./types";

type RegStatus = "idle" | "registering" | "ok" | "error";

interface ChirpstackConfig {
  apiToken: string;
  appId: string;
  profileId: string;
}

interface DiscoveredOption {
  id: string;
  name: string;
}

interface DiscoverResult {
  applications: DiscoveredOption[];
  deviceProfiles: DiscoveredOption[];
}

interface Props {
  state: WizardState;
  onReset: () => void;
}

export default function WizardStep5_ChirpStack({ state, onReset }: Props) {
  const [status, setStatus] = useState<RegStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string>("");

  const [config, setConfig] = useState<ChirpstackConfig>({
    apiToken: "",
    appId: "",
    profileId: "",
  });
  const [configLoaded, setConfigLoaded] = useState(false);

  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [apps, setApps] = useState<DiscoveredOption[]>([]);
  const [profiles, setProfiles] = useState<DiscoveredOption[]>([]);

  // 9.4: Cargar configuración persistida al montar
  useEffect(() => {
    invoke<ChirpstackConfig>("load_chirpstack_config")
      .then((saved) => {
        setConfig(saved);
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(true));
  }, []);

  const configComplete = config.apiToken.trim() && config.appId.trim() && config.profileId.trim();

  // 9.1: Descubrir aplicaciones y perfiles disponibles en ChirpStack
  async function discover() {
    if (!config.apiToken.trim()) {
      setDiscoverError("Ingresá el token de API primero.");
      return;
    }
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const result = await invoke<DiscoverResult>("discover_chirpstack_ids", {
        host: state.chirpstackHost,
        apiToken: config.apiToken,
      });
      setApps(result.applications);
      setProfiles(result.deviceProfiles);
      if (result.applications.length === 1) {
        setConfig((c) => ({ ...c, appId: result.applications[0].id }));
      }
      if (result.deviceProfiles.length === 1) {
        setConfig((c) => ({ ...c, profileId: result.deviceProfiles[0].id }));
      }
    } catch (err: unknown) {
      setDiscoverError(typeof err === "string" ? err : String(err));
    } finally {
      setDiscovering(false);
    }
  }

  // 9.2 + 9.3: Registrar device (create o update) + guardar config
  async function register() {
    if (!configComplete) return;
    setStatus("registering");
    setErrorMsg(null);
    try {
      const msg = await invoke<string>("register_device_chirpstack", {
        host: state.chirpstackHost,
        apiToken: config.apiToken,
        appId: config.appId,
        profileId: config.profileId,
        devEui: state.devEui,
        appKey: state.appKey,
      });
      // 9.4: Persistir credenciales para el próximo aprovisionamiento
      await invoke("save_chirpstack_config", {
        apiToken: config.apiToken,
        appId: config.appId,
        profileId: config.profileId,
      });
      // 10.2: Guardar entrada en el log local
      await invoke("log_provisioning", {
        devEui: state.devEui,
        port: state.port ?? "",
        wifiSsid: state.wifiSsid,
        chirpstackHost: state.chirpstackHost,
        status: "ok",
        firmwareFile: state.firmwarePath,
        paramsJson: JSON.stringify({ devEui: state.devEui, appEui: state.appEui, wifiSsid: state.wifiSsid, chirpstackHost: state.chirpstackHost }),
      });
      setResultMsg(msg);
      setStatus("ok");
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      // 10.2: Log parcial (NVS ya fue flasheado en step 4, pero ChirpStack falló)
      await invoke("log_provisioning", {
        devEui: state.devEui,
        port: state.port ?? "",
        wifiSsid: state.wifiSsid,
        chirpstackHost: state.chirpstackHost,
        status: "partial",
        firmwareFile: state.firmwarePath,
        paramsJson: JSON.stringify({ error: msg }),
      }).catch(() => {});
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  if (!configLoaded) {
    return (
      <div style={{ color: "#64748b", fontSize: 13 }}>Cargando configuración…</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Registro en ChirpStack
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Registra el dispositivo en el servidor LoRaWAN con el DevEUI y AppKey asignados.
        </p>
      </div>

      {/* Resumen del device */}
      <div style={{
        background: "#1a1d2e",
        border: "1px solid #2d3148",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <Row label="Host ChirpStack" value={state.chirpstackHost} />
        <Row label="DevEUI" value={state.devEui} mono />
        <Row label="AppKey" value={state.appKey} mono />
      </div>

      {/* Configuración ChirpStack (solo cuando no está registrando/ok) */}
      {status !== "ok" && (
        <div style={{
          background: "#0f1117",
          border: "1px solid #2d3148",
          borderRadius: 8,
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 0 }}>
            Credenciales ChirpStack
          </p>

          {/* Token */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>API Token</span>
            <input
              type="password"
              value={config.apiToken}
              onChange={(e) => setConfig((c) => ({ ...c, apiToken: e.target.value }))}
              placeholder="eyJ0eXAiOiJKV1Qi…"
              disabled={status === "registering"}
              style={inputStyle}
            />
          </label>

          {/* App ID */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Application ID</span>
            {apps.length > 0 ? (
              <select
                value={config.appId}
                onChange={(e) => setConfig((c) => ({ ...c, appId: e.target.value }))}
                disabled={status === "registering"}
                style={inputStyle}
              >
                <option value="">— seleccioná —</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id.slice(0, 8)}…)</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={config.appId}
                onChange={(e) => setConfig((c) => ({ ...c, appId: e.target.value }))}
                placeholder="UUID de la aplicación"
                disabled={status === "registering"}
                style={inputStyle}
              />
            )}
          </label>

          {/* Profile ID */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Device Profile ID</span>
            {profiles.length > 0 ? (
              <select
                value={config.profileId}
                onChange={(e) => setConfig((c) => ({ ...c, profileId: e.target.value }))}
                disabled={status === "registering"}
                style={inputStyle}
              >
                <option value="">— seleccioná —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id.slice(0, 8)}…)</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={config.profileId}
                onChange={(e) => setConfig((c) => ({ ...c, profileId: e.target.value }))}
                placeholder="UUID del perfil de dispositivo"
                disabled={status === "registering"}
                style={inputStyle}
              />
            )}
          </label>

          {/* Discover button */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={discover}
              disabled={discovering || status === "registering" || !config.apiToken.trim()}
              style={{ fontSize: 12 }}
            >
              {discovering ? "Descubriendo…" : "Descubrir IDs automáticamente"}
            </button>
            {discoverError && (
              <span style={{ fontSize: 12, color: "#f87171" }}>{discoverError}</span>
            )}
          </div>
        </div>
      )}

      {/* Estado del registro */}
      {status === "idle" && (
        <div style={{
          padding: "12px 14px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 8,
          fontSize: 13,
          color: "#64748b",
        }}>
          {configComplete
            ? "Presioná «Registrar» para crear o actualizar el device en ChirpStack."
            : "Completá el token, application ID y device profile ID para continuar."}
        </div>
      )}

      {status === "registering" && (
        <div style={{
          padding: "12px 14px",
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

      {status === "error" && errorMsg && (
        <div style={{
          padding: "12px 14px",
          background: "#450a0a",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 13,
          color: "#f87171",
          lineHeight: 1.6,
        }}>
          ✕ {errorMsg}
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
              {resultMsg}
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

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {status === "ok" ? (
          <button className="btn btn-primary" onClick={onReset}>
            Nuevo aprovisionamiento
          </button>
        ) : (
          <>
            <div />
            <div style={{ display: "flex", gap: 8 }}>
              {status === "error" && (
                <button
                  className="btn btn-secondary"
                  onClick={() => { setStatus("idle"); setErrorMsg(null); }}
                >
                  Reintentar
                </button>
              )}
              {(status === "idle" || status === "error") && (
                <button
                  className="btn btn-primary"
                  onClick={register}
                  disabled={!configComplete}
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
