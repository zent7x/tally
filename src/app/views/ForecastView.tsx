import { useMemo, useState } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { ProgressMetricCard } from "@/components/ui/progress-metric-card";
import { buildForecast, parseIncomeAmount } from "@/lib/finance/income";

function monthLabel(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}


export function ForecastView() {
  const { state } = useFinance();
  const [incomeDraft, setIncomeDraft] = useState("0");
  const [incomeAdjustment, setIncomeAdjustment] = useState(0);
  const [trimPercent, setTrimPercent] = useState(0);
  const parsedAdjustment = parseIncomeAmount(incomeDraft, true);
  const projection = useMemo(() => buildForecast(state, { incomeAdjustment, discretionaryReductionPercent: trimPercent }), [state, incomeAdjustment, trimPercent]);
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: state.settings.currency, maximumFractionDigits: 2 }).format(value);
  const chartData = projection.points.map((point) => ({ date: monthLabel(point.month), value: point.balance }));
  const incomeMethod = state.settings.incomePlan.mode === "manual" ? "manual" : state.settings.incomePlan.mode === "conservative" ? "conservative" : "average";
  return (
    <div className="space-y-6">
      <div className="section-heading"><div><h2>12-month projection</h2><p className="muted">A twelve-month cash scenario using your saved income plan and recorded spending.</p></div></div>
      {!projection.incomePlan.hasHistory ? <div className="notice" role="status">No completed months yet. Spending is shown as zero until you add earlier transactions. You can explore a manual income plan, but this scenario does not include unrecorded expenses.</div> : projection.incomePlan.monthsObserved < 3 ? <div className="notice">This scenario uses only {projection.incomePlan.monthsObserved} completed month{projection.incomePlan.monthsObserved === 1 ? "" : "s"}. Add more history for a more representative view.</div> : null}
      <div className="metric-grid">
        <article className="metric-card panel p-5"><p className="muted text-sm">Starting liquid balance</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(projection.startingBalance)}</p><p className="muted mt-2 text-xs">Cash, checking and savings</p></article>
        <article className="metric-card panel p-5"><p className="muted text-sm">Scenario income / month</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(projection.monthlyIncome)}</p><p className="muted mt-2 text-xs">{incomeMethod[0].toUpperCase() + incomeMethod.slice(1)} plan, including adjustments</p></article>
        <article className="metric-card panel p-5"><p className="muted text-sm">Scenario spending / month</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(projection.monthlySpending)}</p><p className="muted mt-2 text-xs">Recorded average, including adjustments</p></article>
        <article className="metric-card panel p-5"><p className="muted text-sm">Monthly cash change</p><p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: projection.monthlyNet < 0 ? "var(--danger, #b23423)" : "var(--accent, #0b6e3e)" }}>{projection.monthlyNet > 0 ? "+" : ""}{money(projection.monthlyNet)}</p><p className="muted mt-2 text-xs">Income less spending</p></article>
      </div>
      <section className="panel p-5 sm:p-6" aria-labelledby="forecast-scenario-title">
        <div className="section-heading"><div><h3 id="forecast-scenario-title" className="text-lg font-semibold">Scenario adjustments</h3><p className="muted mt-1 text-sm">What-if changes stay in this view. Your saved plan and transactions stay the same.</p></div></div>
        <div className="field-grid mt-5">
          <label className="ledger-field">Monthly income adjustment ({state.settings.currency})
            <input className="ledger-input" type="text" inputMode="decimal" value={incomeDraft} aria-invalid={parsedAdjustment === null} aria-describedby="forecast-income-help" onChange={(event) => { const draft = event.target.value; setIncomeDraft(draft); const amount = parseIncomeAmount(draft, true); if (amount !== null) setIncomeAdjustment(amount); }} />
            <span id="forecast-income-help" className="muted text-xs">{parsedAdjustment === null ? `Enter a supported amount, such as 250.50 or -250.50. The scenario still uses ${money(incomeAdjustment)}.` : "Add or subtract from your planned monthly income. Blank means no change; income cannot fall below zero."}</span>
          </label>
          <label className="ledger-field"><span>Reduce discretionary spending <strong>{trimPercent}%</strong></span><input className="mt-3 w-full" type="range" min={0} max={100} step={5} value={trimPercent} aria-valuetext={`${trimPercent}% reduction`} aria-describedby="forecast-trim-help" onChange={(event) => setTrimPercent(Number(event.target.value))} /><span id="forecast-trim-help" className="muted text-xs">Dining, Shopping and Entertainment only. At this setting, save {money(projection.incomePlan.averageDiscretionarySpending * trimPercent / 100)} per month.</span></label>
        </div>
        <div className="form-actions mt-4"><button className="btn sec" type="button" onClick={() => { setIncomeDraft("0"); setIncomeAdjustment(0); setTrimPercent(0); }}>Reset scenario</button></div>
      </section>
      <div className="notice" role="status">{projection.firstNegativeMonth ? projection.startingBalance < 0 ? `Your starting liquid balance is already below zero (${monthLabel(projection.firstNegativeMonth)}).` : `First projected month below zero: ${monthLabel(projection.firstNegativeMonth)}.` : "Your liquid balance stays at or above zero throughout this twelve-month scenario."}</div>
      <ProgressMetricCard title="Projected liquid balance" data={chartData} accent={projection.monthlyNet >= 0 ? "emerald" : "rose"} valueFormatter={money} dateFormatter={(date) => date} periods={[{ label: "12M", points: 12 }]} defaultPeriod="12M" />
      <section className="panel overflow-x-auto" aria-label="Twelve-month forecast details">
        <table className="w-full min-w-[640px] border-collapse text-sm"><caption className="sr-only">Twelve full monthly steps from the current liquid balance</caption>
          <thead><tr style={{ background: "var(--wash)" }}>{["Month", "Income", "Spending", "Net change", "Ending balance"].map((heading) => <th key={heading} scope="col" className="muted px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">{heading}</th>)}</tr></thead>
          <tbody>{projection.points.map((point) => <tr key={point.month} className="border-t" style={{ borderColor: "var(--border)" }}><th scope="row" className="px-4 py-3 text-left font-normal">{monthLabel(point.month)}</th><td className="px-4 py-3 tabular-nums">{money(point.income)}</td><td className="px-4 py-3 tabular-nums">{money(point.spending)}</td><td className="px-4 py-3 tabular-nums">{point.net > 0 ? "+" : ""}{money(point.net)}</td><td className="px-4 py-3 font-medium tabular-nums" style={{ color: point.balance < 0 ? "var(--danger, #b23423)" : "var(--text)" }}>{money(point.balance)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="panel p-5 sm:p-6" aria-labelledby="forecast-assumptions-title"><h3 id="forecast-assumptions-title" className="font-semibold">What this scenario assumes</h3><p className="muted mt-2 text-sm leading-relaxed">{projection.explanation}</p><p className="muted mt-2 text-sm leading-relaxed">Uses {projection.incomePlan.monthsObserved} completed calendar month{projection.incomePlan.monthsObserved === 1 ? "" : "s"} within your {state.settings.incomePlan.windowMonths}-month window. Missing months after your ledger begins count as zero. Transfers and the incomplete current month are excluded from income and spending. Investments and debts are outside the starting liquid balance; no future investment returns, debt repayments or unrecorded expenses are added automatically.</p></section>
    </div>
  );
}
