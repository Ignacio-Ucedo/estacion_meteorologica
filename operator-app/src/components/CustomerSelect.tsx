import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Customer {
  id: string;
  username: string;
}

interface Props {
  backendUrl: string;
  onSelect: (customerId: string) => void;
}

export default function CustomerSelect({ backendUrl, onSelect }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    invoke<Customer[]>("fetch_customers", { backendUrl })
      .then((list) => { setCustomers(list); setLoading(false); })
      .catch((err: unknown) => {
        setError(typeof err === "string" ? err : "No se pudo conectar al backend");
        setLoading(false);
      });
  }

  useEffect(load, [backendUrl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Selección de cliente
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Elegí el cliente al que pertenece este dispositivo antes de iniciar el wizard.
        </p>
      </div>

      <div style={{
        background: "#1a1d2e",
        border: "1px solid #2d3148",
        borderRadius: 8,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 13 }}>
            <span style={{ fontSize: 16 }}>⟳</span>
            Cargando clientes desde el backend…
          </div>
        ) : error ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#f87171" }}>✕ {error}</div>
            <button className="btn btn-secondary" style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={load}>
              Reintentar
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div style={{ fontSize: 13, color: "#f59e0b" }}>
            No hay clientes registrados en el backend. Creá uno desde el panel de usuarios.
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Cliente</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{
                background: "#0f1117",
                border: "1px solid #2d3148",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
                padding: "8px 10px",
              }}
            >
              <option value="">— seleccioná un cliente —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.username}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="btn btn-primary"
          disabled={!selected}
          onClick={() => onSelect(selected)}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
