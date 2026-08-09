import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DeviceEntry {
  id: number;
  dev_eui: string;
  port: string;
  wifi_ssid: string;
  chirpstack_host: string;
  status: string;
  firmware_file: string;
  params_json: string;
  provisioned_at: string; // Unix epoch seconds as string
}

type StatusFilter = "all" | "ok" | "partial" | "error";

function formatDate(epochStr: string): string {
  const epoch = parseInt(epochStr, 10);
  if (isNaN(epoch)) return epochStr;
  return new Date(epoch * 1000).toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ok:      { bg: "#14532d", color: "#4ade80", label: "OK" },
    partial: { bg: "#422006", color: "#fb923c", label: "Parcial" },
    error:   { bg: "#450a0a", color: "#f87171", label: "Error" },
  };
  const c = map[status] ?? { bg: "#1e293b", color: "#94a3b8", label: status };
  return (
    <span style={{
      padding: "2px 7px",
      borderRadius: 4,
      background: c.bg,
      color: c.color,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {c.label}
    </span>
  );
}

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Todos",
  ok: "OK",
  partial: "Parcial",
  error: "Error",
};

export default function HistoryPanel() {
  const [entries, setEntries] = useState<DeviceEntry[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<DeviceEntry[]>("list_devices");
      setEntries(data);
    } catch (err) {
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function exportCsv() {
    try {
      const csv = await invoke<string>("export_devices_csv");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dispositivos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(typeof err === "string" ? err : String(err));
    }
  }

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.status === filter);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Historial de aprovisionamientos</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportCsv}
            disabled={entries.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="panel-body" style={{ flexDirection: "column", gap: 16 }}>
        {/* Filtros */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Estado:</span>
          {(["all", "ok", "partial", "error"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "3px 10px",
                borderRadius: 5,
                border: "1px solid",
                borderColor: filter === f ? "#3b82f6" : "#2d3148",
                background: filter === f ? "#1e3a5f" : "#1a1d2e",
                color: filter === f ? "#93c5fd" : "#64748b",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>
            {filtered.length} {filtered.length === 1 ? "entrada" : "entradas"}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px 14px",
            background: "#450a0a",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            color: "#f87171",
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Tabla / vacío */}
        {!loading && filtered.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "#475569",
            fontSize: 14,
            border: "1px solid #2d3148",
            borderRadius: 8,
          }}>
            {entries.length === 0
              ? "No hay dispositivos provisionados aún. Completá un aprovisionamiento con el wizard."
              : "No hay entradas que coincidan con el filtro seleccionado."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2d3148" }}>
                  {["DevEUI", "Estado", "WiFi SSID", "ChirpStack", "Puerto", "Firmware", "Fecha"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        color: "#64748b",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    style={{ borderBottom: "1px solid #1a1d2e" }}
                  >
                    <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#93c5fd" }}>
                      {e.dev_eui}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <StatusBadge status={e.status} />
                    </td>
                    <td style={{ padding: "9px 12px", color: "#94a3b8" }}>
                      {e.wifi_ssid || "—"}
                    </td>
                    <td style={{
                      padding: "9px 12px",
                      color: "#94a3b8",
                      fontFamily: "monospace",
                      fontSize: 11,
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {e.chirpstack_host || "—"}
                    </td>
                    <td style={{ padding: "9px 12px", color: "#94a3b8", fontFamily: "monospace" }}>
                      {e.port || "—"}
                    </td>
                    <td style={{ padding: "9px 12px", color: "#94a3b8" }}>
                      {e.firmware_file
                        ? e.firmware_file.split(/[/\\]/).pop()
                        : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", color: "#64748b", whiteSpace: "nowrap" }}>
                      {formatDate(e.provisioned_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
