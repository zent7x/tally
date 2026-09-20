import { useMemo } from "react";
import { FinanceMetricsChart } from "@/components/FinanceMetricsChart";
import { ProgressMetricCard } from "@/components/ui/progress-metric-card";
import {
  buildDailyFinanceData,
  buildFinanceMetricSummaries,
  buildIncomeSeries,
  buildSpendSeries,
  formatAxisDate,
  netBalance,
} from "@/lib/finance/metrics";
import { accountSummary } from "@/lib/finance/accounts";
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
  const chartData = useMemo(() => daily.slice(-30), [daily]);
  const metrics = useMemo(() => buildFinanceMetricSummaries(daily, settings.currency), [daily, settings.currency]);
  const spendSeries = useMemo(() => buildSpendSeries(transactions), [transactions]);
  const incomeSeries = useMemo(() => buildIncomeSeries(transactions), [transactions]);
  const balance = useMemo(() => netBalance(state), [state]);

  const summary = useMemo(() => accountSummary(state), [state]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-panel anim-1 flex flex-col justify-center p-6 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Liquid cash
          </p>
          <p
            className="mt-2 text-4xl font-semibold tracking-tight tabular-nums"
            style={{ color: "var(--ink)" }}
          >
            {formatMoney(balance, settings.currency)}
          </p>
          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Net worth</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(summary.netWorth, settings.currency)}</p>
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>Assets minus debts across {state.accounts.length} {state.accounts.length === 1 ? "account" : "accounts"}.</p>
          </div>
        </div>
        <ProgressMetricCard
          title="Daily spend"
          periods={[{ label: "7D", points: 7 }, { label: "14D", points: 14 }, { label: "30D", points: 30 }, { label: "45D", points: 45 }]}
          defaultPeriod="30D"
          data={spendSeries}
          accent="rose"
          valueFormatter={(v) => formatMoney(v, settings.currency)}
          dateFormatter={formatAxisDate}
          className="anim-2 sm:col-span-1"
        />
        <ProgressMetricCard
          title="Daily income"
          periods={[{ label: "7D", points: 7 }, { label: "14D", points: 14 }, { label: "30D", points: 30 }, { label: "45D", points: 45 }]}
          defaultPeriod="30D"
          data={incomeSeries}
          accent="emerald"
          valueFormatter={(v) => formatMoney(v, settings.currency)}
          dateFormatter={formatAxisDate}
          className="anim-2 sm:col-span-1"
        />
      </div>

      <section className="anim-3 space-y-3" aria-labelledby="cash-flow-title">
        <div>
          <h3 id="cash-flow-title" className="text-lg font-semibold">Your last 30 days</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {formatAxisDate(chartData[0]!.date)} – {formatAxisDate(chartData[chartData.length - 1]!.date)} · Compared with the previous 30 days. Transfers are excluded from cash flow.
          </p>
          {!transactions.length && <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Add or import transactions to see your activity here.</p>}
        </div>
        <FinanceMetricsChart data={chartData} metrics={metrics} currency={settings.currency} />
      </section>
    </div>
  );
}
