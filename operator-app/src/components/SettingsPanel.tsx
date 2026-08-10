import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getBackendUrl, BACKEND_URL_KEY, BACKEND_PRESETS } from "../api/backend";

type SyncState = "idle" | "running" | "ok" | "error";

interface ChirpstackConfig {
  host: string;
  apiToken: string;
  appId: string;
  profileId: string;
  tenantId: string;
}

interface Props {
  onUrlChange?: (url: string) => void;
  devEui?: string;
  appKey?: string;
}

export default function SettingsPanel({ onUrlChange, devEui = "", appKey = "" }: Props) {
  const [url, setUrl] = useState<string>(getBackendUrl);
  const [chirpstackUrl, setChirpstackUrl] = useState<string>("http://localhost:8080");
  const [apiToken, setApiToken] = useState<string>("");
  const [savedConfig, setSavedConfig] = useState<ChirpstackConfig | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [tokenHelpOpen, setTokenHelpOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncOutput, setSyncOutput] = useState<string>("");

  useEffect(() => {
    invoke<ChirpstackConfig>("load_chirpstack_config")
      .then((cfg) => {
        setSavedConfig(cfg);
        if (cfg.host) setChirpstackUrl(cfg.host);
        if (cfg.apiToken) setApiToken(cfg.apiToken);
      })
      .catch(() => {});
  }, []);

  function handleUrlChange(next: string) {
    setUrl(next);
    try { localStorage.setItem(BACKEND_URL_KEY, next); } catch {}
    onUrlChange?.(next);
    setSyncState("idle");
    setSyncOutput("");
  }

  async function detectChirpstackUrl() {
    setDetecting(true);
    setDetectError(null);
    try {
      const host = await invoke<string>("discover_and_save_chirpstack_host");
      setChirpstackUrl(host);
      setTokenSaved(false);
    } catch (e) {
      setDetectError("No se encontró ChirpStack en la red local");
    } finally {
      setDetecting(false);
    }
  }

  async function saveToken() {
    await invoke("save_chirpstack_config", {
      host: chirpstackUrl || undefined,
      apiToken,
      appId: savedConfig?.appId ?? "",
      profileId: savedConfig?.profileId ?? "",
      tenantId: savedConfig?.tenantId ?? undefined,
    });
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  }

  const canSync = devEui.length > 0 && appKey.length > 0;

  async function handleSync() {
    setSyncState("running");
    setSyncOutput("");
    try {
      const output = await invoke<string>("sync_chirpstack", {
        devEui,
        appKey,
        chirpstackUrl,
        backendUrl: url,
      });
      setSyncState("ok");
      setSyncOutput(output.trim());
    } catch (e) {
      setSyncState("error");
      setSyncOutput(String(e));
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Configuración</h2>
      </div>

      <div className="panel-body" style={{ flexDirection: "column", alignItems: "stretch" }}>
        {/* Backend URL */}
        <div className="config-section" style={{ maxWidth: "none" }}>
          <label className="field-label">Backend URL</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {BACKEND_PRESETS.map((p) => (
              <button
                key={p.url}
                className={`btn ${url === p.url ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}
                onClick={() => handleUrlChange(p.url)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            className="field-input"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value.trim())}
            placeholder="http://localhost:8000"
            style={{ fontSize: "0.85rem" }}
          />
          <p style={{ fontSize: "0.75rem", color: "#8b949e", marginTop: "0.4rem" }}>
            El cambio se aplica la próxima vez que se cargue un panel.
          </p>
        </div>

        <div className="divider" />

        {/* ChirpStack — URL + Token */}
        <div className="config-section" style={{ maxWidth: "none" }}>
          <label className="field-label">ChirpStack</label>
          <p style={{ fontSize: "0.75rem", color: "#8b949e", margin: "0.25rem 0 0.75rem" }}>
            Configuralo una vez acá y los wizards de flash lo usarán automáticamente.
          </p>

          <label className="field-label" style={{ marginBottom: "0.25rem" }}>URL</label>
          <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem" }}>
            <input
              className="field-input"
              value={chirpstackUrl}
              onChange={(e) => { setChirpstackUrl(e.target.value.trim()); setTokenSaved(false); }}
              placeholder="http://192.168.1.10:8080"
              style={{ fontSize: "0.85rem", flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", whiteSpace: "nowrap" }}
              onClick={detectChirpstackUrl}
              disabled={detecting}
            >
              {detecting ? "Buscando…" : "Detectar"}
            </button>
          </div>
          {detectError && (
            <p style={{ fontSize: "0.75rem", color: "#f87171", marginBottom: "0.5rem" }}>{detectError}</p>
          )}

          <label className="field-label" style={{ marginBottom: "0.25rem" }}>API Token</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="field-input"
              type="password"
              value={apiToken}
              onChange={(e) => { setApiToken(e.target.value); setTokenSaved(false); }}
              placeholder="eyJ0eXAiOiJKV1Qi…"
              style={{ fontSize: "0.85rem", flex: 1, fontFamily: "monospace" }}
            />
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", whiteSpace: "nowrap" }}
              disabled={!apiToken.trim() || !chirpstackUrl.trim()}
              onClick={saveToken}
            >
              {tokenSaved ? "✓ Guardado" : "Guardar"}
            </button>
          </div>

          <button
            onClick={() => setTokenHelpOpen((o) => !o)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: "0.75rem", color: "#4b9eff", textAlign: "left", marginTop: "0.4rem",
            }}
          >
            {tokenHelpOpen ? "▾" : "▸"} ¿Cómo obtengo el token?
          </button>

          {tokenHelpOpen && (
            <div style={{
              marginTop: "0.25rem", padding: "0.75rem 1rem",
              background: "#0d1117", border: "1px solid #2d3148",
              borderRadius: 6, fontSize: "0.75rem", color: "#8b949e", lineHeight: 1.7,
            }}>
              <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
                <li>Abrí ChirpStack en la URL de arriba</li>
                <li>Iniciá sesión con el usuario admin</li>
                <li>Click en tu usuario (esquina superior derecha) → <strong style={{ color: "#c9d1d9" }}>API keys</strong></li>
                <li>Click en <strong style={{ color: "#c9d1d9" }}>Add API key</strong>, poné un nombre y confirmá</li>
                <li>Copiá el token que aparece — <span style={{ color: "#f59e0b" }}>solo se muestra una vez</span></li>
              </ol>
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Provisionar ChirpStack */}
        <div className="config-section" style={{ maxWidth: "none" }}>
          <label className="field-label">Provisionar ChirpStack</label>
          <p style={{ fontSize: "0.75rem", color: "#8b949e", margin: "0.25rem 0 0.75rem" }}>
            Crea o actualiza el device profile AU915, application, gateway virtual, device y AppKey.
            No requiere Python — usa la API REST de ChirpStack directamente.
          </p>
          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 0.75rem" }}>
            URL: <code style={{ color: "#e2e8f0" }}>{chirpstackUrl || "no configurada"}</code>
          </p>

          {!canSync && (
            <p style={{ fontSize: "0.75rem", color: "#f59e0b", marginBottom: "0.6rem" }}>
              Cargá un CSV en el panel <strong>Gateway Virtual</strong> para habilitar la provisión.
            </p>
          )}

          {canSync && (
            <p style={{ fontSize: "0.75rem", color: "#8b949e", marginBottom: "0.6rem" }}>
              DevEUI: <code style={{ color: "#86efac" }}>{devEui.toLowerCase()}</code>
            </p>
          )}

          <button
            className={`btn ${syncState === "ok" ? "btn-secondary" : "btn-primary"}`}
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", alignSelf: "flex-start" }}
            onClick={handleSync}
            disabled={syncState === "running" || !canSync}
          >
            {syncState === "running" ? "Provisionando…" : "Provisionar ChirpStack"}
          </button>

          {syncOutput && (
            <pre style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              background: "#0d1117",
              border: `1px solid ${syncState === "error" ? "#ef4444" : "#22c55e"}`,
              borderRadius: "6px",
              fontSize: "0.72rem",
              color: syncState === "error" ? "#fca5a5" : "#86efac",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "260px",
              overflowY: "auto",
            }}>
              {syncOutput}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
