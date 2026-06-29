import { JSX, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChartTooltip, DailyBandTooltip } from "./Charttooltip";
import type { WeatherPoint } from "../data/WeatherSeries";
import type { DailySummary, MetricKey } from "../data/WeatherSeries";

export type ChartKind = "line" | "area" | "bar";
type Period = "1D" | "7D" | "30D" | "1Y";

type ChartCardProps = {
  title: string;
  subtitle: string;
  tone: "warm" | "cool" | "wind" | "rain";
  kind: ChartKind;
  data: WeatherPoint[];
  dataKey: keyof WeatherPoint;
  metricKey: MetricKey;
  daily7: DailySummary[];
  daily30: DailySummary[];
  daily365: DailySummary[];
  unit: string;
  color: string;
  domainMin: number;
  domainMax: number;
  axisStep: number;
  tickStep: number;
  loading?: boolean;
  error?: string | null;
};

const X_TICKS_1D = [0, 4, 8, 12, 16, 20, 24];
const X_TICKS_7D = [0, 1, 2, 3, 4, 5, 6];
const X_TICKS_30D = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27];
const PERIODS: Period[] = ["1D", "7D", "30D", "1Y"];

function idealFrom1D(
  data: WeatherPoint[], dataKey: keyof WeatherPoint,
  domainMin: number, domainMax: number, tickStep: number,
): [number, number] {
  if (data.length === 0) return [domainMin, domainMax];
  const values = data.map((d) => d[dataKey] as number);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = Math.max(domainMin, Math.floor(rawMin / tickStep) * tickStep);
  const max = Math.min(domainMax, Math.ceil((rawMax + 1e-9) / tickStep) * tickStep);
  return [min, max];
}

function idealFromDaily(
  summaries: DailySummary[], domainMin: number, domainMax: number, tickStep: number,
): [number, number] {
  if (summaries.length === 0) return [domainMin, domainMax];
  const rawMin = Math.min(...summaries.map((d) => d.min));
  const rawMax = Math.max(...summaries.map((d) => d.max));
  const min = Math.max(domainMin, Math.floor(rawMin / tickStep) * tickStep);
  const max = Math.min(domainMax, Math.ceil((rawMax + 1e-9) / tickStep) * tickStep);
  return [min, max];
}

