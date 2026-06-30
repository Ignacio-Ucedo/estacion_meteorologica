import { useEffect, useState } from "react";
import { useStations } from "../api/hooks";
import type { StationResponse } from "../api/types";

const STATUS_LABELS: Record<string, string> = {
  online: "En línea",
  offline: "Desconectada",
  degraded: "Inestable",
};

type Props = {
  open: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
};

export function StationSwitcherModal({ open, onClose, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useStations(page, search);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPage(1);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const totalPages = data ? Math.ceil(data.total / 6) : 1;

  function handleSelect(station: StationResponse) {
    onSelect(station.id);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Cambiar estación" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Cambiar estación</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal-search-wrap">
          <input
            className="modal-search-input"
            type="text"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar estación"
            autoFocus
          />
          {search && (
            <button
              className="modal-search-clear"
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        <div className="modal-station-list">
          {loading && <div className="modal-empty">Cargando…</div>}
          {error && <div className="modal-empty">Error al cargar estaciones.</div>}
          {!loading && !error && data && data.data.length === 0 && (
            <div className="modal-empty">
              {search ? <>Sin resultados para <strong>{search}</strong>.</> : "Sin estaciones disponibles."}
            </div>
          )}
          {!loading && !error && data && data.data.map((station) => (
            <button
              key={station.id}
              type="button"
              className={`modal-station-item${station.id === selectedId ? " selected" : ""}`}
              onClick={() => handleSelect(station)}
              aria-pressed={station.id === selectedId}
            >
              <div className="modal-station-info">
                <span className="modal-station-name">{station.name}</span>
                <span className="modal-station-location">{station.location}</span>
              </div>
              <span className={`modal-station-badge status-${station.status}`}>
                {STATUS_LABELS[station.status] ?? station.status}
              </span>
            </button>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="modal-pagination">
            <button
              className="modal-page-btn"
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              ‹
            </button>
            <span className="modal-page-info">{page} / {totalPages}</span>
            <button
              className="modal-page-btn"
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Página siguiente"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
