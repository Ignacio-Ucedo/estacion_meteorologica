type BatteryBarProps = {
  value: number | null;
};

export function BatteryBar({ value }: BatteryBarProps) {
  if (value === null) {
    return (
      <div className="battery-bar-wrap" title="Sin dato">
        <span className="battery-bar-label">Sin dato</span>
      </div>
    );
  }

  const level = value > 60 ? "high" : value > 25 ? "mid" : "low";
  return (
    <div className="battery-bar-wrap" title={`${value}%`}>
      <div className="battery-bar-track">
        <div
          className={`battery-bar-fill battery-bar-${level}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="battery-bar-label">{value}%</span>
    </div>
  );
}
