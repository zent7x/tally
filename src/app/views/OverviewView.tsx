import { useMemo } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { ProgressMetricCard } from "@/components/ui/progress-metric-card";
import { accountBalance, accountSummary } from "@/lib/finance/accounts";
import { buildDailyFinanceData, buildFinanceMetricSummaries, buildSpendSeries, buildIncomeSeries, formatAxisDate } from "@/lib/finance/metrics";

export function OverviewView() {
  const { state } = useFinance();
  const { transactions, settings } = state;
  const summary = useMemo(() => accountSummary(state), [state]);
  const daily = useMemo(() => buildDailyFinanceData(transactions), [transactions]);
  const metrics = useMemo(() => buildFinanceMetricSummaries(daily, settings.currency), [daily, settings.currency]);
  const spend = useMemo(() => buildSpendSeries(transactions), [transactions]);
  const income = useMemo(() => buildIncomeSeries(transactions), [transactions]);
  const recent = useMemo(() => [...transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5), [transactions]);
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: settings.currency, maximumFractionDigits: 2 }).format(value);
  const periods = [{ label: "7D", points: 7 }, { label: "14D", points: 14 }, { label: "30D", points: 30 }, { label: "45D", points: 45 }];
  return <div className="overview-content">
    <dl className="balance-strip">
      {[{ label: "Liquid cash", value: summary.cashBalance, detail: "Checking, savings and cash" },
        { label: "Net worth", value: summary.netWorth, detail: `${state.accounts.length} accounts · assets less debts` },
        { label: "Income", value: metrics.find(metric => metric.key === "income")!.value, detail: "Last 30 days" },
        { label: "Spending", value: metrics.find(metric => metric.key === "spend")!.value, detail: "Last 30 days" }].map(item => <div key={item.label}><dt>{item.label}</dt><dd>{money(item.value)}</dd><p>{item.detail}</p></div>)}
    </dl>
    <div className="overview-charts">
      <ProgressMetricCard title="Daily spend" periods={periods} defaultPeriod="30D" data={spend} accent="rose" valueFormatter={money} dateFormatter={formatAxisDate} />
      <ProgressMetricCard title="Daily income" periods={periods} defaultPeriod="30D" data={income} accent="emerald" valueFormatter={money} dateFormatter={formatAxisDate} />
    </div>
    <div className="overview-details">
      <section className="recent-section" aria-labelledby="recent-title"><div className="section-heading"><h2 id="recent-title">Recent transactions</h2><span className="muted">Latest {recent.length}</span></div>
        <div className="table-scroll"><table className="recent-table"><thead><tr><th scope="col">Description</th><th scope="col">Date</th><th scope="col">Amount</th></tr></thead><tbody>{recent.map(transaction => <tr key={transaction.id}><td><strong>{transaction.desc}</strong><span>{transaction.category}</span></td><td>{formatAxisDate(transaction.date)}</td><td>{transaction.amount > 0 ? "+" : ""}{money(transaction.amount)}</td></tr>)}</tbody></table></div>
        {!recent.length && <p className="muted">Add or import a transaction to start your ledger.</p>}
      </section>
      <section className="overview-accounts" aria-labelledby="overview-accounts-title"><div className="section-heading"><h2 id="overview-accounts-title">Account balances</h2><span className="muted">{settings.currency}</span></div><ul>{state.accounts.map(account => <li key={account.id}><div><strong>{account.name}</strong><span>{account.type === "credit" ? "Credit card" : account.type[0].toUpperCase()+account.type.slice(1)}</span></div><span>{money(accountBalance(state,account.id))}</span></li>)}</ul></section>
    </div>
  </div>;
}
