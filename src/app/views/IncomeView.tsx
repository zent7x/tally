import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { buildIncomePlan, parseIncomeAmount } from "@/lib/finance/income";
import type { IncomePlan } from "@/lib/finance/types";

function monthLabel(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}


export function IncomeView() {
  const { state, setState, flush, saving, storageError } = useFinance();
  const { incomePlan, currency } = state.settings;
  const [mode, setMode] = useState(incomePlan.mode);
  const [windowMonths, setWindowMonths] = useState(incomePlan.windowMonths);
  const [targetDraft, setTargetDraft] = useState(String(incomePlan.monthlyTarget));
  const [reserveDraft, setReserveDraft] = useState(String(incomePlan.reserveBalance));
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setMode(incomePlan.mode);
    setWindowMonths(incomePlan.windowMonths);
    setTargetDraft(String(incomePlan.monthlyTarget));
    setReserveDraft(String(incomePlan.reserveBalance));
  }, [incomePlan]);
  const summary = useMemo(() => buildIncomePlan(state.transactions, incomePlan), [state.transactions, incomePlan]);
  const target = parseIncomeAmount(targetDraft);
  const reserve = parseIncomeAmount(reserveDraft);
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const maxIncome = Math.max(1, ...summary.history.map((month) => month.income));
  const dirty = mode !== incomePlan.mode || windowMonths !== incomePlan.windowMonths || target !== incomePlan.monthlyTarget || reserve !== incomePlan.reserveBalance;
  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (target === null || reserve === null || submitting) return;
    setSaved(false);
    setSubmitting(true);
    try {
      setState((previous) => ({ ...previous, settings: { ...previous.settings,
        incomePlan: { mode, windowMonths, monthlyTarget: target, reserveBalance: reserve },
      } }));
      await flush();
      setSaved(true);
    } catch {
      // The provider reports storage failures; never claim an in-memory edit was saved.
      setSaved(false);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="section-heading"><div><h2>Give variable income a steady plan.</h2><p className="muted">Use completed months to choose a monthly income estimate and a cash cushion.</p></div></div>
      {!summary.hasHistory ? <div className="notice" role="status">No completed months yet. Add or import earlier transactions to build your income history. You can still set a manual monthly plan below.</div>
        : summary.monthsObserved < 3 ? <div className="notice">Only {summary.monthsObserved} completed month{summary.monthsObserved === 1 ? "" : "s"} available. Treat these estimates as a starting point; a longer history is more useful for uneven earnings.</div> : null}
      <div className="metric-grid">
        <article className="metric-card glass-panel p-5"><p className="muted text-sm">Observed average income</p><p className="mt-2 text-2xl font-semibold tabular-nums">{summary.hasHistory ? money(summary.averageMonthlyIncome) : "—"}</p><p className="muted mt-2 text-xs">{summary.monthsObserved} completed month{summary.monthsObserved === 1 ? "" : "s"} observed</p></article>
        <article className="metric-card glass-panel p-5"><p className="muted text-sm">Planning income / month</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(summary.selectedMonthlyIncome)}</p><p className="muted mt-2 text-xs">{incomePlan.mode === "manual" ? "Your manual estimate" : incomePlan.mode === "conservative" ? "Conservative · 25th percentile" : "Average of completed months"}</p></article>
        <article className="metric-card glass-panel p-5"><p className="muted text-sm">Income variability</p><p className="mt-2 text-2xl font-semibold tabular-nums">{summary.monthsObserved > 1 && summary.averageMonthlyIncome > 0 ? `${Math.round(summary.incomeVariability * 100)}%` : "—"}</p><p className="muted mt-2 text-xs">{summary.monthsObserved > 1 && summary.averageMonthlyIncome > 0 ? "Spread relative to average income; higher means less steady." : "Needs at least two months and some income."}</p></article>
      </div>
      <section className="glass-panel p-5 sm:p-6" aria-labelledby="income-plan-title">
        <h3 id="income-plan-title" className="text-lg font-semibold">Your income plan</h3><p className="muted mt-1 text-sm">Save a planning method for your forecast. A desired draw helps estimate the reserve needed through lean months.</p>
        <form onSubmit={savePlan} className="mt-5 space-y-4" noValidate>
          <div className="field-grid">
            <label className="ledger-field">Planning method<select className="ledger-input" value={mode} onChange={(event) => { setMode(event.target.value as IncomePlan["mode"]); setSaved(false); }}><option value="average">Average income</option><option value="conservative">Conservative income</option><option value="manual">Manual income</option></select></label>
            <label className="ledger-field">History window<select className="ledger-input" value={windowMonths} onChange={(event) => { setWindowMonths(Number(event.target.value) as IncomePlan["windowMonths"]); setSaved(false); }}><option value={3}>Last 3 completed months</option><option value={6}>Last 6 completed months</option><option value={12}>Last 12 completed months</option></select></label>
            <label className="ledger-field">Desired monthly draw ({currency})<input className="ledger-input" type="text" inputMode="decimal" value={targetDraft} aria-invalid={target === null} aria-describedby="income-target-help" onChange={(event) => { setTargetDraft(event.target.value); setSaved(false); }} /><span id="income-target-help" className="muted text-xs">{target === null ? "Enter a supported amount of zero or more, such as 2500.50." : mode === "manual" ? "Also sets your forecast income in manual mode. Blank means zero." : "Enter zero or leave blank to use your income estimate as the draw."}</span></label>
            <label className="ledger-field">Reserve already earmarked ({currency})<input className="ledger-input" type="text" inputMode="decimal" value={reserveDraft} aria-invalid={reserve === null} aria-describedby="income-reserve-help" onChange={(event) => { setReserveDraft(event.target.value); setSaved(false); }} /><span id="income-reserve-help" className="muted text-xs">{reserve === null ? "Enter a supported amount of zero or more, such as 5000.50." : "Cash already in your accounts. This never adds to your balance. Blank means zero."}</span></label>
          </div>
          <div className="form-actions"><button className="btn" type="submit" disabled={target === null || reserve === null || submitting || saving}>Save income plan</button><span className="muted text-sm" role="status">{submitting || saving ? "Saving changes on this device…" : storageError ? "Income plan is not saved. Export a backup before closing this page." : dirty ? "Unsaved changes · figures reflect your saved plan." : saved ? "Income plan saved on this device." : "Your plan stays on this device."}</span></div>
        </form>
      </section>
      <section className="glass-panel p-5 sm:p-6" aria-labelledby="income-reserve-title">
        <h3 id="income-reserve-title" className="text-lg font-semibold">A cushion for quieter months</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-3"><div><p className="muted text-sm">Illustrative reserve</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(summary.reserveRecommendation)}</p></div><div><p className="muted text-sm">Already earmarked</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(summary.reserveBalance)}</p></div><div><p className="muted text-sm">Remaining to earmark</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(summary.reserveGap)}</p></div></div>
        <p className="muted mt-4 text-sm">{summary.reserveMonthsCover === null ? "Set a positive monthly draw to estimate how long your earmarked cash could cover it." : `Your earmarked cash covers ${summary.reserveMonthsCover.toFixed(1)} months of a ${money(summary.monthlyTarget)} monthly draw, assuming no new income.`}</p>
        <p className="muted mt-2 text-sm">The estimate adds three months of your desired draw to the largest historical run of shortfalls. It is a planning guide, not a guarantee or an account balance check.</p>
      </section>
      <section className="glass-panel overflow-hidden" aria-labelledby="income-history-title">
        <div className="p-5 sm:p-6"><h3 id="income-history-title" className="text-lg font-semibold">Your completed months</h3><p className="muted mt-1 text-sm">Gaps count as zero after your ledger begins. This month is still in progress and is excluded.</p>
          {summary.hasHistory ? <div className="mt-5 flex h-32 items-end gap-2" aria-hidden="true">{summary.history.map((month) => <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="w-full rounded-t-md" style={{ height: `${Math.max(2, (month.income / maxIncome) * 80)}%`, background: month.income > 0 ? "var(--accent, #0b6e3e)" : "var(--border)" }} /><span className="muted truncate text-center text-[10px]">{month.month.slice(5)}</span></div>)}</div> : <p className="muted mt-5 text-sm">Your monthly history will appear here after you add earlier transactions.</p>}
        </div>
        {summary.hasHistory ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] border-collapse text-sm"><caption className="sr-only">Monthly income and spending from completed calendar months</caption><thead style={{ background: "var(--wash)" }}><tr>{["Month", "Income", "Spending"].map((label) => <th key={label} scope="col" className="muted px-5 py-3 text-left font-medium">{label}</th>)}</tr></thead><tbody>{summary.history.map((month) => <tr key={month.month} className="border-t" style={{ borderColor: "var(--border)" }}><th scope="row" className="px-5 py-3 text-left font-normal">{monthLabel(month.month)}</th><td className="px-5 py-3 tabular-nums">{money(month.income)}</td><td className="px-5 py-3 tabular-nums">{money(month.spending)}</td></tr>)}</tbody></table></div> : null}
      </section>
      <p className="muted text-xs leading-relaxed">{summary.explanation} Estimates use recorded transactions only; missing imports can understate income and spending.</p>
    </div>
  );
}
