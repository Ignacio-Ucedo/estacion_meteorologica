import { ChartCard } from "./ChartCard";
import { weatherSeries, dailySeries } from "../data/WeatherSeries";
import { metricChartConfig } from "../data/MetricChartConfig";
import type { MetricKey } from "../data/WeatherSeries";

const METRIC_ORDER: MetricKey[] = ["temperature", "humidity", "windSpeed", "precipitation"];

export function GraficasPanel() {
  return (
    <section style={{ "marginTop": "18px" }}>
      <div className="section-title-wrap">
          <h2>Datos históricos</h2>
          <span className="section-subtitle">Analisís de Station Alpha.</span>
      </div>
      <div className="charts-grid" aria-label="Graficas historicas">
        {METRIC_ORDER.map((metricKey) => {
          const config = metricChartConfig[metricKey];
          return (
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
          );
        })}
      </div>
    </section>
  );
}
