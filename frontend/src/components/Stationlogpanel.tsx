import { useEffect, useRef, useState } from "react";
import { generateReading, formatTimestamp, type StationReading } from "../data/Stationlog";

const MAX_ROWS = 14;
const INTERVAL_MS = 2200;

// Umbrales simples para resaltar lecturas fuera de rango normal,
// igual que la temperatura alta resaltada en la referencia de diseño.
function isHot(temp: number) {
  return temp >= 28;
}
function isCold(temp: number) {
  return temp <= 0;
}
function isHumid(humidity: number) {
  return humidity >= 85;
}
function isWindy(wind: number) {
  return wind >= 40;
}
function isRaining(rain: number) {
  return rain > 0;
}

export function StationLogPanel() {
  const [rows, setRows] = useState<StationReading[]>(() => {
    const now = Date.now();
    return Array.from({ length: 8 }, (_, i) =>
      generateReading(new Date(now - i * INTERVAL_MS)),
    );
  });
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const timeouts = new Set<number>();

    const interval = window.setInterval(() => {
      if (pausedRef.current) return;
      const reading = generateReading(new Date());

      setRows((prev) => [reading, ...prev].slice(0, MAX_ROWS));
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.add(reading.id);
        return next;
      });

      const timeoutId = window.setTimeout(() => {
        timeouts.delete(timeoutId);
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.delete(reading.id);
          return next;
        });
      }, 900);
      timeouts.add(timeoutId);
    }, INTERVAL_MS);

    return () => {
      clearInterval(interval);
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <section className="log-panel" aria-label="Log de estaciones en vivo">
      <div className="log-panel-head">
        <div>
          <div className="log-panel-title">
            <span className={`log-live-dot${paused ? " paused" : ""}`} aria-hidden="true" />
            <h2 className="log-heading">Log de estaciones</h2>
          </div>
          <p className="log-panel-subtitle">
            Transmisión en vivo de telemetría de todas las estaciones activas.
          </p>
        </div>
        <button
          className="log-pause-btn"
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
        >
          {paused ? "Reanudar" : "Pausar"}
        </button>
      </div>

      <div className="log-table-wrap">
        <div className="log-table-header" role="row">
          <span>Fecha/Hora</span>
          <span>Estación</span>
          <span className="num">Temp (°C)</span>
          <span className="num">Humedad (%)</span>
          <span className="num">Viento (km/h)</span>
          <span className="num">Lluvia (mm)</span>
        </div>

        <div className="log-table-body" role="rowgroup">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`log-row${freshIds.has(row.id) ? " log-row-enter" : ""}`}
              role="row"
            >
              <span className="log-cell-time">{formatTimestamp(row.timestamp)}</span>
              <span className="log-cell-station">{row.stationName}</span>
              <span className={`num log-cell-value${isHot(row.temperature) ? " alert-hot" : isCold(row.temperature) ? " alert-cold" : ""}`}>
                {row.temperature.toFixed(1)}
              </span>
              <span className={`num log-cell-value${isHumid(row.humidity) ? " alert-humid" : ""}`}>
                {row.humidity.toFixed(1)}
              </span>
              <span className={`num log-cell-value${isWindy(row.windSpeed) ? " alert-wind" : ""}`}>
                {row.windSpeed.toFixed(1)}
              </span>
              <span className={`num log-cell-value${isRaining(row.precipitation) ? " alert-rain" : ""}`}>
                {row.precipitation.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}