export function ChartCard({
  title,
  subtitle,
  tone,
  kind,
  data,
  dataKey,
  daily7,
  daily30,
  daily365,
  unit,
  color,
  domainMin,
  domainMax,
  axisStep,
  tickStep,
  loading = false,
  error = null,
}: ChartCardProps) {
  const [period, setPeriod] = useState<Period>("1D");

  const idealDomain1D  = useMemo(() => idealFrom1D(data, dataKey, domainMin, domainMax, tickStep), [data, dataKey, domainMin, domainMax, tickStep]);
  const idealDomain7D  = useMemo(() => idealFromDaily(daily7,   domainMin, domainMax, tickStep), [daily7,   domainMin, domainMax, tickStep]);
  const idealDomain30D = useMemo(() => idealFromDaily(daily30,  domainMin, domainMax, tickStep), [daily30,  domainMin, domainMax, tickStep]);
  const idealDomain1Y  = useMemo(() => idealFromDaily(daily365, domainMin, domainMax, tickStep), [daily365, domainMin, domainMax, tickStep]);

  const [range, setRange] = useState<[number, number]>(idealDomain1D);

  const activeIdealDomain =
    period === "1D"  ? idealDomain1D  :
    period === "7D"  ? idealDomain7D  :
    period === "30D" ? idealDomain30D : idealDomain1Y;

  function changePeriod(p: Period) {
    const d = p === "1D" ? idealDomain1D : p === "7D" ? idealDomain7D : p === "30D" ? idealDomain30D : idealDomain1Y;
    setPeriod(p);
    setRange(d);
  }

  const extremes = useMemo(() => {
    if (period === "1D") {
      if (data.length === 0) return { max: 0, maxWhen: "—", min: 0, minWhen: "—" };
      let maxVal = -Infinity, maxHour = 0;
      let minVal = Infinity, minHour = 0;
      for (const pt of data) {
        const v = pt[dataKey] as number;
        if (v > maxVal) { maxVal = v; maxHour = pt.hour; }
        if (v < minVal) { minVal = v; minHour = pt.hour; }
      }
      const fh = (h: number) => `${(h % 24).toString().padStart(2, "0")}:00 ART`;
      return { max: maxVal, maxWhen: fh(maxHour), min: minVal, minWhen: fh(minHour) };
    }
    const src = period === "7D" ? daily7 : period === "30D" ? daily30 : daily365;
    if (src.length === 0) return { max: 0, maxWhen: "—", min: 0, minWhen: "—" };
    let maxVal = -Infinity, maxIdx = 0;
    let minVal = Infinity, minIdx = 0;
    for (let i = 0; i < src.length; i++) {
      if (src[i].max > maxVal) { maxVal = src[i].max; maxIdx = i; }
      if (src[i].min < minVal) { minVal = src[i].min; minIdx = i; }
    }
    const labelOf = (s: DailySummary) => period === "7D" ? s.dayLabel : s.dateLabel;
    return { max: maxVal, maxWhen: labelOf(src[maxIdx]), min: minVal, minWhen: labelOf(src[minIdx]) };
  }, [period, data, dataKey, daily7, daily30, daily365]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = range[0]; v <= range[1]; v += tickStep) ticks.push(Math.round(v * 10) / 10);
    if (ticks[ticks.length - 1] !== range[1]) ticks.push(range[1]);
    return ticks;
  }, [range, tickStep]);

  const yearTicks = useMemo(
    () => daily365.filter((d) => d.isMonthStart || d.index === 0).map((d) => d.index),
    [daily365],
  );

  const gradientId = `gradient-${dataKey}`;
  const bandId = `band-${dataKey}`;

  const yAxis = (
    <YAxis domain={[range[0], range[1]]} ticks={yTicks} stroke="#45464d" tick={{ fill: "#c6c6cd", fontSize: 11 }} width={36} />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2b2e" />;

  function xAxis7D() {
    return (
      <XAxis dataKey="index" type="number" domain={[0, 6]} ticks={X_TICKS_7D}
        tickFormatter={(i: number) => daily7[i]?.dayLabel ?? ""}
        stroke="#45464d" tick={{ fill: "#c6c6cd", fontSize: 11 }} />
    );
  }
  function xAxis30D() {
    return (
      <XAxis dataKey="index" type="number" domain={[0, 29]} ticks={X_TICKS_30D}
        tickFormatter={(i: number) => daily30[i]?.dateLabel ?? ""}
        stroke="#45464d" tick={{ fill: "#c6c6cd", fontSize: 11 }} />
    );
  }
  function xAxis1Y() {
    return (
      <XAxis dataKey="index" type="number" domain={[0, 364]} ticks={yearTicks}
        tickFormatter={(i: number) => daily365[i]?.monthLabel ?? ""}
        stroke="#45464d" tick={{ fill: "#c6c6cd", fontSize: 11 }} />
    );
  }

  function bandChart(dailyData: DailySummary[], xAxisEl: JSX.Element, showDots: boolean) {
    return (
      <ComposedChart data={dailyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={bandId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.07} />
          </linearGradient>
        </defs>
        {grid}
        {xAxisEl}
        {yAxis}
        <Tooltip
          content={<DailyBandTooltip unit={unit} is7D={period === "7D"} />}
          cursor={{ stroke: "#45464d" }}
        />
        <Area type="monotone" dataKey="max" baseValue={range[0]}
          stroke="none" fill={`url(#${bandId})`} isAnimationActive={false} legendType="none" />
        <Area type="monotone" dataKey="min" baseValue={range[0]}
          stroke="none" fill="#1b1b1d" isAnimationActive={false} legendType="none" />
        <Line type="monotone" dataKey="mean" stroke={color} strokeWidth={2}
          dot={showDots ? { r: 3, fill: color, stroke: "#131315", strokeWidth: 1.5 } : false}
          activeDot={{ r: 4, fill: color, stroke: "#131315", strokeWidth: 2 }}
          isAnimationActive={false} />
      </ComposedChart>
    );
  }

  function renderChart() {
    if (period === "7D")  return bandChart(daily7,   xAxis7D(),  true);
    if (period === "30D") return bandChart(daily30,  xAxis30D(), false);
    if (period === "1Y")  return bandChart(daily365, xAxis1Y(),  false);

    const xAxis1D = (
      <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={X_TICKS_1D}
        tickFormatter={(h: number) => `${h.toString().padStart(2, "0")}:00`}
        stroke="#45464d" tick={{ fill: "#c6c6cd", fontSize: 11 }} />
    );

    if (kind === "line") return (
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {grid}{xAxis1D}{yAxis}
        <Tooltip content={<ChartTooltip unit={unit} valueLabel={title} />} cursor={{ stroke: "#45464d" }} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false}
          activeDot={{ r: 4, fill: color, stroke: "#131315", strokeWidth: 2 }} isAnimationActive={false} />
      </LineChart>
    );

    if (kind === "area") return (
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        {grid}{xAxis1D}{yAxis}
        <Tooltip content={<ChartTooltip unit={unit} valueLabel={title} />} cursor={{ stroke: "#45464d" }} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5}
          fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    );

    return (
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {grid}{xAxis1D}{yAxis}
        <Tooltip content={<ChartTooltip unit={unit} valueLabel={title} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    );
  }

  const currentData = period === "1D" ? data : period === "7D" ? daily7 : period === "30D" ? daily30 : daily365;
  const isEmpty = !loading && !error && currentData.length === 0;

  return (
    <article className={`chart-card ${tone}`}>
      <div className="chart-card-head">
        <div>
          <div className="chart-card-title">
            <span className="metric-signal" aria-hidden="true" />
            <span>{title}</span>
          </div>
          <p className="chart-card-subtitle">
            {period === "1D"  ? subtitle :
             period === "7D"  ? "Últimos 7 días" :
             period === "30D" ? "Últimos 30 días" :
             "Últimos 12 meses"}
          </p>
        </div>
        <div className="chart-card-head-right">
          <div className="period-toggle">
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`period-btn${p === period ? " active" : ""}`}
                onClick={() => changePeriod(p)}
                aria-pressed={p === period}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-card-body">
        {loading ? (
          <div className="chart-state-overlay">Cargando datos…</div>
        ) : error ? (
          <div className="chart-state-overlay chart-state-error">
            Sin conexión al servidor
          </div>
        ) : isEmpty ? (
          <div className="chart-state-overlay">Sin datos disponibles</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );
}
