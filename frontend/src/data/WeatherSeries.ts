export type WeatherPoint = {
  hour: number; // 0–24
  label: string; // "00:00"
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  precipitation: number; // mm, accumulated in that hour
};

function formatHour(hour: number) {
  const h = hour % 24;
  return `${h.toString().padStart(2, "0")}:00`;
}

// ─── Daily summary types & generation ────────────────────

export type DailySummary = {
  index: number;
  dayLabel: string;      // "Lun" — for 7D x-axis
  dateLabel: string;     // "25 jun" — for 30D tooltip
  monthLabel: string;    // "Jun" — for 1Y x-axis
  isMonthStart: boolean;
  min: number;
  max: number;
  mean: number;
  spread: number; // max - min, used for stacked band area
};

export type MetricKey = "temperature" | "humidity" | "windSpeed" | "precipitation";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_LABEL = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Deterministic pseudo-random in [0,1) for a given seed
function prng(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type MetricParams = {
  base: number;
  seasonalAmp: number;
  warmInSummer: boolean; // southern hemisphere: summer = Dec
  dailySpread: number;
  noise: number;
  clampMin: number;
  clampMax: number;
  dec: number;
};

const METRIC_PARAMS: Record<MetricKey, MetricParams> = {
  temperature:   { base: 14, seasonalAmp: 8,   warmInSummer: true,  dailySpread: 8,  noise: 2, clampMin: -15, clampMax: 45,  dec: 1 },
  humidity:      { base: 65, seasonalAmp: 10,  warmInSummer: false, dailySpread: 18, noise: 6, clampMin: 20,  clampMax: 100, dec: 0 },
  windSpeed:     { base: 14, seasonalAmp: 4,   warmInSummer: true,  dailySpread: 12, noise: 4, clampMin: 0,   clampMax: 60,  dec: 1 },
  precipitation: { base: 1.5, seasonalAmp: 1.5, warmInSummer: false, dailySpread: 3, noise: 2, clampMin: 0,   clampMax: 40,  dec: 1 },
};

function generateDailySeries(metric: MetricKey, days: number): DailySummary[] {
  const p = METRIC_PARAMS[metric];
  const now = new Date();
  const results: DailySummary[] = [];
  const rd = (v: number) => { const f = 10 ** p.dec; return Math.round(v * f) / f; };
  const cl = (v: number) => Math.max(p.clampMin, Math.min(p.clampMax, v));
  const mKey = metric.charCodeAt(0);

  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - (days - 1 - i) * 86_400_000);
    // Southern hemisphere: cold in June, warm in December
    const seasonSign = p.warmInSummer ? 1 : -1;
    const seasonal = seasonSign * p.seasonalAmp * (-Math.cos((2 * Math.PI * i) / 365));
    const noiseMean = (prng(i * 7 + mKey) - 0.5) * p.noise * 2;
    const meanVal = p.base + seasonal + noiseMean;

    const halfSpread = p.dailySpread / 2 * (0.75 + prng(i * 13 + mKey) * 0.5);
    const min = rd(cl(meanVal - halfSpread));
    const max = rd(cl(meanVal + halfSpread));
    const mean = rd(cl((min + max) / 2 + (prng(i * 19 + mKey) - 0.5) * halfSpread * 0.15));

    results.push({
      index: i,
      dayLabel: DAY_NAMES[d.getDay()],
      dateLabel: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`,
      monthLabel: MONTH_LABEL[d.getMonth()],
      isMonthStart: d.getDate() === 1,
      min, max, mean,
      spread: Math.max(0, max - min),
    });
  }
  return results;
}

export const dailySeries: Record<MetricKey, { d7: DailySummary[]; d30: DailySummary[]; d365: DailySummary[] }> = {
  temperature:   { d7: generateDailySeries("temperature", 7),    d30: generateDailySeries("temperature", 30),    d365: generateDailySeries("temperature", 365) },
  humidity:      { d7: generateDailySeries("humidity", 7),       d30: generateDailySeries("humidity", 30),       d365: generateDailySeries("humidity", 365) },
  windSpeed:     { d7: generateDailySeries("windSpeed", 7),      d30: generateDailySeries("windSpeed", 30),      d365: generateDailySeries("windSpeed", 365) },
  precipitation: { d7: generateDailySeries("precipitation", 7),  d30: generateDailySeries("precipitation", 30),  d365: generateDailySeries("precipitation", 365) },
};

// ─── Hourly 24h series ────────────────────────────────────

// Genera una serie horaria 0–24 con curvas plausibles para un dia templado
// con lluvia breve a la tarde, para alimentar las cuatro graficas.
export const weatherSeries: WeatherPoint[] = Array.from({ length: 25 }, (_, hour) => {
  // Temperatura: minimo de madrugada, pico a media tarde
  const temperature = 13 + 11 * Math.sin(((hour - 6) / 24) * Math.PI * 2 * -1 + Math.PI / 2.4);

  // Humedad: inversa a la temperatura, mas alta de madrugada
  const humidity = 68 - 22 * Math.sin(((hour - 6) / 24) * Math.PI * 2 * -1 + Math.PI / 2.4);

  // Viento: sube durante la tarde, con algo de ruido
  const windBase = 8 + 14 * Math.max(0, Math.sin(((hour - 9) / 14) * Math.PI));
  const windNoise = Math.sin(hour * 1.7) * 2.5;
  const windSpeed = Math.max(0, windBase + windNoise);

  // Precipitacion: una racha de lluvia entre las 15 y 19hs
  let precipitation = 0;
  if (hour >= 15 && hour <= 19) {
    const t = (hour - 15) / 4;
    precipitation = Math.max(0, Math.sin(t * Math.PI) * 6.5);
  }

  return {
    hour,
    label: formatHour(hour),
    temperature: Math.round(temperature * 10) / 10,
    humidity: Math.round(Math.max(0, Math.min(100, humidity))),
    windSpeed: Math.round(windSpeed * 10) / 10,
    precipitation: Math.round(precipitation * 10) / 10,
  };
});