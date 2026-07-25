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
import { formatAxisDate, formatAxisMoney } from "@/lib/finance/metrics";
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

const TALLY_GREEN = "#146B4A";

export const demoFinanceData: FinanceDataPoint[] = [
  { date: "2024-04-01", spend: 142, income: 320, net: 178, transactions: 18 },
  { date: "2024-04-02", spend: 89, income: 0, net: -89, transactions: 11 },
  { date: "2024-04-03", spend: 118, income: 180, net: 62, transactions: 14 },
  { date: "2024-04-04", spend: 164, income: 0, net: -164, transactions: 21 },
  { date: "2024-04-05", spend: 201, income: 420, net: 219, transactions: 24 },
  { date: "2024-04-06", spend: 54, income: 0, net: -54, transactions: 7 },
  { date: "2024-04-07", spend: 176, income: 260, net: 84, transactions: 19 },
  { date: "2024-04-08", spend: 228, income: 0, net: -228, transactions: 26 },
  { date: "2024-04-09", spend: 72, income: 140, net: 68, transactions: 9 },
  { date: "2024-04-10", spend: 133, income: 0, net: -133, transactions: 16 },
  { date: "2024-04-11", spend: 149, income: 310, net: 161, transactions: 17 },
  { date: "2024-04-12", spend: 267, income: 0, net: -267, transactions: 29 },
  { date: "2024-04-13", spend: 155, income: 190, net: 35, transactions: 15 },
  { date: "2024-04-14", spend: 61, income: 0, net: -61, transactions: 8 },
  { date: "2024-04-15", spend: 98, income: 220, net: 122, transactions: 12 },
  { date: "2024-04-16", spend: 127, income: 0, net: -127, transactions: 14 },
  { date: "2024-04-17", spend: 312, income: 540, net: 228, transactions: 34 },
  { date: "2024-04-18", spend: 241, income: 0, net: -241, transactions: 27 },
];

const defaultMetrics: FinanceMetricSummary[] = [
  {
    key: "spend",
    label: "Spend",
    value: 2787,
    previousValue: 2510,
    format: (val) => `$${val.toLocaleString()}`,
  },
  {
    key: "income",
    label: "Income",
    value: 2590,
    previousValue: 2280,
    format: (val) => `$${val.toLocaleString()}`,
  },
  {
    key: "net",
    label: "Net",
    value: -197,
    previousValue: -230,
    format: (val) => `${val >= 0 ? "+" : "-"}$${Math.abs(val).toLocaleString()}`,
    isNegative: true,
  },
  {
    key: "transactions",
    label: "Transactions",
    value: 311,
    previousValue: 284,
    format: (val) => val.toLocaleString(),
  },
];

const chartConfig = {
  spend: {
    label: "Spend",
    color: TALLY_GREEN,
  },
  income: {
    label: "Income",
    color: "#2563eb",
  },
  net: {
    label: "Net",
    color: "#7c3aed",
  },
  transactions: {
    label: "Transactions",
    color: "#ca8a04",
  },
} satisfies ChartConfig;

interface TooltipProps {
  active?: boolean;
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
}: TooltipProps & { metrics: FinanceMetricSummary[] }) {
  if (active && payload && payload.length) {
    const entry = payload[0];
    const metric = metrics.find((item) => item.key === entry.dataKey);

    if (metric) {
      return (
        <div className="min-w-[120px] rounded-lg border bg-popover p-3 shadow-sm shadow-black/5">
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
  data?: FinanceDataPoint[];
  defaultMetric?: FinanceMetricKey;
  metrics?: FinanceMetricSummary[];
}

export function FinanceMetricsChart({
  className,
  data = demoFinanceData,
  defaultMetric = "spend",
  metrics = defaultMetrics,
}: FinanceMetricsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<FinanceMetricKey>(defaultMetric);

  return (
    <Card className={cn("@container w-full", className)}>
      <CardHeader className="mb-5 p-0">
        <div className="grid grow @2xl:grid-cols-2 @3xl:grid-cols-4">
          {metrics.map((metric) => {
            const change =
              ((metric.value - metric.previousValue) / metric.previousValue) * 100;
            const isPositive = metric.isNegative ? change < 0 : change > 0;

            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => setSelectedMetric(metric.key)}
                className={cn(
                  "flex-1 cursor-pointer border-b p-4 text-start transition-all last:border-b-0 @2xl:border-b @2xl:even:border-e @3xl:border-b-0 @3xl:border-e @3xl:last:border-e-0",
                  selectedMetric === metric.key && "bg-muted/50",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{metric.label}</span>
                  <Badge
                    variant={isPositive ? "success" : "destructive"}
                    appearance="outline"
                  >
                    {isPositive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {Math.abs(change).toFixed(1)}%
                  </Badge>
                </div>
                <div className="text-2xl font-bold">{metric.format(metric.value)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  from {metric.format(metric.previousValue)}
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
              width={44}
              tickCount={5}
              tickFormatter={(value) =>
                selectedMetric === "transactions"
                  ? String(Math.round(Number(value)))
                  : formatAxisMoney(Number(value))
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
