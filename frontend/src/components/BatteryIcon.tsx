type BatteryIconProps = {
  value: number | null;
};

export function BatteryIcon({ value }: BatteryIconProps) {
  const level = value == null ? null : value > 60 ? "high" : value > 25 ? "mid" : "low";
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <span
      className={`battery-icon${level ? ` battery-icon-${level}` : ""}`}
      role="img"
      aria-label={value == null ? "Sin dato de batería" : `Batería al ${Math.round(value)}%`}
    >
      <span className="battery-icon-body">
        <span className="battery-icon-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="battery-icon-cap" />
    </span>
  );
}
