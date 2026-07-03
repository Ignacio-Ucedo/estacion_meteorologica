import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getBackendUrl, BACKEND_URL_KEY, BACKEND_PRESETS } from "../api/backend";

type SyncState = "idle" | "running" | "ok" | "error";

export default function SettingsPanel({ onUrlChange }: { onUrlChange?: (url: string) => void }) {
  const [url, setUrl] = useState<string>(getBackendUrl);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncOutput, setSyncOutput] = useState<string>("");

  function handleChange(next: string) {
    setUrl(next);
    try { localStorage.setItem(BACKEND_URL_KEY, next); } catch {}
    onUrlChange?.(next);
    setSyncState("idle");
    setSyncOutput("");
  }

  async function handleSync() {
    setSyncState("running");
    setSyncOutput("");
    try {
      const output = await invoke<string>("sync_chirpstack", { backendUrl: url });
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
          <label className="field-label">Integración ChirpStack</label>
          <p style={{ fontSize: "0.75rem", color: "#8b949e", margin: "0.25rem 0 0.75rem" }}>
            Sincroniza el webhook de ChirpStack para que los uplinks vayan al backend configurado arriba.
            Requiere Docker corriendo y Python con <code>chirpstack-api</code>.
          </p>
          <button
            className={`btn ${syncState === "ok" ? "btn-secondary" : "btn-primary"}`}
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", alignSelf: "flex-start" }}
            onClick={handleSync}
            disabled={syncState === "running"}
          >
            {syncState === "running" ? "Sincronizando…" : "Sincronizar ChirpStack"}
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
              maxHeight: "200px",
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
