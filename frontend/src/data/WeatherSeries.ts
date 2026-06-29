export type WeatherPoint = {
  hour: number;
  label: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
};

export type DailySummary = {
  index: number;
  dayLabel: string;
  dateLabel: string;
  monthLabel: string;
  isMonthStart: boolean;
  min: number;
  max: number;
  mean: number;
  spread: number;
};

export type MetricKey = "temperature" | "humidity" | "windSpeed" | "precipitation";
