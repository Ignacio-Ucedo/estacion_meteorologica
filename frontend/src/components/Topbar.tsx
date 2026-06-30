type TopbarProps = {
  onMenuOpen: () => void;
  stationName: string;
  onSwitchStation: () => void;
};

export function Topbar({ onMenuOpen, stationName, onSwitchStation }: TopbarProps) {
  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          className="hamburger"
          type="button"
          aria-label="Abrir menú"
          onClick={onMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="topbar-actions" aria-label="Acciones">
        <button
          className="station-chip"
          type="button"
          onClick={onSwitchStation}
          aria-label="Cambiar estación"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 5l5-4 5 4M2 9l5 4 5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{stationName}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="icon-button" type="button" aria-label="Notificaciones">
          <span className="icon-bell" aria-hidden="true" />
        </button>
        <div className="avatar" aria-label="Usuario">
          JA
        </div>
      </div>
    </header>
  );
}