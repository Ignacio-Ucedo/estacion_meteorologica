type NavItem = {
  label: string;
  id: string;
};

type SidebarProps = {
  navItems: NavItem[];
  activeId: string;
  isOpen: boolean;
  onNavigate: (id: string) => void;
  onClose: () => void;
};

export function Sidebar({ navItems, activeId, isOpen, onNavigate, onClose }: SidebarProps) {
  const handleNavigate = (id: string) => {
    onNavigate(id);
    onClose();
  };

  return (
    <>
      <div
        className={`sidebar-overlay${isOpen ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar${isOpen ? " open" : ""}`}
        aria-label="Navegacion principal"
      >
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
              className={item.id === activeId ? "nav-item active" : "nav-item"}
              key={item.id}
              type="button"
              aria-current={item.id === activeId ? "page" : undefined}
              onClick={() => handleNavigate(item.id)}
            >
              <span className="nav-icon" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}