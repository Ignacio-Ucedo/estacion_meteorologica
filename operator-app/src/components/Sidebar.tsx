import { BACKEND_PRESETS } from "../api/backend";

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
  backendUrl: string;
}

export default function Sidebar({ activeSection, onNavigate, backendUrl }: SidebarProps) {
  const preset = BACKEND_PRESETS.find((p) => p.url === backendUrl);
  const envLabel = preset?.label ?? "Custom";
  const isProd = envLabel === "Producción";

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
      {activeSection !== "settings" && (
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid #2d3148",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: isProd ? "#f59e0b" : "#22c55e",
          }} />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>{envLabel}</span>
        </div>
      )}
    </nav>
  );
}
