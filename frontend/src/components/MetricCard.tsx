import { Skeleton } from "./Skeleton";

type MetricCardProps = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  tone: string;
  onSelect?: () => void;
  active?: boolean;
  loading?: boolean;
};

export function MetricCard({ label, value, unit, detail, tone, onSelect, active, loading = false }: MetricCardProps) {
  const selectable = Boolean(onSelect);

  return (
    <article
      className={`metric-card ${tone}${selectable ? " selectable" : ""}${active ? " active" : ""}`}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={
        selectable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
    >
      <div className="metric-header">
        {loading ? <Skeleton width="70px" height="14px" /> : <span>{label}</span>}
        <span className="metric-signal" aria-hidden="true" />
      </div>
      <div className="metric-value">
        {loading ? (
          <Skeleton width="80px" height="26px" />
        ) : (
          <>
            <span>{value}</span>
            {unit && <small>{unit}</small>}
          </>
        )}
      </div>
      {loading ? <Skeleton width="55%" height="14px" /> : <p>{detail}</p>}
    </article>
  );
}