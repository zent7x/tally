import { useMemo, useState } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function shortDate(date: string) {
  const dt = new Date(`${date}T00:00`);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function TransactionsView() {
  const { state } = useFinance();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const currency = state.settings.currency;

  const categories = useMemo(
    () => [...new Set(state.transactions.map((t) => t.category))].sort(),
    [state.transactions],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.transactions
      .filter((t) => {
        if (q && !t.desc.toLowerCase().includes(q)) return false;
        if (category && t.category !== category) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)));
  }, [state.transactions, query, category]);

  if (!state.transactions.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description…"
          aria-label="Search transactions"
          className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        {rows.length} of {state.transactions.length} transactions
      </p>

      <div className="glass-panel overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--wash)" }}>
              {["Date", "Description", "Category", "Amount"].map((h) => (
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
            {rows.length ? (
              rows.map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{shortDate(t.date)}</td>
                  <td className="px-4 py-3">{t.desc}</td>
                  <td className="px-4 py-3">{t.category}</td>
                  <td
                    className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap"
                    style={{ color: t.amount < 0 ? "#b23423" : "#0b6e3e" }}
                  >
                    {formatMoney(t.amount, currency)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No transactions match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
