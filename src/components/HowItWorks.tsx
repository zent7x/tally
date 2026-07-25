import { Stats } from "./ui/statistics-card";

const bars = [
  {
    value: 42,
    step: "01",
    label: "Import",
    tip: "CSV · never uploaded",
    detail: "Bank CSV or hand entry. Columns map on this device.",
    delay: 0.12,
  },
  {
    value: 58,
    step: "02",
    label: "Categorize",
    tip: "Learns your tags",
    detail: "Change a category once — matching spend follows.",
    delay: 0.26,
  },
  {
    value: 74,
    step: "03",
    label: "Insights",
    tip: "12-mo forecast",
    detail: "Balances, budgets, and silent subscriptions, live.",
    delay: 0.4,
  },
  {
    value: 100,
    step: "04",
    label: "Private",
    tip: "Zero cloud · AES-256",
    tipPinned: true,
    detail: "Data stays in the browser. Passphrase never leaves memory.",
    className: "bg-[var(--accent)]",
    delay: 0.54,
  },
];

export function HowItWorks() {
  return (
    <Stats
      className="anim-3"
      eyebrow="How Tally works"
      title="Private by design. Useful by default."
      description="Tally is a ledger that runs entirely in your browser. There is no account and no backend — every total you see is computed here and stored only here."
      bars={bars}
    />
  );
}
