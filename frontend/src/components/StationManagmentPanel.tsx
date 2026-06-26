import { useState, useEffect } from "react";

type StationStatus = "online" | "offline" | "degraded";
type ConnectionQuality = "buena" | "regular" | "perdida";

type ManagedStation = {
  id: string;
  name: string;
  location: string;
  status: StationStatus;
  lastCommunication: Date;
  battery: number;
  connection: ConnectionQuality;
};

const PAGE_SIZE = 6;

const INITIAL_STATIONS: ManagedStation[] = [
  {
    id: "alpha",
    name: "Alpha Base Station",
    location: "Mendoza, Argentina",
    status: "online",
    lastCommunication: new Date(Date.now() - 12000),
    battery: 88,
    connection: "buena",
  },
  {
    id: "beta",
    name: "Beta Ridge Anemometer",
    location: "Córdoba, Argentina",
    status: "online",
    lastCommunication: new Date(Date.now() - 45000),
    battery: 62,
    connection: "regular",
  },
  {
    id: "gamma",
    name: "Gamma Valley Array",
    location: "Tucumán, Argentina",
    status: "degraded",
    lastCommunication: new Date(Date.now() - 210000),
    battery: 34,
    connection: "regular",
  },
  {
    id: "delta",
    name: "Delta Peak Sensor",
    location: "Bariloche, Argentina",
    status: "offline",
    lastCommunication: new Date(Date.now() - 7200000),
    battery: 11,
    connection: "perdida",
  },
  {
    id: "epsilon",
    name: "Epsilon Coastal Buoy",
    location: "Mar del Plata, Argentina",
    status: "online",
    lastCommunication: new Date(Date.now() - 8000),
    battery: 95,
    connection: "buena",
  },
  {
    id: "zeta",
    name: "Zeta Desert Outpost",
    location: "San Juan, Argentina",
    status: "degraded",
    lastCommunication: new Date(Date.now() - 540000),
    battery: 47,
    connection: "regular",
  },
  {
    id: "eta",
    name: "Eta Summit Monitor",
    location: "Salta, Argentina",
    status: "online",
    lastCommunication: new Date(Date.now() - 22000),
    battery: 79,
    connection: "buena",
  },
  {
    id: "theta",
    name: "Theta Wetlands Node",
    location: "Corrientes, Argentina",
    status: "degraded",
    lastCommunication: new Date(Date.now() - 380000),
    battery: 28,
    connection: "regular",
  },
  {
    id: "iota",
    name: "Iota Plateau Station",
    location: "La Rioja, Argentina",
    status: "offline",
    lastCommunication: new Date(Date.now() - 18000000),
    battery: 5,
    connection: "perdida",
  },
  {
    id: "kappa",
    name: "Kappa Urban Relay",
    location: "Buenos Aires, Argentina",
    status: "online",
    lastCommunication: new Date(Date.now() - 3000),
    battery: 100,
    connection: "buena",
  },
];

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  return `hace ${Math.floor(diffH / 24)}d`;
}

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

function BatteryBar({ value }: { value: number }) {
  const level = value > 60 ? "high" : value > 25 ? "mid" : "low";
  return (
    <div className="smp-battery-wrap" title={`${value}%`}>
      <div className="smp-battery-track">
        <div
          className={`smp-battery-fill smp-battery-${level}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="smp-battery-label">{value}%</span>
    </div>
  );
}

function ConnectionPill({ quality }: { quality: ConnectionQuality }) {
  const bars: Record<ConnectionQuality, number> = { buena: 3, regular: 2, perdida: 1 };
  const labels: Record<ConnectionQuality, string> = {
    buena: "Buena",
    regular: "Regular",
    perdida: "Perdida",
  };
  const active = bars[quality];
  return (
    <div className={`smp-connection smp-conn-${quality}`}>
      <div className="smp-conn-bars">
        {[1, 2, 3].map((b) => (
          <div
            key={b}
            className={`smp-conn-bar ${b <= active ? "smp-conn-bar--active" : ""}`}
            style={{ height: `${6 + b * 4}px` }}
          />
        ))}
      </div>
      <span className="smp-conn-label">{labels[quality]}</span>
    </div>
  );
}

function StationCard({ station }: { station: ManagedStation }) {
  const [relTime, setRelTime] = useState(() => formatRelativeTime(station.lastCommunication));

  useEffect(() => {
    const t = setInterval(() => {
      setRelTime(formatRelativeTime(station.lastCommunication));
    }, 5000);
    return () => clearInterval(t);
  }, [station.lastCommunication]);

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
        <StatusBadge status={station.status} />
      </header>

      <div className="smp-divider" />

      <div className="smp-card-body">
        <div className="smp-metric-row">
          <span className="smp-metric-label">Última comunicación</span>
          <span className="smp-metric-value smp-lastcomm">{relTime}</span>
        </div>
        <div className="smp-metric-row">
          <span className="smp-metric-label">Batería</span>
          <BatteryBar value={station.battery} />
        </div>
        <div className="smp-metric-row">
          <span className="smp-metric-label">Conexión</span>
          <ConnectionPill quality={station.connection} />
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
  const [stations] = useState<ManagedStation[]>(INITIAL_STATIONS);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(stations.length / PAGE_SIZE);
  const pageStations = stations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    online: stations.filter((s) => s.status === "online").length,
    degraded: stations.filter((s) => s.status === "degraded").length,
    offline: stations.filter((s) => s.status === "offline").length,
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

      <div className="smp-grid">
        {pageStations.map((s) => (
          <StationCard key={s.id} station={s} />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} total={stations.length} onChange={setPage} />
    </section>
  );
}