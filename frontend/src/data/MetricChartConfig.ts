import type { WeatherPoint, MetricKey } from "./WeatherSeries";
import type { ChartKind } from "../components/ChartCard";

export type MetricChartConfig = {
  title: string;
  subtitle: string;
  tone: "warm" | "cool" | "wind" | "rain";
  kind: ChartKind;
  dataKey: keyof WeatherPoint;
  unit: string;
  color: string;
  domainMin: number;
  domainMax: number;
  axisStep: number;
  tickStep: number;
};

export const metricChartConfig: Record<MetricKey, MetricChartConfig> = {
  temperature: {
    title: "Temperatura",
    subtitle: "Últimas 24 horas",
    tone: "warm",
    kind: "line",
    dataKey: "temperature",
    unit: "°C",
    color: "#d9a56c",
    domainMin: -10,
    domainMax: 50,
    axisStep: 5,
    tickStep: 5,
  },
  humidity: {
    title: "Humedad relativa",
    subtitle: "Últimas 24 horas",
    tone: "cool",
    kind: "area",
    dataKey: "humidity",
    unit: "%",
    color: "#7cb7d8",
    domainMin: 0,
    domainMax: 100,
    axisStep: 5,
    tickStep: 5,
  },
  windSpeed: {
    title: "Velocidad del viento",
    subtitle: "Últimas 24 horas",
    tone: "wind",
    kind: "line",
    dataKey: "windSpeed",
    unit: "km/h",
    color: "#a2d2a8",
    domainMin: 0,
    domainMax: 120,
    axisStep: 5,
    tickStep: 10,
  },
  precipitation: {
    title: "Precipitación",
    subtitle: "Últimas 24 horas",
    tone: "rain",
    kind: "bar",
    dataKey: "precipitation",
    unit: "mm",
    color: "#8da4de",
    domainMin: 0,
    domainMax: 60,
    axisStep: 5,
    tickStep: 10,
  },
};
