import { useMemo } from "react";
import { FinanceMetricsChart } from "@/components/FinanceMetricsChart";
import { ProgressMetricCard } from "@/components/ui/progress-metric-card";
import {
  buildDailyFinanceData,
  buildFinanceMetricSummaries,
  buildIncomeSeries,
  buildSpendSeries,
  buildWeeklyFinanceData,
  formatAxisDate,
  netBalance,
} from "@/lib/finance/metrics";
import { useFinance } from "@/app/hooks/useFinanceStore";

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function OverviewView() {
  const { state } = useFinance();
  const { transactions, settings } = state;

  const daily = useMemo(() => buildDailyFinanceData(transactions), [transactions]);
  const chartData = useMemo(() => buildWeeklyFinanceData(transactions), [transactions]);
  const metrics = useMemo(() => buildFinanceMetricSummaries(daily), [daily]);
  const spendSeries = useMemo(() => buildSpendSeries(transactions), [transactions]);
  const incomeSeries = useMemo(() => buildIncomeSeries(transactions), [transactions]);
  const balance = useMemo(() => netBalance(state), [state]);

  if (!transactions.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Add transactions to see overview metrics.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-panel anim-1 flex flex-col justify-center p-6 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Current balance
          </p>
          <p
            className="mt-2 text-4xl font-semibold tracking-tight tabular-nums"
            style={{ color: "var(--ink)" }}
          >
            {formatMoney(balance, settings.currency)}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {transactions.length} transactions · {settings.currency}
          </p>
        </div>
        <ProgressMetricCard
          title="Daily spend"
          data={spendSeries}
          accent="rose"
          valueFormatter={(v) => formatMoney(v, settings.currency)}
          dateFormatter={formatAxisDate}
          className="anim-2 sm:col-span-1"
        />
        <ProgressMetricCard
          title="Daily income"
          data={incomeSeries}
          accent="emerald"
          valueFormatter={(v) => formatMoney(v, settings.currency)}
          dateFormatter={formatAxisDate}
          className="anim-2 sm:col-span-1"
        />
      </div>

      <div className="anim-3">
        <FinanceMetricsChart data={chartData} metrics={metrics} />
      </div>
    </div>
  );
}
