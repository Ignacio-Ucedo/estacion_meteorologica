import type { DailySummary } from "../data/WeatherSeries";

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
  let formattedLabel: string;
  if (typeof label === "number") {
    if (label > 23) {
      // minutes since epoch (1H chart)
      const d = new Date(label * 60_000);
      formattedLabel = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } else {
      // hour-of-day 0-23 (1D chart)
      formattedLabel = `${label.toString().padStart(2, "0")}:00`;
    }
  } else {
    formattedLabel = label ?? "";
  }

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

type DailyBandTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: DailySummary }>;
  unit: string;
  is7D: boolean;
};

export function DailyBandTooltip({ active, payload, unit, is7D }: DailyBandTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const label = is7D ? point.dayLabel : point.dateLabel;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-time">{label}</p>
      <p className="chart-tooltip-row">
        <span className="chart-tooltip-key">Máx</span>
        <span className="chart-tooltip-val">{point.max}{unit}</span>
      </p>
      <p className="chart-tooltip-row">
        <span className="chart-tooltip-key">Media</span>
        <span className="chart-tooltip-val">{point.mean}{unit}</span>
      </p>
      <p className="chart-tooltip-row">
        <span className="chart-tooltip-key">Mín</span>
        <span className="chart-tooltip-val">{point.min}{unit}</span>
      </p>
    </div>
  );
}