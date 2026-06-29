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
import { useStation } from "./api/hooks";
import { STATION_ID } from "./api/config";
import type { MetricKey } from "./data/WeatherSeries";

const navItems = [
  { label: "Dashboard", id: "dashboard" },
  { label: "Gráficas", id: "graficas" },
  { label: "Historial", id: "historial" },
  { label: "Gestión de estaciones", id: "gestion" },
];

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `Última actualización: hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Última actualización: hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  return `Última actualización: hace ${diffH}h`;
}

const STATUS_LABELS: Record<string, string> = {
  online: "En linea",
  offline: "Desconectada",
  degraded: "Inestable",
};

const STATUS_BADGES: Record<string, string> = {
  online: "Todos los sistemas operativos",
  offline: "Estación desconectada",
  degraded: "Señal inestable",
};

function fmt(value: number | undefined | null, decimals = 1): string {
  if (value == null) return "—";
  return value.toFixed(decimals);
}

function App() {
  const [activeId, setActiveId] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState<MetricKey>("temperature");

  const { data: station, loading, error } = useStation(STATION_ID);

  const stationPanelProps = {
    name: station?.name ?? "—",
    location: station?.location ?? "—",
    status: station ? (STATUS_LABELS[station.status] ?? station.status) : "—",
    badge: station ? (STATUS_BADGES[station.status] ?? "") : "Cargando…",
    lastUpdated: station?.lastUpdatedAt
      ? formatRelativeTime(station.lastUpdatedAt)
      : loading
      ? "Cargando…"
      : "Sin datos",
  };

  const current = station?.current ?? null;

  const metrics: Array<{
    label: string;
    value: string;
    unit: string;
    detail: string;
    tone: string;
    metricKey?: MetricKey;
  }> = [
    {
      label: "Temperatura",
      value: fmt(current?.temperature),
      unit: "°C",
      detail: "Lectura actual",
      tone: "warm",
      metricKey: "temperature",
    },
    {
      label: "Humedad",
      value: fmt(current?.humidity, 0),
      unit: "%",
      detail: "Lectura actual",
      tone: "cool",
      metricKey: "humidity",
    },
    {
      label: "Velocidad del viento",
      value: fmt(current?.windSpeed),
      unit: "km/h",
      detail: "Lectura actual",
      tone: "wind",
      metricKey: "windSpeed",
    },
    {
      label: "Dirección del viento",
      value: current?.windDirection ?? "—",
      unit: "",
      detail: "Orientacion cardinal",
      tone: "direction",
    },
    {
      label: "Precipitación acumulada",
      value: fmt(current?.precipitation),
      unit: "mm",
      detail: "Últimas 24 horas",
      tone: "rain",
      metricKey: "precipitation",
    },
  ];

  const renderPanel = () => {
    switch (activeId) {
      case "dashboard":
        return (
          <>
            {error && (
              <div className="api-error-banner" role="alert">
                No se pudo conectar al servidor: {error}
              </div>
            )}
            <StationPanel {...stationPanelProps} />
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
                <BatteryBar value={null} />
                <p>Nivel de carga de la estación</p>
              </article>
            </section>
            <SelectedMetricChart metricKey={selectedMetricKey} stationId={STATION_ID} />
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
