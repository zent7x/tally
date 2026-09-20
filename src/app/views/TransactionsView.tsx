import { useMemo, useState } from "react";
import { ArrowDownToLine, FileSearch, Pencil, Trash2 } from "lucide-react";
import { TransactionDialog } from "@/app/components/TransactionDialog";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { downloadFile, exportCSV } from "@/lib/finance/export";
import type { Transaction } from "@/lib/finance/types";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function TransactionsView() {
  const { state, setState } = useFinance();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState("");
  const currency = state.settings.currency;
  const categories = useMemo(() => [...new Set(state.transactions.map((item) => item.category))].sort(), [state.transactions]);
  const accounts = useMemo(() => new Map(state.accounts.map((item) => [item.id, item.name])), [state.accounts]);
  const unknownAccounts = useMemo(() => [...new Set(state.transactions.map((item) => item.accountId || "default"))]
    .filter((id) => !accounts.has(id)), [state.transactions, accounts]);
  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return state.transactions.filter((item) =>
      (!search || item.desc.toLowerCase().includes(search)) &&
      (!category || item.category === category) &&
      (!account || (item.accountId || "default") === account),
    ).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id));
  }, [state.transactions, query, category, account]);
  const hasFilters = Boolean(query || category || account);

  function clearFilters() { setQuery(""); setCategory(""); setAccount(""); }
  function remove(transaction: Transaction) {
    if (!window.confirm(`Delete “${transaction.desc}” (${formatMoney(transaction.amount, currency)})? This cannot be undone.`)) return;
    setState((previous) => ({ ...previous, transactions: previous.transactions.filter((item) => item.id !== transaction.id) }));
    setNotice("Transaction deleted.");
  }
  function exportRows() {
    try {
      downloadFile("tally-transactions.csv", exportCSV({ ...state, transactions: rows }), "text/csv;charset=utf-8");
      setNotice(`Exported ${rows.length} transaction${rows.length === 1 ? "" : "s"} as CSV.`);
    } catch { setNotice("The CSV could not be downloaded. Please try again."); }
  }

  if (!state.transactions.length) return <section className="panel p-8 sm:p-12 text-center">
    <FileSearch size={32} aria-hidden="true" className="mx-auto mb-4 muted" />
    <h2 className="text-xl font-semibold">Your ledger starts here</h2>
    <p className="muted mt-2">Import a bank CSV or use Add transaction above to record your first expense or income.</p>
    <p className="muted text-sm mt-2">Each transaction can have its own category and account.</p>
  </section>;

  return <div className="space-y-4">
    {notice && <div className="notice" role="status">{notice}<button type="button" className="ghost" aria-label="Dismiss transaction notification" onClick={() => setNotice("")}>×</button></div>}
    <div className="panel p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="ledger-field">Search descriptions
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a transaction…" className="ledger-input" />
        </label>
        <label className="ledger-field">Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="ledger-input" aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
            {category && !categories.includes(category) && <option value={category}>{category}</option>}
          </select>
        </label>
        <label className="ledger-field">Account
          <select value={account} onChange={(event) => setAccount(event.target.value)} className="ledger-input" aria-label="Filter by account">
            <option value="">All accounts</option>
            {state.accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            {unknownAccounts.map((id) => <option key={id} value={id}>Unassigned account</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p className="muted text-sm" role="status">{rows.length} of {state.transactions.length} transaction{state.transactions.length === 1 ? "" : "s"} · newest first</p>
        <div className="flex flex-wrap gap-2">
          {hasFilters && <button type="button" className="btn sec" onClick={clearFilters}>Clear filters</button>}
          <button type="button" className="btn sec" onClick={exportRows} disabled={!rows.length}><ArrowDownToLine size={15} />{hasFilters ? "Export filtered CSV" : "Export CSV"}</button>
        </div>
      </div>
    </div>
    {rows.length ? <div className="panel overflow-x-auto" role="region" aria-label="Transactions table, scroll horizontally for more columns" tabIndex={0}>
      <table className="w-full min-w-[780px] border-collapse text-sm">
        <caption className="sr-only">Transactions, sorted newest first. Negative amounts are expenses; positive amounts are income.</caption>
        <thead><tr style={{ background: "var(--wash)" }}>
          {["Date", "Description", "Category", "Account", "Amount", "Actions"].map((heading) => <th key={heading} scope="col"
            className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${heading === "Amount" || heading === "Actions" ? "text-right" : "text-left"}`}
            style={{ color: "var(--muted)" }}>{heading}</th>)}
        </tr></thead>
        <tbody>{rows.map((item) => <tr key={item.id} className="border-t" style={{ borderColor: "var(--border)" }}>
          <td className="px-4 py-4 tabular-nums whitespace-nowrap"><time dateTime={item.date}>{shortDate(item.date)}</time></td>
          <th scope="row" className="px-4 py-4 text-left font-medium max-w-xs break-words">{item.desc}</th>
          <td className="px-4 py-4">{item.category}</td>
          <td className="px-4 py-4">{accounts.get(item.accountId || "default") || "Unassigned account"}</td>
          <td className="px-4 py-4 text-right font-medium tabular-nums whitespace-nowrap" style={{ color: item.amount < 0 ? "var(--expense, #b23423)" : "var(--income, #0b6e3e)" }}>{formatMoney(item.amount, currency)}</td>
          <td className="px-4 py-3"><div className="flex justify-end gap-1">
            <button type="button" className="btn sec" aria-label={`Edit ${item.desc}`} onClick={() => setEditing(item)}><Pencil size={14} />Edit</button>
            <button type="button" className="btn sec danger" aria-label={`Delete ${item.desc}`} onClick={() => remove(item)}><Trash2 size={14} /><span className="sr-only">Delete</span></button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div> : <section className="panel p-8 text-center">
      <h2 className="font-semibold">No transactions match these filters</h2>
      <p className="muted mt-2">Try a different description, category, or account.</p>
      <button type="button" className="btn sec mt-4" onClick={clearFilters}>Show all transactions</button>
    </section>}
    {editing && <TransactionDialog transaction={editing} onClose={() => setEditing(null)} onSaved={() => {
      setEditing(null); setNotice("Transaction updated.");
    }} />}
  </div>;
}
