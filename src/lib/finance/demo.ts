import { categorize, DEFAULT_RULES } from "./categories";
import type { AppState, CategoryRule, Transaction } from "./types";
import { uid } from "./types";

export function generateDemoTransactions(
  rules: CategoryRule[] = DEFAULT_RULES,
  categorizeFn: (desc: string) => string = (desc) => categorize(desc, rules),
): Transaction[] {
  const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
  const records: Transaction[] = [];
  const todayD = new Date();
  const now = new Date();
  now.setDate(1);
  const isoLocal = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  for (let mo = 5; mo >= 0; mo--) {
    const base = new Date(now.getFullYear(), now.getMonth() - mo, 1);
    const maxDay = mo === 0 ? todayD.getDate() : 28;
    const D = (day: number): string =>
      isoLocal(
        new Date(base.getFullYear(), base.getMonth(), Math.min(28, day)),
      );
    const push = (desc: string, amount: number, day: number): void => {
      if (day <= maxDay) {
        records.push({
          id: uid(),
          accountId: "default",
          date: D(day),
          desc,
          amount,
          category: categorizeFn(desc),
        });
      }
    };
    push("Payroll - Acme Corp", 4200, 1);
    push("Rent - Oakwood Apts", -1650, 2);
    push("Netflix", -15.49, 4);
    push("Spotify Premium", -11.99, 6);
    push("PlanetFitness Gym", -24.99, 8);
    push("Comcast Internet", -79.99, 9);
    push("State Electric Utility", -Math.round(rnd(70, 130)), 11);
    push("iCloud+ Storage", -2.99, 12);
    [3, 10, 17, 24].forEach((d) =>
      push(
        ["Whole Foods Market", "Trader Joe's", "Safeway"][
          Math.floor(Math.random() * 3)
        ],
        -Math.round(rnd(45, 120)),
        d,
      ),
    );
    for (let i = 0; i < 8; i++) {
      push(
        ["Starbucks", "Chipotle", "Local Cafe", "DoorDash", "Pizza Place"][
          Math.floor(Math.random() * 5)
        ],
        -Math.round(rnd(6, 38)),
        Math.floor(rnd(2, 28)),
      );
    }
    for (let i = 0; i < 4; i++) {
      push(
        ["Uber", "Shell Gas", "City Transit"][Math.floor(Math.random() * 3)],
        -Math.round(rnd(8, 55)),
        Math.floor(rnd(2, 28)),
      );
    }
    for (let i = 0; i < 3; i++) {
      push(
        ["Amazon", "Target", "Best Buy"][Math.floor(Math.random() * 3)],
        -Math.round(rnd(15, 140)),
        Math.floor(rnd(2, 28)),
      );
    }
    if (Math.random() < 0.5) {
      push("CVS Pharmacy", -Math.round(rnd(10, 60)), Math.floor(rnd(2, 28)));
    }
    if (mo === 2) push("Freelance project", 850, 15);
    if (mo === 4) push("Freelance design", 1600, 16);
    if (mo === 1) push("Freelance project", 620, 15);
  }
  return records;
}

export function applyDemo(state: AppState): AppState {
  const records = generateDemoTransactions(state.rules, (desc) =>
    categorize(desc, state.rules),
  );
  const netSum = records.reduce((a, t) => a + t.amount, 0);
  return {
    ...state,
    transactions: records,
    accounts: [
      { id: "default", name: "Everyday checking", type: "checking", balance: Math.round((3200 + netSum) * 100) / 100 },
      { id: "demo-savings", name: "Rainy day fund", type: "savings", balance: 6400 },
      { id: "demo-investment", name: "Long-term investments", type: "investment", balance: 12800 },
      { id: "demo-credit", name: "Credit card", type: "credit", balance: -1240 },
    ],
    settings: {
      ...state.settings,
      startingBalance: null,
      incomePlan: { mode: "average", windowMonths: 6, monthlyTarget: 3500, reserveBalance: 6400 },
    },
  };
}
