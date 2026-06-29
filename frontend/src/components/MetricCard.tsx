type MetricCardProps = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  tone: string;
  onSelect?: () => void;
  active?: boolean;
};

export function MetricCard({ label, value, unit, detail, tone, onSelect, active }: MetricCardProps) {
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
        <span>{label}</span>
        <span className="metric-signal" aria-hidden="true" />
      </div>
      <div className="metric-value">
        <span>{value}</span>
        {unit && <small>{unit}</small>}
      </div>
      <p>{detail}</p>
    </article>
  );
}