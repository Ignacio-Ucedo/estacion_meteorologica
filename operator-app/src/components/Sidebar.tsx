type Section = "gateway" | "users" | "settings";

interface SidebarItem {
  id: Section;
  label: string;
  icon: string;
}

const ITEMS: SidebarItem[] = [
  { id: "settings", label: "Configuración", icon: "⚙️" },
  { id: "users", label: "Usuarios", icon: "👤" },
  { id: "gateway", label: "Gateway Virtual", icon: "📡" },
];

interface SidebarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
}

export default function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Operator App</span>
      </div>
      <ul className="sidebar-nav">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`sidebar-item ${activeSection === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
