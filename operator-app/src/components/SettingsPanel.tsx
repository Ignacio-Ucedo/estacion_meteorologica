import { useState } from "react";
import { getBackendUrl, BACKEND_URL_KEY, BACKEND_PRESETS } from "../api/backend";

export default function SettingsPanel() {
  const [url, setUrl] = useState<string>(getBackendUrl);

  function handleChange(next: string) {
    setUrl(next);
    try { localStorage.setItem(BACKEND_URL_KEY, next); } catch {}
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
      </div>
    </div>
  );
}
