import { useEffect, useRef, useState } from "react";
import { useReadings } from "../api/hooks";
import { STATION_ID } from "../api/config";
import { formatTimestamp } from "../data/Stationlog";
import type { ReadingResponse } from "../api/types";

const PAGE_SIZE = 7;
const REFRESH_INTERVAL_MS = 30_000;

function isHot(temp: number) { return temp >= 28; }
function isCold(temp: number) { return temp <= 0; }
function isHumid(humidity: number) { return humidity >= 85; }
function isWindy(wind: number) { return wind >= 40; }
function isRaining(rain: number) { return rain > 0; }

export function StationLogPanel() {
  const [paused, setPaused] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const { data, loading, error, refresh } = useReadings(STATION_ID, page, activeSearch);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  useEffect(() => {
    if (paused) return;
    const interval = window.setInterval(() => {
      refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [paused, refresh]);

  function commitSearch() {
    setPage(1);
    setActiveSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  }

  function renderRow(row: ReadingResponse) {
    const ts = new Date(row.timestamp);
    return (
      <div key={row.id} className="log-row" role="row">
        <span className="log-cell-time">{formatTimestamp(ts)}</span>
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
    );
  }

  return (
    <section className="log-panel" aria-label="Log de estaciones">
      <div className="log-panel-head">
        <div className="section-title-wrap">
          <div className="log-panel-title">
            <span className={`log-live-dot${paused ? " paused" : ""}`} aria-hidden="true" />
            <h2>Log de estaciones</h2>
          </div>
          <span className="section-subtitle">
            Historial de telemetría — actualización cada 30 segundos.
          </span>
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

      <div className="log-search-bar">
        <div className="log-search-input-wrap">
          <input
            className="log-search-input"
            type="text"
            placeholder="Buscar estación…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitSearch()}
            aria-label="Buscar estación"
          />
          {activeSearch && (
            <button
              className="log-search-clear"
              type="button"
              onClick={clearSearch}
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>
        <button
          className="log-search-btn"
          type="button"
          onClick={commitSearch}
          aria-label="Buscar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
        {activeSearch && (
          <span className="log-search-badge">
            Filtro: <strong>{activeSearch}</strong>
          </span>
        )}
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
          {loading ? (
            <div className="log-empty">Cargando…</div>
          ) : error ? (
            <div className="log-empty">Error al conectar con el servidor.</div>
          ) : !data || data.data.length === 0 ? (
            <div className="log-empty">
              {activeSearch
                ? <>No se encontraron registros para <strong>{activeSearch}</strong>.</>
                : "Sin registros disponibles."}
            </div>
          ) : (
            data.data.map(renderRow)
          )}
        </div>
      </div>

      <div className="log-pagination">
        <button
          className="log-page-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          ‹
        </button>

        {(() => {
          const delta = 2;
          const pages: (number | "…")[] = [];
          for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || (p >= page - delta && p <= page + delta)) {
              pages.push(p);
            } else if (pages[pages.length - 1] !== "…") {
              pages.push("…");
            }
          }
          return pages.map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="log-page-ellipsis">…</span>
            ) : (
              <button
                key={p}
                className={`log-page-btn${p === page ? " active" : ""}`}
                onClick={() => setPage(p as number)}
                aria-label={`Página ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            )
          );
        })()}

        <button
          className="log-page-btn"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          ›
        </button>

        <span className="log-page-info">
          {data?.total ?? 0} registros
        </span>
      </div>
    </section>
  );
}
