type TopbarProps = {
  onMenuOpen: () => void;
};

export function Topbar({ onMenuOpen }: TopbarProps) {
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

        <div>
          <p className="eyebrow">Weather station</p>
          <h1>Station Monitor</h1>
        </div>
      </div>

      <div className="topbar-actions" aria-label="Acciones">
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
  );
}