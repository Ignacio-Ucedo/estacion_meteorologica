import { useEffect, useRef } from "react";

export interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

const LEVEL_COLOR: Record<string, string> = {
  INFO: "#60a5fa",
  WARN: "#f59e0b",
  ERROR: "#ef4444",
};

interface GatewayLogProps {
  entries: LogEntry[];
  onClear: () => void;
}

export default function GatewayLog({ entries, onClear }: GatewayLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom || !userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      userScrolledRef.current = false;
    }
  }, [entries]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }

  return (
    <div className="log-section">
      <div className="log-header">
        <span className="log-title">Log</span>
        <button className="btn btn-ghost btn-sm" onClick={onClear}>
          Limpiar
        </button>
      </div>
      <div className="log-container" ref={containerRef} onScroll={handleScroll}>
        {entries.length === 0 && (
          <span className="log-empty">Sin eventos. Iniciá el gateway para ver actividad.</span>
        )}
        {entries.map((e, i) => (
          <div key={i} className="log-line">
            <span className="log-ts">{e.ts}</span>
            <span className="log-level" style={{ color: LEVEL_COLOR[e.level] ?? "#94a3b8" }}>
              {e.level}
            </span>
            <span className="log-msg">{e.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
