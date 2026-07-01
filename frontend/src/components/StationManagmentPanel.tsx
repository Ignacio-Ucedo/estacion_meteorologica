import { useState } from "react";
import { BatteryBar } from "./BatteryBar";
import { useStations } from "../api/hooks";
import { InlineError } from "./InlineError";
import type { StationResponse } from "../api/types";

type StationStatus = "online" | "offline" | "degraded";

const PAGE_SIZE = 6;

function StatusBadge({ status }: { status: StationStatus }) {
  const labels: Record<StationStatus, string> = {
    online: "En linea",
    offline: "Desconectada",
    degraded: "Inestable",
  };
  return (
    <span className={`smp-status-badge smp-status-${status}`}>
      <span className="smp-status-dot" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}

function StationCard({ station }: { station: StationResponse }) {
  return (
    <article className={`smp-card smp-card--${station.status}`}>
      <header className="smp-card-header">
        <div className="smp-card-name-wrap">
          <h3 className="smp-card-name">{station.name}</h3>
          <p className="smp-card-location">
            <span className="smp-location-icon" aria-hidden="true" />
            {station.location}
          </p>
        </div>
        <StatusBadge status={station.status as StationStatus} />
      </header>

      <div className="smp-divider" />

      <div className="smp-card-body">
        <div className="smp-metric-row">
          <span className="smp-metric-label">Última comunicación</span>
          <span className="smp-metric-value smp-lastcomm">—</span>
        </div>
        <div className="smp-metric-row">
          <span className="smp-metric-label">Batería</span>
          <BatteryBar value={null} />
        </div>
        <div className="smp-metric-row">
          <span className="smp-metric-label">Conexión</span>
          <span className="smp-metric-value">—</span>
        </div>
      </div>
    </article>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="log-pagination" role="navigation" aria-label="Paginación de estaciones">
      <button
        className="log-page-btn"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Página anterior"
      >
        ‹
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          className={`log-page-btn${p === page ? " active" : ""}`}
          onClick={() => onChange(p)}
          aria-label={`Página ${p}`}
          aria-current={p === page ? "page" : undefined}
          style={{ borderColor: p === page ? "#52d1e8" : "#586171", color: p === page ? "#52d1e8" : "#e4e2e4" }}
        >
          {p}
        </button>
      ))}

      <button
        className="log-page-btn"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Página siguiente"
      >
        ›
      </button>

      <span className="log-page-info">{total} estaciones</span>
    </div>
  );
}

export function StationManagementPanel() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useStations(page, "");

  const pageStations = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const counts = {
    online: pageStations.filter((s) => s.status === "online").length,
    degraded: pageStations.filter((s) => s.status === "degraded").length,
    offline: pageStations.filter((s) => s.status === "offline").length,
  };

  return (
    <section className="smp-panel" aria-label="Gestión de estaciones">
      <div>
        <div className="section-title-wrap" style={{ marginBottom: "12px" }}>
          <h2>Gestión de estaciones</h2>
          <span className="section-subtitle">Administra y monitorea todas las estaciones meteorológicas.</span>
        </div>
        <div className="smp-summary">
          <span className="smp-summary-item smp-summary-online">
            <span className="smp-summary-dot" />
            {counts.online} En linea
          </span>
          <span className="smp-summary-item smp-summary-degraded">
            <span className="smp-summary-dot" />
            {counts.degraded} Inestable
          </span>
          <span className="smp-summary-item smp-summary-offline">
            <span className="smp-summary-dot" />
            {counts.offline} Desconectada
          </span>
        </div>
      </div>

      {loading ? (
        <div className="log-empty">Cargando estaciones…</div>
      ) : error ? (
        <InlineError
          message="No se pudo cargar la lista de estaciones."
          onRetry={() => { setPage(1); refresh(); }}
        />
      ) : pageStations.length === 0 ? (
        <div className="log-empty">No hay estaciones registradas.</div>
      ) : (
        <>
          <div className="smp-grid">
            {pageStations.map((s) => (
              <StationCard key={s.id} station={s} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </>
      )}
    </section>
  );
}
