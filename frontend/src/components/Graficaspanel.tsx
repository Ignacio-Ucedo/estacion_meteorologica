import { ChartCard } from "./ChartCard";
import { metricChartConfig } from "../data/MetricChartConfig";
import type { MetricKey, WeatherPoint, DailySummary } from "../data/WeatherSeries";
import { useHourlyMetric, useDailyMetric } from "../api/hooks";
import { STATION_ID } from "../api/config";
import type { HourlyPoint, DailySummaryApi } from "../api/types";

const METRIC_ORDER: MetricKey[] = ["temperature", "humidity", "windSpeed", "precipitation"];

function toWeatherPoints(points: HourlyPoint[], metricKey: MetricKey): WeatherPoint[] {
  const fmt = (h: number) => `${(h % 24).toString().padStart(2, "0")}:00`;
  return points.map((p) => ({
    hour: p.hour,
    label: fmt(p.hour),
    temperature: 0,
    humidity: 0,
    windSpeed: 0,
    precipitation: 0,
    [metricKey]: p.value,
  }));
}

function toDailySummaries(summaries: DailySummaryApi[]): DailySummary[] {
  return summaries.map((s, i) => ({
    ...s,
    index: i,
    spread: Math.max(0, s.max - s.min),
  }));
}

function MetricChart({ metricKey }: { metricKey: MetricKey }) {
  const config = metricChartConfig[metricKey];

  const hourly = useHourlyMetric(STATION_ID, metricKey);
  const daily7 = useDailyMetric(STATION_ID, metricKey, 7);
  const daily30 = useDailyMetric(STATION_ID, metricKey, 30);
  const daily365 = useDailyMetric(STATION_ID, metricKey, 365);

  const loading = hourly.loading || daily7.loading || daily30.loading || daily365.loading;
  const error = hourly.error ?? daily7.error ?? daily30.error ?? daily365.error ?? null;

  const data = hourly.data ? toWeatherPoints(hourly.data.points, metricKey) : [];
  const d7 = daily7.data ? toDailySummaries(daily7.data.summaries) : [];
  const d30 = daily30.data ? toDailySummaries(daily30.data.summaries) : [];
  const d365 = daily365.data ? toDailySummaries(daily365.data.summaries) : [];

  return (
    <ChartCard
      title={config.title}
      subtitle={config.subtitle}
      tone={config.tone}
      kind={config.kind}
      data={data}
      dataKey={config.dataKey}
      metricKey={metricKey}
      daily7={d7}
      daily30={d30}
      daily365={d365}
      unit={config.unit}
      color={config.color}
      domainMin={config.domainMin}
      domainMax={config.domainMax}
      axisStep={config.axisStep}
      tickStep={config.tickStep}
      loading={loading}
      error={error}
    />
  );
}

export function GraficasPanel() {
  return (
    <section style={{ marginTop: "18px" }}>
      <div className="section-title-wrap">
        <h2>Datos históricos</h2>
        <span className="section-subtitle">Análisis de Station Alpha.</span>
      </div>
      <div className="charts-grid" aria-label="Graficas historicas">
        {METRIC_ORDER.map((metricKey) => (
          <MetricChart key={metricKey} metricKey={metricKey} />
        ))}
      </div>
    </section>
  );
}
