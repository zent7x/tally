import { useMemo } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { useTheme } from "@/app/hooks/useTheme";
import { CATS, catColor } from "@/lib/finance/categories";

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );
}

const SKIP_CATEGORIES = new Set(["Income", "Transfers"]);

export function CategoriesView() {
  const { state } = useFinance();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { transactions, settings } = state;

  const rows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.amount >= 0 || SKIP_CATEGORIES.has(tx.category)) continue;
      totals.set(tx.category, (totals.get(tx.category) ?? 0) + Math.abs(tx.amount));
    }

    const known = new Set(CATS.map(([name]) => name));
    const ordered = CATS.map(([name]) => name).filter((name) => totals.has(name));
    const extra = [...totals.keys()].filter((name) => !known.has(name)).sort();
    const names = [...ordered, ...extra];

    const max = Math.max(1, ...names.map((name) => totals.get(name) ?? 0));
    return names.map((name) => ({
      name,
      amount: totals.get(name) ?? 0,
      pct: ((totals.get(name) ?? 0) / max) * 100,
      color: catColor(name, isDark),
    }));
  }, [transactions, isDark]);

  const totalSpend = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows],
  );

  if (!transactions.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Add transactions to see category spending.
      </p>
    );
  }

  if (!rows.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No spending transactions to categorize yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5">
        <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          All-time spend
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--text)" }}>
          {formatMoney(totalSpend, settings.currency)}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          {rows.length} categories · excludes income & transfers
        </p>
      </div>

      <section className="glass-panel p-5 sm:p-6">
        <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Spend by category
        </h2>
        <ul className="mt-5 space-y-4">
          {rows.map((row) => (
            <li key={row.name}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium" style={{ color: "var(--text)" }}>
                  {row.name}
                </span>
                <span className="tabular-nums" style={{ color: "var(--muted)" }}>
                  {formatMoney(row.amount, settings.currency)}
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full"
                style={{ background: "var(--wash)" }}
                role="presentation"
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${row.pct}%`, background: row.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
