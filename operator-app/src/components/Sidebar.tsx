import { BACKEND_PRESETS } from "../api/backend";
import type { Section } from "../App";

interface SidebarItem {
  id: Section;
  label: string;
  icon: string;
  comingSoon?: boolean;
}

const ITEMS: SidebarItem[] = [
  { id: "settings", label: "Configuración", icon: "⚙️" },
  { id: "users", label: "Usuarios", icon: "👤" },
  { id: "gateway", label: "Gateway Virtual", icon: "📡" },
  { id: "history", label: "Historial", icon: "📋" },
  { id: "flash-gateway-mock", label: "Flash Gateway Mock", icon: "💾", comingSoon: true },
  { id: "flash-gateway-real", label: "Flash Gateway Real", icon: "💾", comingSoon: true },
  { id: "flash-node-mock", label: "Flash Node Mock", icon: "💾", comingSoon: true },
  { id: "flash-node-real", label: "Flash Node Real", icon: "💾", comingSoon: true },
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
              className={`sidebar-item ${activeSection === item.id ? "active" : ""} ${item.comingSoon ? "coming-soon" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
              {item.comingSoon && (
                <span style={{
                  fontSize: "9px",
                  padding: "1px 5px",
                  borderRadius: "3px",
                  background: "#1e293b",
                  color: "#475569",
                  border: "1px solid #334155",
                  marginLeft: "auto",
                  flexShrink: 0,
                  fontFamily: "monospace",
                }}>
                  WIP
                </span>
              )}
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
