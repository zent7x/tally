import type { CategoryName, CategoryRule } from "./types";

export const CATS: [CategoryName, string][] = [
  ["Income", "#16a34a"],
  ["Housing", "#7c3aed"],
  ["Groceries", "#059669"],
  ["Dining", "#ea580c"],
  ["Transport", "#2563eb"],
  ["Utilities", "#0891b2"],
  ["Subscriptions", "#db2777"],
  ["Shopping", "#d97706"],
  ["Health", "#dc2626"],
  ["Entertainment", "#c026d3"],
  ["Savings", "#0d9488"],
  ["Transfers", "#64748b"],
  ["Fees", "#a16207"],
  ["Uncategorized", "#9ca3af"],
];

export const CATS_DARK: Record<string, string> = {
  Income: "#4ade80",
  Housing: "#a78bfa",
  Groceries: "#34d399",
  Dining: "#fb923c",
  Transport: "#60a5fa",
  Utilities: "#22d3ee",
  Subscriptions: "#f472b6",
  Shopping: "#fbbf24",
  Health: "#f87171",
  Entertainment: "#e879f9",
  Savings: "#2dd4bf",
  Transfers: "#94a3b8",
  Fees: "#d4b25c",
  Uncategorized: "#9ca3af",
};

export const DEFAULT_RULES: CategoryRule[] = [
  ["salary", "Income"],
  ["payroll", "Income"],
  ["deposit", "Income"],
  ["refund", "Income"],
  ["interest", "Income"],
  ["rent", "Housing"],
  ["mortgage", "Housing"],
  ["landlord", "Housing"],
  ["whole foods", "Groceries"],
  ["trader joe", "Groceries"],
  ["safeway", "Groceries"],
  ["grocery", "Groceries"],
  ["aldi", "Groceries"],
  ["kroger", "Groceries"],
  ["market", "Groceries"],
  ["starbucks", "Dining"],
  ["mcdonald", "Dining"],
  ["restaurant", "Dining"],
  ["cafe", "Dining"],
  ["coffee", "Dining"],
  ["pizza", "Dining"],
  ["chipotle", "Dining"],
  ["doordash", "Dining"],
  ["uber eats", "Dining"],
  ["uber", "Transport"],
  ["lyft", "Transport"],
  ["shell", "Transport"],
  ["chevron", "Transport"],
  ["gas", "Transport"],
  ["transit", "Transport"],
  ["parking", "Transport"],
  ["metro", "Transport"],
  ["electric", "Utilities"],
  ["water", "Utilities"],
  ["comcast", "Utilities"],
  ["at&t", "Utilities"],
  ["verizon", "Utilities"],
  ["internet", "Utilities"],
  ["utility", "Utilities"],
  ["netflix", "Subscriptions"],
  ["spotify", "Subscriptions"],
  ["hulu", "Subscriptions"],
  ["disney", "Subscriptions"],
  ["youtube premium", "Subscriptions"],
  ["icloud", "Subscriptions"],
  ["adobe", "Subscriptions"],
  ["prime", "Subscriptions"],
  ["gym", "Subscriptions"],
  ["patreon", "Subscriptions"],
  ["amazon", "Shopping"],
  ["target", "Shopping"],
  ["walmart", "Shopping"],
  ["etsy", "Shopping"],
  ["best buy", "Shopping"],
  ["ikea", "Shopping"],
  ["pharmacy", "Health"],
  ["cvs", "Health"],
  ["walgreens", "Health"],
  ["doctor", "Health"],
  ["dental", "Health"],
  ["clinic", "Health"],
  ["cinema", "Entertainment"],
  ["movie", "Entertainment"],
  ["steam", "Entertainment"],
  ["playstation", "Entertainment"],
  ["concert", "Entertainment"],
  ["ticket", "Entertainment"],
  ["transfer", "Transfers"],
  ["venmo", "Transfers"],
  ["zelle", "Transfers"],
  ["paypal", "Transfers"],
  ["fee", "Fees"],
  ["atm", "Fees"],
  ["overdraft", "Fees"],
];

export function catColor(name: string, isDark = false): string {
  return (
    (isDark ? CATS_DARK[name] : null) ||
    (CATS.find((c) => c[0] === name) || ["", ""])[1] ||
    "#9ca3af"
  );
}

export function norm(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[0-9]/g, " ")
    .replace(/[^a-z& ]/g, " ")
    .replace(
      /\b(pos|purchase|debit|card|payment|recurring|ach|xxx|ref|id|no)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function categorize(
  desc: string,
  rules: CategoryRule[] = DEFAULT_RULES,
): string {
  const d = desc.toLowerCase();
  for (const [kw, cat] of rules) {
    if (d.includes(kw)) return cat;
  }
  return "Uncategorized";
}
