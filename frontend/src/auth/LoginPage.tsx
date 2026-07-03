import { useState } from "react";
import { useAuth } from "./AuthContext";

type Mode = "login" | "register";

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
            <circle cx="32" cy="32" r="32" fill="#0f172a"/>
            <ellipse cx="32" cy="28" rx="14" ry="9" fill="#94a3b8"/>
            <circle cx="22" cy="30" r="7" fill="#94a3b8"/>
            <circle cx="40" cy="31" r="6" fill="#94a3b8"/>
            <circle cx="30" cy="23" r="8" fill="#cbd5e1"/>
            <ellipse cx="32" cy="30" rx="13" ry="8" fill="#cbd5e1"/>
            <circle cx="22" cy="29" r="6" fill="#cbd5e1"/>
            <circle cx="39" cy="30" r="5.5" fill="#cbd5e1"/>
            <line x1="24" y1="40" x2="22" y2="47" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="32" y1="40" x2="30" y2="47" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="40" y1="40" x2="38" y2="47" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round"/>
            <rect x="43" y="14" width="4" height="20" rx="2" fill="#f8fafc"/>
            <circle cx="45" cy="36" r="4" fill="#ef4444"/>
            <rect x="44" y="22" width="2" height="12" rx="1" fill="#ef4444"/>
          </svg>
        </div>

        <h1 className="login-title">WeatherOS</h1>
        <p className="login-subtitle">
          {mode === "login" ? "Iniciá sesión para continuar" : "Creá tu cuenta de operador"}
        </p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu_usuario"
              required
              disabled={loading}
            />
          </div>

          {mode === "login" && (
            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          )}

          {mode === "register" && (
            <p className="login-hint">
              Tu contraseña será igual a tu usuario. Podés cambiarla después.
            </p>
          )}

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading || !username.trim()}>
            {loading ? "Cargando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <div className="login-switch">
          {mode === "login" ? (
            <>
              ¿No tenés cuenta?{" "}
              <button type="button" onClick={() => switchMode("register")}>
                Crear cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{" "}
              <button type="button" onClick={() => switchMode("login")}>
                Iniciar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
