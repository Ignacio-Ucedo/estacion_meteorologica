import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getBackendUrl, BACKEND_URL_KEY, BACKEND_PRESETS } from "../api/backend";

type SyncState = "idle" | "running" | "ok" | "error";

interface Props {
  onUrlChange?: (url: string) => void;
  devEui?: string;
  appKey?: string;
}

export default function SettingsPanel({ onUrlChange, devEui = "", appKey = "" }: Props) {
  const [url, setUrl] = useState<string>(getBackendUrl);
  const [chirpstackUrl, setChirpstackUrl] = useState<string>("http://localhost:8080");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncOutput, setSyncOutput] = useState<string>("");

  function handleChange(next: string) {
    setUrl(next);
    try { localStorage.setItem(BACKEND_URL_KEY, next); } catch {}
    onUrlChange?.(next);
    setSyncState("idle");
    setSyncOutput("");
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
        <div className="config-section" style={{ maxWidth: "none" }}>
          <label className="field-label">Backend URL</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {BACKEND_PRESETS.map((p) => (
              <button
                key={p.url}
                className={`btn ${url === p.url ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}
                onClick={() => handleChange(p.url)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            className="field-input"
            value={url}
            onChange={(e) => handleChange(e.target.value.trim())}
            placeholder="http://localhost:8000"
            style={{ fontSize: "0.85rem" }}
          />
          <p style={{ fontSize: "0.75rem", color: "#8b949e", marginTop: "0.4rem" }}>
            El cambio se aplica la próxima vez que se cargue un panel.
          </p>
        </div>

        <div className="divider" />

        <div className="config-section" style={{ maxWidth: "none" }}>
          <label className="field-label">Provisionar ChirpStack</label>
          <p style={{ fontSize: "0.75rem", color: "#8b949e", margin: "0.25rem 0 0.75rem" }}>
            Crea o actualiza el device profile AU915, application, gateway virtual, device y AppKey.
            No requiere Python — usa la API REST de ChirpStack directamente.
          </p>

          <label className="field-label" style={{ marginBottom: "0.25rem" }}>ChirpStack URL</label>
          <input
            className="field-input"
            value={chirpstackUrl}
            onChange={(e) => setChirpstackUrl(e.target.value.trim())}
            placeholder="http://localhost:8080"
            style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}
          />

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
