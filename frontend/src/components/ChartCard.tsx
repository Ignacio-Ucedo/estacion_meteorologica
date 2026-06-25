import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
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
import { DualRangeSlider } from "./Dualrangeslider";
import { ChartTooltip } from "./Charttooltip";
import type { WeatherPoint } from "../data/Weatherseries";

export type ChartKind = "line" | "area" | "bar";

type ChartCardProps = {
  title: string;
  subtitle: string;
  tone: "warm" | "cool" | "wind" | "rain";
  kind: ChartKind;
  data: WeatherPoint[];
  dataKey: keyof WeatherPoint;
  unit: string;
  color: string;
  domainMin: number;
  domainMax: number;
  axisStep: number;
  tickStep: number;
  currentValue: number;
};

const X_TICKS = [0, 4, 8, 12, 16, 20, 24];

export function ChartCard({
  title,
  subtitle,
  tone,
  kind,
  data,
  dataKey,
  unit,
  color,
  domainMin,
  domainMax,
  axisStep,
  tickStep,
  currentValue,
}: ChartCardProps) {
  const [range, setRange] = useState<[number, number]>([domainMin, domainMax]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = range[0]; v <= range[1]; v += tickStep) {
      ticks.push(Math.round(v * 10) / 10);
    }
    if (ticks[ticks.length - 1] !== range[1]) ticks.push(range[1]);
    return ticks;
  }, [range, tickStep]);

  const gradientId = `gradient-${dataKey}`;

  return (
    <article className={`chart-card ${tone}`}>
      <div className="chart-card-head">
        <div>
          <div className="chart-card-title">
            <span className="metric-signal" aria-hidden="true" />
            <span>{title}</span>
          </div>
          <p className="chart-card-subtitle">{subtitle}</p>
        </div>
        <div className="chart-card-current">
          {currentValue}
          <small>{unit}</small>
        </div>
      </div>

      <div className="chart-card-body">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                type="number"
                domain={[0, 24]}
                ticks={X_TICKS}
                tickFormatter={(h: number) => `${h.toString().padStart(2, "0")}:00`}
                stroke="#45464d"
              />
              <YAxis
                domain={[range[0], range[1]]}
                ticks={yTicks}
                stroke="#45464d"
                width={40}
              />
              <Tooltip
                content={<ChartTooltip unit={unit} valueLabel={title} />}
                cursor={{ stroke: "#45464d" }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: "#131315", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          ) : kind === "area" ? (
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                type="number"
                domain={[0, 24]}
                ticks={X_TICKS}
                tickFormatter={(h: number) => `${h.toString().padStart(2, "0")}:00`}
                stroke="#45464d"
              />
              <YAxis
                domain={[range[0], range[1]]}
                ticks={yTicks}
                stroke="#45464d"
                width={40}
              />
              <Tooltip
                content={<ChartTooltip unit={unit} valueLabel={title} />}
                cursor={{ stroke: "#45464d" }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                type="number"
                domain={[0, 24]}
                ticks={X_TICKS}
                tickFormatter={(h: number) => `${h.toString().padStart(2, "0")}:00`}
                stroke="#45464d"
              />
              <YAxis
                domain={[range[0], range[1]]}
                ticks={yTicks}
                stroke="#45464d"
                width={40}
              />
              <Tooltip
                content={<ChartTooltip unit={unit} valueLabel={title} />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="chart-card-controls">
        <div className="axis-scale-control">
          <span className="axis-scale-label">Escala eje Y</span>
          <DualRangeSlider
            min={domainMin}
            max={domainMax}
            step={axisStep}
            value={range}
            onChange={setRange}
          />
          <span className="axis-scale-values">
            {range[0]} – {range[1]} {unit}
          </span>
        </div>
        <button
          className="reset-scale-btn"
          type="button"
          onClick={() => setRange([domainMin, domainMax])}
        >
          Restablecer
        </button>
      </div>
    </article>
  );
}