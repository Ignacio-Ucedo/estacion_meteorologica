import { useEffect, useRef, useState } from "react";
import { generateReading, formatTimestamp, type StationReading } from "../data/Stationlog";

const PAGE_SIZE = 7;
const INTERVAL_MS = 2200;

function isHot(temp: number) { return temp >= 28; }
function isCold(temp: number) { return temp <= 0; }
function isHumid(humidity: number) { return humidity >= 85; }
function isWindy(wind: number) { return wind >= 40; }
function isRaining(rain: number) { return rain > 0; }

export function StationLogPanel() {
  const [allRows, setAllRows] = useState<StationReading[]>(() => {
    const now = Date.now();
    return Array.from({ length: PAGE_SIZE }, (_, i) =>
      generateReading(new Date(now - i * INTERVAL_MS)),
    );
  });
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  
  const filteredRows = activeSearch
    ? allRows.filter((r) =>
        r.stationName.toLowerCase().includes(activeSearch.toLowerCase()),
    )
    : allRows;

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  // Page 1 always shows the newest PAGE_SIZE entries; higher pages show older ones.
  const pageRows = page === 1
    ? filteredRows.slice(0, PAGE_SIZE)
    : filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    function commitSearch() {
    setPage(1);
    setActiveSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  }

  useEffect(() => {
    const timeouts = new Set<number>();

    const interval = window.setInterval(() => {
      if (pausedRef.current) return;
      const reading = generateReading(new Date());

      setAllRows((prev) => [reading, ...prev]);
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

  function renderRow(row: StationReading) {
    return (
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
    );
  }

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
            Filtro: <strong>{activeSearch}</strong> — {filteredRows.length} resultado{filteredRows.length !== 1 ? "s" : ""}
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
          {pageRows.length > 0 ? (
            pageRows.map(renderRow)
          ) : (
            <div className="log-empty">
              No se encontraron registros para <strong>{activeSearch}</strong>.
            </div>
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
          {allRows.length} registros
        </span>
      </div>
    </section>
  );
}