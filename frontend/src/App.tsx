import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { StationPanel } from "./components/StationPanel";
import { MetricCard } from "./components/MetricCard";
import { BatteryIcon } from "./components/BatteryIcon";
import { GraficasPanel } from "./components/Graficaspanel";
import { StationLogPanel } from "./components/Stationlogpanel";
import { StationManagementPanel } from "./components/StationManagmentPanel";
import { SelectedMetricChart } from "./components/SelectedMetricChart";
import { StationSwitcherModal } from "./components/StationSwitcherModal";
import { InlineError } from "./components/InlineError";
import { ToastProvider } from "./components/ToastProvider";
import { useStation } from "./api/hooks";
import { listStations } from "./api/client";
import { getPersistedStationId, persistStationId } from "./api/config";
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
  const [selectedStationId, setSelectedStationId] = useState<string>(() => getPersistedStationId());
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { data: station, loading, error, refresh: refreshStation } = useStation(selectedStationId);

  // Fallback: si la estación persistida ya no existe (404), auto-seleccionar la primera disponible
  const fallbackAttempted = useRef(false);
  useEffect(() => {
    if (!error || fallbackAttempted.current) return;
    if (!error.includes("404")) return;
    fallbackAttempted.current = true;
    listStations(1).then((page) => {
      if (page.data.length > 0) {
        const firstId = page.data[0].id;
        persistStationId(firstId);
        setSelectedStationId(firstId);
      }
    }).catch(() => {/* sin estaciones disponibles, el banner de error existente se muestra */});
  }, [error]);

  // Reiniciar el flag de fallback cuando cambia la estación exitosamente
  useEffect(() => {
    if (station) fallbackAttempted.current = false;
  }, [station?.id]);

  function handleSelectStation(id: string) {
    persistStationId(id);
    setSelectedStationId(id);
    setSwitcherOpen(false);
  }

  const stationPanelProps = {
    name: station?.name ?? "—",
    location: station?.location ?? "—",
    status: station ? (STATUS_LABELS[station.status] ?? station.status) : "—",
    statusKey: station?.status,
    badge: station ? (STATUS_BADGES[station.status] ?? "") : "",
    lastUpdated: station?.lastUpdatedAt
      ? formatRelativeTime(station.lastUpdatedAt)
      : loading
      ? ""
      : "Sin datos",
    loading,
  };

  const current = station?.current ?? null;

  const metrics: Array<{
    label: string;
    value: string;
    unit: string;
    detail: string;
    tone: string;
    metricKey?: MetricKey;
    indicator?: ReactNode;
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
    {
      label: "Batería",
      value: fmt(current?.batteryLevel, 0),
      unit: "%",
      detail: "Nivel de carga de la estación",
      tone: "battery",
      indicator: <BatteryIcon value={current?.batteryLevel ?? null} />,
    },
  ];

  const renderPanel = () => {
    switch (activeId) {
      case "dashboard":
        return (
          <>
            {error && !error.includes("404") && (
              <InlineError
                message="No se pudieron cargar los datos de la estación."
                onRetry={refreshStation}
              />
            )}
            <StationPanel
              {...stationPanelProps}
              onSwitchStation={() => setSwitcherOpen(true)}
            />
            <section className="metrics-grid" aria-label="Metricas actuales">
              {metrics.map(({ metricKey, ...metric }) => (
                <MetricCard
                  key={metric.label}
                  {...metric}
                  loading={loading}
                  active={metricKey === selectedMetricKey}
                  onSelect={metricKey ? () => setSelectedMetricKey(metricKey) : undefined}
                />
              ))}
            </section>
            <SelectedMetricChart metricKey={selectedMetricKey} stationId={selectedStationId} />
          </>
        );
      case "historial":
        return <StationLogPanel />;
      case "graficas":
        return <GraficasPanel stationId={selectedStationId} />;
      case "gestion":
        return <StationManagementPanel />;
      default:
        return null;
    }
  };

  return (
    <ToastProvider>
    <main className="app-shell">
      <Sidebar
        navItems={navItems}
        activeId={activeId}
        isOpen={sidebarOpen}
        onNavigate={setActiveId}
        onClose={() => setSidebarOpen(false)}
      />

      <section className="workspace" aria-label="Dashboard principal">
        <Topbar
          onMenuOpen={() => setSidebarOpen(true)}
          stationName={station?.name ?? "—"}
          onSwitchStation={() => setSwitcherOpen(true)}
        />
        {renderPanel()}
      </section>

      <StationSwitcherModal
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        selectedId={selectedStationId}
        onSelect={handleSelectStation}
      />
    </main>
    </ToastProvider>
  );
}

export default App;
