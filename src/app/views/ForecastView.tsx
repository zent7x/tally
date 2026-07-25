import { useMemo } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { ProgressMetricCard } from "@/components/ui/progress-metric-card";
import { nMonthsData } from "@/lib/finance/balances";
import { monthCount, netBalance } from "@/lib/finance/metrics";

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );
}

function monthLabel(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function monthKey(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ForecastView() {
  const { state } = useFinance();
  const { transactions, settings } = state;

  const projection = useMemo(() => {
    const months = Math.max(1, monthCount(transactions));
    const totalIncome = transactions.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const totalSpend = transactions.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);
    const avgIncome = totalIncome / months;
    const avgSpend = totalSpend / months;
    const monthlyNet = avgIncome - avgSpend;

    let balance = netBalance(state);
    const rows: { key: string; label: string; net: number; balance: number }[] = [];
    const balanceSeries: { date: string; value: number }[] = [];

    for (let i = 1; i <= 12; i++) {
      balance += monthlyNet;
      const label = monthLabel(i);
      rows.push({ key: monthKey(i), label, net: monthlyNet, balance });
      balanceSeries.push({ date: label, value: balance });
    }

    return { avgIncome, avgSpend, monthlyNet, rows, balanceSeries, months: nMonthsData(transactions) };
  }, [state, transactions]);

  if (!transactions.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Add transactions to generate a forecast.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-panel p-5">
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Avg monthly income
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--text)" }}>
            {formatMoney(projection.avgIncome, settings.currency)}
          </p>
        </div>
        <div className="glass-panel p-5">
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Avg monthly spend
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--text)" }}>
            {formatMoney(projection.avgSpend, settings.currency)}
          </p>
        </div>
        <div className="glass-panel p-5">
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Monthly net
          </p>
          <p
            className="mt-1 text-2xl font-semibold tabular-nums tracking-tight"
            style={{ color: projection.monthlyNet >= 0 ? "#0b6e3e" : "#b23423" }}
          >
            {projection.monthlyNet >= 0 ? "+" : ""}
            {formatMoney(projection.monthlyNet, settings.currency)}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Based on {projection.months} month{projection.months === 1 ? "" : "s"} of history
          </p>
        </div>
      </div>

      <ProgressMetricCard
        title="Projected balance"
        data={projection.balanceSeries}
        accent={projection.monthlyNet >= 0 ? "emerald" : "rose"}
        valueFormatter={(v) => formatMoney(v, settings.currency)}
        dateFormatter={(date) => date}
        periods={[{ label: "12M", points: 12 }]}
        defaultPeriod="12M"
      />

      <section className="glass-panel overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--wash)" }}>
              {["Month", "Net change", "Ending balance"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((row) => (
              <tr key={row.key} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3">{row.label}</td>
                <td
                  className="px-4 py-3 tabular-nums"
                  style={{ color: row.net >= 0 ? "#0b6e3e" : "#b23423" }}
                >
                  {row.net >= 0 ? "+" : ""}
                  {formatMoney(row.net, settings.currency)}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums" style={{ color: "var(--text)" }}>
                  {formatMoney(row.balance, settings.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
