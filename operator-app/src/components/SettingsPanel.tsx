import { useState } from "react";
import { getBackendUrl, BACKEND_URL_KEY, BACKEND_PRESETS } from "../api/backend";

type CleanupState = "idle" | "open" | "loading" | "done" | "error";

function CleanupModal({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<CleanupState>("open");
  const [deleted, setDeleted] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleConfirm() {
    setState("loading");
    try {
      const res = await fetch(
        `${getBackendUrl()}/auth/admin/cleanup-orphan-readings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        },
      );
      if (res.status === 401) {
        setErrorMsg("Credenciales inválidas.");
        setState("error");
        return;
      }
      if (!res.ok) {
        setErrorMsg(`Error ${res.status}`);
        setState("error");
        return;
      }
      const data = await res.json() as { deleted: number };
      setDeleted(data.deleted);
      setState("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error desconocido");
      setState("error");
    }
  }

  const busy = state === "loading";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div style={{
        background: "#1a1d2e", border: "1px solid #3d2020", borderRadius: "10px",
        padding: "1.5rem", width: "340px", display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        {state === "done" ? (
          <>
            <p style={{ color: "#22c55e", fontWeight: 600 }}>Limpieza completada</p>
            <p style={{ fontSize: "0.85rem", color: "#c9d1d9" }}>
              Se eliminaron <strong>{deleted}</strong> lecturas huérfanas.
            </p>
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 600, color: "#ef4444" }}>Limpiar lecturas huérfanas</p>
            <p style={{ fontSize: "0.8rem", color: "#8b949e", lineHeight: 1.5 }}>
              Esto elimina permanentemente todas las lecturas sin estación asociada.
              Ingresá tus credenciales para confirmar.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                className="field-input"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <input
                className="field-input"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                onKeyDown={(e) => e.key === "Enter" && !busy && username && password && handleConfirm()}
              />
            </div>

            {state === "error" && (
              <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>{errorMsg}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirm}
                disabled={busy || !username || !password}
              >
                {busy ? "Limpiando…" : "Ejecutar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  const [url, setUrl] = useState<string>(getBackendUrl);
  const [showCleanup, setShowCleanup] = useState(false);

  function handleChange(next: string) {
    setUrl(next);
    try { localStorage.setItem(BACKEND_URL_KEY, next); } catch {}
  }

  return (
    <div className="panel">
      {showCleanup && <CleanupModal onClose={() => setShowCleanup(false)} />}

      <div className="panel-header">
        <h2 className="panel-title">Configuración</h2>
      </div>

      <div className="panel-body" style={{ flexDirection: "column", alignItems: "stretch", gap: "1.5rem" }}>
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

        <div style={{ height: "1px", background: "#2d3148" }} />

        <div className="config-section" style={{ maxWidth: "none" }}>
          <label className="field-label">Zona de peligro</label>
          <p style={{ fontSize: "0.8rem", color: "#8b949e", marginBottom: "0.75rem", lineHeight: 1.5 }}>
            Elimina lecturas en la base de datos que no tienen estación asociada.
          </p>
          <button className="btn btn-danger" onClick={() => setShowCleanup(true)}>
            Limpiar lecturas huérfanas
          </button>
        </div>
      </div>
    </div>
  );
}
