type ChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: number | string;
  unit: string;
  valueLabel: string;
};

export function ChartTooltip({ active, payload, label, unit, valueLabel }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value;
  const formattedLabel =
    typeof label === "number" ? `${label.toString().padStart(2, "0")}:00` : label;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-time">{formattedLabel}</p>
      <p className="chart-tooltip-value">
        {valueLabel}: {value}
        {unit}
      </p>
    </div>
  );
}