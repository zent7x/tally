import { norm } from "./categories";
import type { RecurringItem, Transaction } from "./types";

export function detectRecurring(
  transactions: Transaction[],
  sign: -1 | 1,
): RecurringItem[] {
  const groups: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    if (Math.sign(t.amount) !== sign) continue;
    const k = norm(t.desc);
    if (k.length < 3) continue;
    (groups[k] ||= []).push(t);
  }
  const out: RecurringItem[] = [];
  for (const k in groups) {
    const g = groups[k].slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (g.length < 2) continue;
    const gaps: number[] = [];
    for (let i = 1; i < g.length; i++) {
      gaps.push(
        (new Date(g[i].date).getTime() - new Date(g[i - 1].date).getTime()) /
          86400000,
      );
    }
    const med = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    let cadence: RecurringItem["cadence"] | null = null;
    let perMonth = 1;
    if (med >= 6 && med <= 8) {
      cadence = "weekly";
      perMonth = 4.33;
    } else if (med >= 13 && med <= 16) {
      cadence = "biweekly";
      perMonth = 2.17;
    } else if (med >= 26 && med <= 35) {
      cadence = "monthly";
      perMonth = 1;
    } else if (med >= 85 && med <= 95) {
      cadence = "quarterly";
      perMonth = 1 / 3;
    } else if (med >= 350 && med <= 380) {
      cadence = "yearly";
      perMonth = 1 / 12;
    }
    if (!cadence) continue;
    const amts = g.map((t) => Math.abs(t.amount));
    const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
    const spread = (Math.max(...amts) - Math.min(...amts)) / (avg || 1);
    if (spread > 0.35) continue;
    out.push({
      key: k,
      name: g[g.length - 1].desc,
      category: g[g.length - 1].category,
      cadence,
      amount: avg,
      monthly: avg * perMonth,
      count: g.length,
      last: g[g.length - 1].date,
    });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}
