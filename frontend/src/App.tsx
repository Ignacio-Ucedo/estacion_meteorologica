import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { StationPanel } from "./components/StationPanel";
import { MetricCard } from "./components/MetricCard";
import { BatteryBar } from "./components/BatteryBar";
import { GraficasPanel } from "./components/Graficaspanel";
import { StationLogPanel } from "./components/Stationlogpanel";
import { StationManagementPanel } from "./components/StationManagmentPanel";
import { SelectedMetricChart } from "./components/SelectedMetricChart";
import type { MetricKey } from "./data/WeatherSeries";

const station = {
  name: "Station Alpha",
  location: "Mendoza, Argentina",
  status: "En linea",
  badge: "Todos los sistemas operativos",
  lastUpdated: "Última actualización: hace 2 minutos",
};

const navItems = [
  { label: "Dashboard", id: "dashboard" },
  { label: "Gráficas", id: "graficas" },
  { label: "Historial", id: "historial" },
  { label: "Gestión de estaciones", id: "gestion" },
];

const metrics: Array<{
  label: string;
  value: string;
  unit: string;
  detail: string;
  tone: string;
  metricKey?: MetricKey;
}> = [
  { label: "Temperatura", value: "24.8", unit: "°C", detail: "Sensacion estable", tone: "warm", metricKey: "temperature" },
  { label: "Humedad", value: "61", unit: "%", detail: "Rango operativo", tone: "cool", metricKey: "humidity" },
  { label: "Velocidad del viento", value: "18.4", unit: "km/h", detail: "Brisa moderada", tone: "wind", metricKey: "windSpeed" },
  { label: "Dirección del viento", value: "NE", unit: "", detail: "Orientacion cardinal", tone: "direction" },
  { label: "Precipitación acumulada", value: "12.6", unit: "mm", detail: "Ultimas 24 horas", tone: "rain", metricKey: "precipitation" },
];

const batteryLevel: number | null = 78;

function App() {
  const [activeId, setActiveId] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState<MetricKey>("temperature");

  const renderPanel = () => {
    switch (activeId) {
      case "dashboard":
        return (
          <>
            <StationPanel {...station} />
            <section className="metrics-grid" aria-label="Metricas actuales">
              {metrics.map(({ metricKey, ...metric }) => (
                <MetricCard
                  key={metric.label}
                  {...metric}
                  active={metricKey === selectedMetricKey}
                  onSelect={metricKey ? () => setSelectedMetricKey(metricKey) : undefined}
                />
              ))}
              <article className="metric-card battery">
                <div className="metric-header">
                  <span>Batería</span>
                  <span className="metric-signal" aria-hidden="true" />
                </div>
                <BatteryBar value={batteryLevel} />
                <p>Nivel de carga de la estación</p>
              </article>
            </section>
            <SelectedMetricChart metricKey={selectedMetricKey} />
          </>
        );
      case "historial":
        return <StationLogPanel />;
      case "graficas":
        return <GraficasPanel />;
      case "gestion":
        return <StationManagementPanel />;
      default:
        return null;
    }
  };

  return (
    <main className="app-shell">
      <Sidebar
        navItems={navItems}
        activeId={activeId}
        isOpen={sidebarOpen}
        onNavigate={setActiveId}
        onClose={() => setSidebarOpen(false)}
      />

      <section className="workspace" aria-label="Dashboard principal">
        <Topbar onMenuOpen={() => setSidebarOpen(true)} />
        {renderPanel()}
      </section>
    </main>
  );
}

export default App;