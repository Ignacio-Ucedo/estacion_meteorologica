import { useState, useEffect } from "react";
import { fetchUsers, deleteUser, getBackendUrl, BackendUser } from "../api/backend";

export default function UserManagementPanel() {
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      setUsers(await fetchUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleDelete(user: BackendUser) {
    if (!confirm(`¿Eliminar el usuario "${user.username}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Gestión de usuarios</h2>
        <button className="btn btn-secondary" style={{ fontSize: "0.8rem" }} onClick={loadUsers} disabled={loading}>
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      <div className="panel-body" style={{ flexDirection: "column", alignItems: "stretch", overflow: "auto" }}>
        <p style={{ fontSize: "0.8rem", color: "#8b949e" }}>
          Backend: {getBackendUrl()}
        </p>

        {error && (
          <div style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</div>
        )}

        {!loading && users.length === 0 && !error && (
          <div style={{ color: "#8b949e", fontSize: "0.85rem" }}>No hay usuarios registrados.</div>
        )}

        {users.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", color: "#8b949e", fontWeight: 500 }}>Usuario</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", color: "#8b949e", fontWeight: 500 }}>Creado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "0.5rem", color: "#c9d1d9" }}>{u.username}</td>
                  <td style={{ padding: "0.5rem", color: "#8b949e" }}>
                    {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "right" }}>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                      disabled={deletingId === u.id}
                      onClick={() => handleDelete(u)}
                    >
                      {deletingId === u.id ? "…" : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
