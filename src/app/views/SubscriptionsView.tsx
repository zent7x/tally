import { useMemo } from "react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { detectRecurring } from "@/lib/finance/recurring";
import type { RecurringItem } from "@/lib/finance/types";

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(
    value,
  );
}

function shortDate(date: string) {
  const dt = new Date(`${date}T00:00`);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function RecurringSection({
  title,
  items,
  currency,
  empty,
}: {
  title: string;
  items: RecurringItem[];
  currency: string;
  empty: string;
}) {
  const monthlyTotal = items.reduce((sum, item) => sum + item.monthly, 0);

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            {title}
          </h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--text)" }}>
            {formatMoney(monthlyTotal, currency)}
            <span className="ml-1 text-sm font-normal" style={{ color: "var(--muted)" }}>
              / mo est.
            </span>
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {items.length} detected
        </p>
      </div>

      {items.length ? (
        <ul className="mt-5 divide-y" style={{ borderColor: "var(--border)" }}>
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: "var(--text)" }}>
                  {item.name}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  {item.category} · {item.cadence} · {item.count} charges · last {shortDate(item.last)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums" style={{ color: "var(--text)" }}>
                  {formatMoney(item.monthly, currency)}
                  <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>
                    {" "}
                    / mo
                  </span>
                </p>
                <p className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                  {formatMoney(item.amount, currency)} per charge
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          {empty}
        </p>
      )}
    </section>
  );
}

export function SubscriptionsView() {
  const { state } = useFinance();
  const { transactions, settings } = state;

  const { subscriptions, bills, totalMonthly } = useMemo(() => {
    const recurring = detectRecurring(transactions, -1);
    const subscriptions = recurring.filter((item) => item.category === "Subscriptions");
    const bills = recurring.filter((item) => item.category !== "Subscriptions");
    const totalMonthly = recurring.reduce((sum, item) => sum + item.monthly, 0);
    return { subscriptions, bills, totalMonthly };
  }, [transactions]);

  if (!transactions.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Add transactions to detect recurring charges.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5">
        <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Recurring outflows
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--text)" }}>
          {formatMoney(totalMonthly, settings.currency)}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Estimated monthly total from detected patterns
        </p>
      </div>

      <RecurringSection
        title="Subscriptions"
        items={subscriptions}
        currency={settings.currency}
        empty="No subscription-style recurring charges detected yet."
      />

      <RecurringSection
        title="Bills & other recurring"
        items={bills}
        currency={settings.currency}
        empty="No bill-style recurring charges detected yet."
      />
    </div>
  );
}
