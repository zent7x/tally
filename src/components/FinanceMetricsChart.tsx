import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge-2";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/line-charts-6";
import { formatAxisDate, formatAxisMoney, metricPercentageChange } from "@/lib/finance/metrics";
import { cn } from "@/lib/utils";

export type FinanceMetricKey = "spend" | "income" | "net" | "transactions";

export interface FinanceDataPoint {
  date: string;
  spend: number;
  income: number;
  net: number;
  transactions: number;
}

export interface FinanceMetricSummary {
  key: FinanceMetricKey;
  label: string;
  value: number;
  previousValue: number;
  format: (value: number) => string;
  isNegative?: boolean;
}

const TALLY_GREEN = "var(--chart-emerald)";

const chartConfig = {
  spend: {
    label: "Spend",
    color: TALLY_GREEN,
  },
  income: {
    label: "Income",
    color: "var(--chart-blue)",
  },
  net: {
    label: "Net",
    color: "var(--chart-violet)",
  },
  transactions: {
    label: "Transactions",
    color: "var(--chart-amber)",
  },
} satisfies ChartConfig;

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
}

function FinanceTooltip({
  active,
  payload,
  metrics,
  label,
}: TooltipProps & { metrics: FinanceMetricSummary[] }) {
  if (active && payload && payload.length) {
    const entry = payload[0];
    const metric = metrics.find((item) => item.key === entry.dataKey);

    if (metric) {
      return (
        <div className="min-w-[120px] rounded-lg border bg-popover p-3 shadow-sm shadow-black/5">
          {label != null && <p className="mb-1 text-xs text-muted-foreground">{formatAxisDate(String(label))}</p>}
          <div className="flex items-center gap-2 text-sm">
            <div
              className="size-1.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{metric.label}:</span>
            <span className="font-semibold text-popover-foreground">
              {metric.format(entry.value)}
            </span>
          </div>
        </div>
      );
    }
  }

  return null;
}

export interface FinanceMetricsChartProps {
  className?: string;
  data: FinanceDataPoint[];
  defaultMetric?: FinanceMetricKey;
  metrics: FinanceMetricSummary[];
  currency?: string;
}

export function FinanceMetricsChart({
  className,
  data,
  defaultMetric = "spend",
  metrics,
  currency = "USD",
}: FinanceMetricsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<FinanceMetricKey>(defaultMetric);

  return (
    <Card className={cn("@container w-full", className)}>
      <CardHeader className="mb-5 p-0">
        <div className="grid grow @2xl:grid-cols-2 @3xl:grid-cols-4">
          {metrics.map((metric) => {
            const change = metricPercentageChange(metric.value, metric.previousValue);
            const isPositive = change !== null && (metric.isNegative ? change < 0 : change > 0);
            const isNeutral = change === null || change === 0 || metric.key === "transactions";

            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => setSelectedMetric(metric.key)}
                aria-pressed={selectedMetric === metric.key}
                className={cn(
                  "flex-1 cursor-pointer border-b p-4 text-start transition-all last:border-b-0 @2xl:border-b @2xl:even:border-e @3xl:border-b-0 @3xl:border-e @3xl:last:border-e-0",
                  selectedMetric === metric.key && "bg-muted/50",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{metric.label}</span>
                  <Badge
                    variant={isNeutral ? "outline" : isPositive ? "success" : "destructive"}
                    appearance="outline"
                  >
                    {change !== null && change !== 0 && (change > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    {change === null ? "—" : `${Math.abs(change).toFixed(1)}%`}
                  </Badge>
                </div>
                <div className="text-2xl font-bold">{metric.format(metric.value)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {metric.previousValue === 0 && metric.key !== "net" ? "No prior activity" : `Previous 30 days: ${metric.format(metric.previousValue)}`}
                </div>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="px-2.5 py-6">
        <ChartContainer
          config={chartConfig}
          className="!aspect-auto aspect-auto h-96 w-full overflow-visible [&_.recharts-curve.recharts-tooltip-cursor]:stroke-initial"
        >
          <LineChart
            data={data}
            margin={{
              top: 12,
              right: 12,
              left: 0,
              bottom: 8,
            }}
          >
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickMargin={8}
              minTickGap={36}
              interval="preserveStartEnd"
              tickFormatter={formatAxisDate}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickMargin={8}
              width={64}
              tickCount={5}
              tickFormatter={(value) =>
                selectedMetric === "transactions"
                  ? String(Math.round(Number(value)))
                  : formatAxisMoney(Number(value), currency)
              }
            />

            <ChartTooltip
              content={<FinanceTooltip metrics={metrics} />}
              cursor={{ strokeDasharray: "3 3", stroke: "#9ca3af" }}
              labelFormatter={(label) => formatAxisDate(String(label))}
            />

            <Line
              type="monotone"
              dataKey={selectedMetric}
              stroke={chartConfig[selectedMetric].color}
              strokeWidth={2.5}
              connectNulls
              dot={false}
              isAnimationActive={false}
              activeDot={{
                r: 5,
                fill: chartConfig[selectedMetric].color,
                stroke: "white",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
