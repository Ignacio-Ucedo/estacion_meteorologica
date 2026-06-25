import { ChartCard } from "./Chartcard";
import { weatherSeries, dailySeries } from "../data/Weatherseries";

export function GraficasPanel() {
  return (
    <section className="charts-grid" aria-label="Graficas historicas">
      <ChartCard
        title="Temperatura"
        subtitle="Curva horaria, 00:00 a 24:00"
        tone="warm"
        kind="line"
        data={weatherSeries}
        dataKey="temperature"
        metricKey="temperature"
        daily7={dailySeries.temperature.d7}
        daily30={dailySeries.temperature.d30}
        daily365={dailySeries.temperature.d365}
        unit="°C"
        color="#d9a56c"
        domainMin={-10}
        domainMax={50}
        axisStep={5}
        tickStep={10}
      />
      <ChartCard
        title="Humedad relativa"
        subtitle="Curva horaria, 00:00 a 24:00"
        tone="cool"
        kind="area"
        data={weatherSeries}
        dataKey="humidity"
        metricKey="humidity"
        daily7={dailySeries.humidity.d7}
        daily30={dailySeries.humidity.d30}
        daily365={dailySeries.humidity.d365}
        unit="%"
        color="#7cb7d8"
        domainMin={0}
        domainMax={100}
        axisStep={5}
        tickStep={20}
      />
      <ChartCard
        title="Velocidad del viento"
        subtitle="Curva horaria, 00:00 a 24:00"
        tone="wind"
        kind="line"
        data={weatherSeries}
        dataKey="windSpeed"
        metricKey="windSpeed"
        daily7={dailySeries.windSpeed.d7}
        daily30={dailySeries.windSpeed.d30}
        daily365={dailySeries.windSpeed.d365}
        unit="km/h"
        color="#a2d2a8"
        domainMin={0}
        domainMax={50}
        axisStep={5}
        tickStep={10}
      />
      <ChartCard
        title="Precipitación"
        subtitle="Acumulada por hora, 00:00 a 24:00"
        tone="rain"
        kind="bar"
        data={weatherSeries}
        dataKey="precipitation"
        metricKey="precipitation"
        daily7={dailySeries.precipitation.d7}
        daily30={dailySeries.precipitation.d30}
        daily365={dailySeries.precipitation.d365}
        unit="mm"
        color="#8da4de"
        domainMin={0}
        domainMax={60}
        axisStep={5}
        tickStep={10}
      />
    </section>
  );
}
