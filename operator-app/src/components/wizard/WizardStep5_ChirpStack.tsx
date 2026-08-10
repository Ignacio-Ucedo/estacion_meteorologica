import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isGateway, type DeviceType, type WizardState } from "./types";

type RegStatus = "idle" | "registering" | "ok" | "error";

interface ChirpstackConfig {
  host: string;
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
            Gateway configurado correctamente
          </p>
          <p style={{ fontSize: 12, color: "#86efac", textAlign: "center" }}>
            Firmware y WiFi flasheados. El gateway se conectará automáticamente a ChirpStack al encenderse.
          </p>
        </div>
        <div style={{
          background: "#1a1d2e", border: "1px solid #2d3148", borderRadius: 8,
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
          fontSize: 12, color: "#64748b",
        }}>
          <p style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Resumen</p>
          <p>Puerto: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.port}</code></p>
          <p>WiFi SSID: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.wifiSsid}</code></p>
          <p>Firmware: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{state.firmwarePath.split("/").pop() ?? state.firmwarePath}</code></p>
        </div>
        <button className="btn btn-primary" onClick={onReset}>
          Nuevo aprovisionamiento
        </button>
      </div>
    );
  }
  const [status, setStatus] = useState<RegStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string>("");
  const [assocStatus, setAssocStatus] = useState<"none" | "ok" | "warn">("none");
  const [assocMsg, setAssocMsg] = useState<string>("");

  const [config, setConfig] = useState<ChirpstackConfig>({
    host: "",
    apiToken: "",
    appId: "",
    profileId: "",
  });
  const [configLoaded, setConfigLoaded] = useState(false);

  const [discoveringHost, setDiscoveringHost] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [apps, setApps] = useState<DiscoveredOption[]>([]);
  const [profiles, setProfiles] = useState<DiscoveredOption[]>([]);

  useEffect(() => {
    invoke<ChirpstackConfig>("load_chirpstack_config")
      .then((saved) => {
        setConfig(saved);
        setConfigLoaded(true);
        if (!saved.host) {
          runHostDiscovery();
        }
      })
      .catch(() => {
        setConfigLoaded(true);
        runHostDiscovery();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runHostDiscovery() {
    setDiscoveringHost(true);
    setHostError(null);
    try {
      const host = await invoke<string>("discover_and_save_chirpstack_host");
      setConfig((c) => ({ ...c, host }));
    } catch (err: unknown) {
      setHostError(typeof err === "string" ? err : "No se encontró ChirpStack en la red");
    } finally {
      setDiscoveringHost(false);
    }
  }

  const configComplete =
    config.host.trim() &&
    config.apiToken.trim() &&
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

  async function register() {
    if (!configComplete) return;
    setStatus("registering");
    setErrorMsg(null);
    try {
      const msg = await invoke<string>("register_device_chirpstack", {
        host: config.host,
        apiToken: config.apiToken,
        appId: config.appId,
        profileId: config.profileId,
        devEui: state.devEui,
        appKey: state.appKey,
      });
      await invoke("save_chirpstack_config", {
        apiToken: config.apiToken,
        appId: config.appId,
        profileId: config.profileId,
      });
      await invoke("log_provisioning", {
        devEui: state.devEui,
        port: state.port ?? "",
        wifiSsid: state.wifiSsid,
        chirpstackHost: config.host,
        status: "ok",
        firmwareFile: state.firmwarePath,
        paramsJson: JSON.stringify({ devEui: state.devEui, appEui: state.appEui, wifiSsid: state.wifiSsid, chirpstackHost: config.host }),
      });
      setResultMsg(msg);
      setStatus("ok");

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
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      await invoke("log_provisioning", {
        devEui: state.devEui,
        port: state.port ?? "",
        wifiSsid: state.wifiSsid,
        chirpstackHost: config.host,
        status: "partial",
        firmwareFile: state.firmwarePath,
        paramsJson: JSON.stringify({ error: msg }),
      }).catch(() => {});
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  if (!configLoaded) {
    return <div style={{ color: "#64748b", fontSize: 13 }}>Cargando configuración…</div>;
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

      {/* Host ChirpStack */}
      <div style={{
        background: "#1a1d2e",
        border: `1px solid ${hostError ? "#7f1d1d" : config.host ? "#166534" : "#2d3148"}`,
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
      }}>
        {discoveringHost ? (
          <>
            <span style={{ color: "#64748b" }}>⟳</span>
            <span style={{ color: "#64748b" }}>Buscando ChirpStack en la red…</span>
          </>
        ) : hostError ? (
          <>
            <span style={{ color: "#f87171", flex: 1 }}>✕ {hostError}</span>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: "3px 10px" }} onClick={runHostDiscovery}>
              Reintentar
            </button>
          </>
        ) : (
          <>
            <span style={{ color: "#4ade80" }}>✓</span>
            <span style={{ color: "#94a3b8" }}>ChirpStack:</span>
            <code style={{ color: "#60a5fa", fontFamily: "monospace", flex: 1 }}>{config.host}</code>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: "3px 10px" }} onClick={runHostDiscovery}>
              Redescubrir
            </button>
          </>
        )}
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
        <Row label="DevEUI" value={state.devEui} mono />
        <Row label="AppKey" value={state.appKey} mono />
      </div>

      {/* Configuración ChirpStack */}
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

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={discover}
              disabled={discovering || status === "registering" || !config.apiToken.trim() || !config.host}
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
          <code style={{ fontFamily: "monospace" }}>{config.host}</code>…
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
            <p style={{ fontSize: 12, color: "#86efac", textAlign: "center" }}>{resultMsg}</p>
          </div>

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
            <p>ChirpStack: <code style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{config.host}</code></p>
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
