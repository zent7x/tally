import { cn } from "@/lib/utils";
import { useId, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  BarChart,
} from "recharts";
import type { TooltipProps } from "recharts";

export type SeriesPoint = {
  value: number;
  date: string;
};

export type MetricSeries = SeriesPoint[];

export type MetricAccent = "emerald" | "rose" | "neutral" | "blue" | "amber";

export type ChartView = "curve" | "bars";

export type ChartSeries = {
  id?: string;
  label?: string;
  accent?: MetricAccent;
  data: MetricSeries;
};

export const ACCENTS: Record<
  MetricAccent,
  { stroke: string; text: string; fill: string }
> = {
  emerald: { stroke: "#146B4A", text: "#146B4A", fill: "#146B4A" },
  rose: { stroke: "#BE123C", text: "#BE123C", fill: "#BE123C" },
  neutral: { stroke: "#5B646C", text: "#5B646C", fill: "#5B646C" },
  blue: { stroke: "#2563EB", text: "#2563EB", fill: "#2563EB" },
  amber: { stroke: "#D97706", text: "#D97706", fill: "#D97706" },
};

export const SERIES_COLORS = [
  ACCENTS.emerald.stroke,
  ACCENTS.blue.stroke,
  ACCENTS.amber.stroke,
  ACCENTS.rose.stroke,
  ACCENTS.neutral.stroke,
];

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  }
  return `${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}`;
}

type ChartRow = SeriesPoint & { index: number };

export type MetricChartProps = {
  data: MetricSeries;
  view?: ChartView;
  accent?: MetricAccent;
  activeIndex?: number;
  defaultIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
  className?: string;
  height?: number;
};

function defaultValueFormatter(value: number) {
  return formatCompact(value);
}

function defaultDateFormatter(date: string) {
  return date;
}

function ChartTooltip({
  active,
  payload,
  valueFormatter,
  dateFormatter,
  accent,
}: TooltipProps<number, string> & {
  valueFormatter: (value: number) => string;
  dateFormatter: (date: string) => string;
  accent: MetricAccent;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) {
    return null;
  }

  const colors = ACCENTS[accent];

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-sm"
      style={{
        background: "var(--surface, #fff)",
        borderColor: "var(--border, #e3e1d8)",
      }}
    >
      <p className="text-[11px]" style={{ color: "var(--muted, #5b646c)" }}>
        {dateFormatter(row.date)}
      </p>
      <p
        className="text-sm font-semibold tabular-nums tracking-tight"
        style={{ color: colors.text }}
      >
        {valueFormatter(row.value)}
      </p>
    </div>
  );
}

export function MetricChart({
  data,
  view = "curve",
  accent = "emerald",
  activeIndex: activeIndexProp,
  defaultIndex = Math.max(0, data.length - 1),
  onActiveIndexChange,
  valueFormatter = defaultValueFormatter,
  dateFormatter = defaultDateFormatter,
  className,
  height = 168,
}: MetricChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const fillGradientId = `metric-fill-${gradientId}`;
  const colors = ACCENTS[accent];

  const resolvedIndex =
    hoverIndex ?? activeIndexProp ?? defaultIndex ?? Math.max(0, data.length - 1);

  const chartData = useMemo<ChartRow[]>(
    () => data.map((point, index) => ({ ...point, index })),
    [data]
  );

  const handleMouseMove = (state: { activeTooltipIndex?: number }) => {
    if (typeof state.activeTooltipIndex === "number") {
      setHoverIndex(state.activeTooltipIndex);
      onActiveIndexChange?.(state.activeTooltipIndex);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    onActiveIndexChange?.(defaultIndex);
  };

  const sharedProps = {
    data: chartData,
    margin: { top: 8, right: 4, left: 4, bottom: 0 },
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };

  const activeDot = {
    r: 4,
    fill: colors.stroke,
    stroke: "var(--surface, #fff)",
    strokeWidth: 2,
  };

  const cursorFill = `${colors.fill}18`;

  return (
    <div className={cn("w-full", className)} style={{ height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        {view === "bars" ? (
          <BarChart {...sharedProps}>
            <CartesianGrid
              vertical={false}
              stroke="var(--border, #e3e1d8)"
              strokeDasharray="3 3"
              strokeOpacity={0.55}
            />
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              cursor={{ fill: cursorFill }}
              content={
                <ChartTooltip
                  accent={accent}
                  valueFormatter={valueFormatter}
                  dateFormatter={dateFormatter}
                />
              }
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              fill={colors.stroke}
              fillOpacity={0.88}
              activeBar={{ fill: colors.stroke, fillOpacity: 1 }}
            />
          </BarChart>
        ) : (
          <AreaChart {...sharedProps}>
            <defs>
              <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.fill} stopOpacity={0.28} />
                <stop offset="100%" stopColor={colors.fill} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border, #e3e1d8)"
              strokeDasharray="3 3"
              strokeOpacity={0.55}
            />
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              cursor={{ stroke: colors.stroke, strokeOpacity: 0.25 }}
              content={
                <ChartTooltip
                  accent={accent}
                  valueFormatter={valueFormatter}
                  dateFormatter={dateFormatter}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.stroke}
              strokeWidth={2.5}
              strokeOpacity={1}
              fill={`url(#${fillGradientId})`}
              activeDot={activeDot}
              dot={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>

      {chartData[resolvedIndex] ? (
        <span className="sr-only" aria-live="polite">
          {dateFormatter(chartData[resolvedIndex].date)}:{" "}
          {valueFormatter(chartData[resolvedIndex].value)}
        </span>
      ) : null}
    </div>
  );
}

export default MetricChart;
