export type StationResponse = {
  id: string;
  name: string;
  location: string;
  status: "online" | "offline" | "degraded";
};

export type CurrentReading = {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
};

export type StationDetail = StationResponse & {
  lastUpdatedAt: string | null;
  current: CurrentReading | null;
};

export type ReadingResponse = {
  id: string;
  stationId: string;
  stationName: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
};

export type ReadingPage = {
  total: number;
  page: number;
  data: ReadingResponse[];
};

export type HourlyPoint = {
  hour: number;
  value: number;
};

export type HourlyMetricResponse = {
  metric: string;
  unit: string;
  date: string;
  points: HourlyPoint[];
};

export type DailySummaryApi = {
  date: string;
  dayLabel: string;
  dateLabel: string;
  monthLabel: string;
  isMonthStart: boolean;
  min: number;
  max: number;
  mean: number;
};

export type DailyMetricResponse = {
  metric: string;
  unit: string;
  days: number;
  summaries: DailySummaryApi[];
};
