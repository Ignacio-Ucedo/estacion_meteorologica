const station = {
  name: "Station Alpha",
  location: "Mendoza, Argentina",
  status: "Online",
  badge: "All systems operational",
  lastUpdated: "Last updated: 2 minutes ago",
};

const navItems = [
  { label: "Dashboard", active: true },
  { label: "Historial", active: false },
  { label: "Gr\u00e1ficas", active: false },
  { label: "Gesti\u00f3n de estaciones", active: false },
];

const metrics = [
  {
    label: "Temperatura",
    value: "24.8",
    unit: "\u00b0C",
    detail: "Sensacion estable",
    tone: "warm",
  },
  {
    label: "Humedad",
    value: "61",
    unit: "%",
    detail: "Rango operativo",
    tone: "cool",
  },
  {
    label: "Velocidad del viento",
    value: "18.4",
    unit: "km/h",
    detail: "Brisa moderada",
    tone: "wind",
  },
  {
    label: "Direcci\u00f3n del viento",
    value: "NE",
    unit: "",
    detail: "Orientacion cardinal",
    tone: "direction",
  },
  {
    label: "Precipitaci\u00f3n acumulada",
    value: "12.6",
    unit: "mm",
    detail: "Ultimas 24 horas",
    tone: "rain",
  },
];

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegacion principal visual">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <p className="brand-title">WeatherOS</p>
            <p className="brand-subtitle">Precision Monitoring</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Secciones">
          {navItems.map((item) => (
            <button
              className={item.active ? "nav-item active" : "nav-item"}
              key={item.label}
              type="button"
              aria-current={item.active ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-label="Dashboard principal">
        <header className="topbar">
          <div>
            <p className="eyebrow">Weather station</p>
            <h1>Station Monitor</h1>
          </div>
          <div className="topbar-actions" aria-label="Acciones visuales">
            <button className="icon-button" type="button" aria-label="Buscar">
              <span className="icon-search" aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" aria-label="Notificaciones">
              <span className="icon-bell" aria-hidden="true" />
            </button>
            <div className="avatar" aria-label="Usuario">
              JA
            </div>
          </div>
        </header>

        <section className="station-panel" aria-labelledby="station-name">
          <div>
            <div className="status-line">
              <span className="status-dot" aria-hidden="true" />
              <span>
                {station.name} - {station.status}
              </span>
            </div>
            <h2 id="station-name">{station.name}</h2>
            <p className="station-location">{station.location}</p>
          </div>
          <div className="station-meta">
            <span className="system-badge">{station.badge}</span>
            <span className="last-updated">{station.lastUpdated}</span>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Metricas actuales">
          {metrics.map((metric) => (
            <article className={`metric-card ${metric.tone}`} key={metric.label}>
              <div className="metric-header">
                <span>{metric.label}</span>
                <span className="metric-signal" aria-hidden="true" />
              </div>
              <div className="metric-value">
                <span>{metric.value}</span>
                {metric.unit && <small>{metric.unit}</small>}
              </div>
              <p>{metric.detail}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

export default App;
