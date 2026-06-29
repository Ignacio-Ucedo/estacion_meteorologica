import { ChartCard } from "./ChartCard";
import { weatherSeries, dailySeries } from "../data/WeatherSeries";
import { metricChartConfig } from "../data/MetricChartConfig";
import type { MetricKey } from "../data/WeatherSeries";

type SelectedMetricChartProps = {
  metricKey: MetricKey;
};

export function SelectedMetricChart({ metricKey }: SelectedMetricChartProps) {
  const config = metricChartConfig[metricKey];

  return (
    <section className="selected-metric-chart" aria-label="Evolución de la variable seleccionada">
      <ChartCard
        key={metricKey}
        title={config.title}
        subtitle={config.subtitle}
        tone={config.tone}
        kind={config.kind}
        data={weatherSeries}
        dataKey={config.dataKey}
        metricKey={metricKey}
        daily7={dailySeries[metricKey].d7}
        daily30={dailySeries[metricKey].d30}
        daily365={dailySeries[metricKey].d365}
        unit={config.unit}
        color={config.color}
        domainMin={config.domainMin}
        domainMax={config.domainMax}
        axisStep={config.axisStep}
        tickStep={config.tickStep}
      />
    </section>
  );
}
