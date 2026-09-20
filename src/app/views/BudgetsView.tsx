import { useMemo } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { useTheme } from "@/app/hooks/useTheme";
import { monthSpend, ym } from "@/lib/finance/balances";
import { CATS, catColor } from "@/lib/finance/categories";

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );
}

const BUDGET_CATEGORIES = CATS.map(([name]) => name).filter(
  (name) => name !== "Income" && name !== "Transfers",
);

export function BudgetsView() {
  const { state, setState } = useFinance();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { transactions, budgets, settings } = state;

  const monthKey = useMemo(() => { const now = new Date(); return ym(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`); }, []);

  const rows = useMemo(
    () =>
      BUDGET_CATEGORIES.map((name) => {
        const spent = monthSpend(
          transactions.filter((tx) => tx.category === name),
          monthKey,
        );
        const limit = budgets[name] ?? 0;
        const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : spent > 0 ? 100 : 0;
        const over = limit > 0 && spent > limit;
        return { name, spent, limit, pct, over, color: catColor(name, isDark) };
      }),
    [transactions, budgets, monthKey, isDark],
  );

  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [monthKey]);

  const setBudget = (name: string, value: string) => {
    const parsed = value === "" ? 0 : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setState((prev) => ({
      ...prev,
      budgets: { ...prev.budgets, [name]: parsed },
    }));
  };


  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Monthly budgets
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          {monthLabel}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Set limits per category · changes save automatically
        </p>
      </div>

      <section className="panel p-5 sm:p-6">
        <ul className="space-y-5">
          {rows.map((row) => (
            <li key={row.name}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium" style={{ color: "var(--text)" }}>
                    {row.name}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums" style={{ color: row.over ? "#b23423" : "var(--muted)" }}>
                    {formatMoney(row.spent, settings.currency)} spent
                    {row.limit > 0 ? ` of ${formatMoney(row.limit, settings.currency)}` : ""}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                  <span className="sr-only">Budget limit for {row.name}</span>
                  Limit
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.limit || ""}
                    placeholder="0"
                    onChange={(e) => setBudget(row.name, e.target.value)}
                    className="w-24 rounded-lg border px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--wash)",
                      color: "var(--text)",
                    }}
                  />
                </label>
              </div>
              {row.limit > 0 ? (
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full"
                  style={{ background: "var(--wash)" }}
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${row.pct}%`,
                      background: row.over ? "#b23423" : row.color,
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
