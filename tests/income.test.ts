import assert from "node:assert/strict";
import test from "node:test";
import { buildForecast, buildIncomePlan, parseIncomeAmount } from "../src/lib/finance/income.ts";
import type { FinanceState, IncomePlan, Transaction } from "../src/lib/finance/types.ts";

const NOW = new Date(2026, 8, 20, 12);
const PLAN: IncomePlan = { mode: "average", windowMonths: 3, monthlyTarget: 0, reserveBalance: 0 };

function tx(date: string, amount: number, category = amount >= 0 ? "Income" : "Housing"): Transaction {
  return { id: `${date}-${amount}-${category}`, date, amount, category, desc: category };
}

function state(transactions: Transaction[], overrides: Partial<IncomePlan> = {}): FinanceState {
  return {
    transactions,
    accounts: [],
    importPresets: [],
    rules: [],
    budgets: {},
    settings: {
      currency: "USD",
      startingBalance: 1000,
      theme: "light",
      incomePlan: { ...PLAN, ...overrides },
    },
  };
}

test("income smoothing counts missing complete months and excludes the current month", () => {
  const result = buildIncomePlan([
    tx("2026-06-10", 3000),
    tx("2026-08-12", 6000),
    tx("2026-09-01", 99000),
  ], PLAN, NOW);
  assert.deepEqual(result.history.map(({ month, income }) => ({ month, income })), [
    { month: "2026-06", income: 3000 },
    { month: "2026-07", income: 0 },
    { month: "2026-08", income: 6000 },
  ]);
  assert.equal(result.averageMonthlyIncome, 3000);
  assert.equal(result.conservativeMonthlyIncome, 1500);
  assert.equal(result.selectedMonthlyIncome, 3000);
  assert.ok(Math.abs(result.incomeVariability - Math.sqrt(2 / 3)) < 1e-10);
});

test("income history begins at the first available ledger month", () => {
  const result = buildIncomePlan([tx("2026-08-10", 2400)], { ...PLAN, windowMonths: 12 }, NOW);
  assert.equal(result.monthsObserved, 1);
  assert.equal(result.averageMonthlyIncome, 2400);
  assert.equal(result.history[0].month, "2026-08");
});

test("stale income ages out against the actual current date", () => {
  const result = buildIncomePlan([tx("2025-02-10", 4000)], PLAN, NOW);
  assert.equal(result.monthsObserved, 3);
  assert.equal(result.averageMonthlyIncome, 0);
  assert.equal(result.selectedMonthlyIncome, 0);
  assert.deepEqual(result.history.map((month) => month.month), ["2026-06", "2026-07", "2026-08"]);
});

test("current-only, future-only and empty ledgers do not invent income history", () => {
  for (const transactions of [[], [tx("2026-09-01", 500)], [tx("2026-10-01", 500)]]) {
    const result = buildIncomePlan(transactions, PLAN, NOW);
    assert.equal(result.monthsObserved, 0);
    assert.equal(result.hasHistory, false);
    assert.equal(result.averageMonthlyIncome, 0);
    assert.equal(result.reserveMonthsCover, null);
    assert.equal(result.incomeVariability, 0);
  }
});

test("transfer credits and debits never inflate income or spending", () => {
  const result = buildIncomePlan([
    tx("2026-08-01", 3000),
    tx("2026-08-02", 50000, "Transfers"),
    tx("2026-08-03", -50000, " transfers "),
    tx("2026-08-04", -1000),
    tx("2026-08-05", -120, "Dining"),
  ], PLAN, NOW);
  assert.equal(result.averageMonthlyIncome, 3000);
  assert.equal(result.averageMonthlySpending, 1120);
  assert.equal(result.averageDiscretionarySpending, 120);
});

test("conservative and manual modes select their stated estimate", () => {
  const transactions = [tx("2026-06-10", 1000), tx("2026-07-10", 3000), tx("2026-08-10", 5000)];
  assert.equal(buildIncomePlan(transactions, { ...PLAN, mode: "conservative" }, NOW).selectedMonthlyIncome, 2000);
  const manual = buildIncomePlan(transactions, { ...PLAN, mode: "manual", monthlyTarget: 2750 }, NOW);
  assert.equal(manual.selectedMonthlyIncome, 2750);
  assert.equal(manual.averageMonthlyIncome, 3000);
  assert.equal(buildIncomePlan([], { ...PLAN, mode: "manual", monthlyTarget: 2000 }, NOW).selectedMonthlyIncome, 2000);
});

test("reserve buffer uses target, peak shortfall and existing earmarked savings", () => {
  const result = buildIncomePlan([
    tx("2026-06-10", 1000),
    tx("2026-07-10", 1000),
    tx("2026-08-10", 7000),
  ], { ...PLAN, monthlyTarget: 2000, reserveBalance: 3000 }, NOW);
  assert.equal(result.monthlyTarget, 2000);
  assert.equal(result.reserveRecommendation, 8000);
  assert.equal(result.reserveGap, 5000);
  assert.equal(result.reserveMonthsCover, 1.5);
  assert.equal(result.selectedMonthlyIncome, 3000);
});

test("reserve shortfall tracks a lean run even after an earlier surplus", () => {
  const result = buildIncomePlan([
    tx("2026-06-10", 10000),
    tx("2026-07-10", 1000),
    tx("2026-08-10", 1000),
  ], { ...PLAN, monthlyTarget: 2000 }, NOW);
  assert.equal(result.reserveRecommendation, 8000);
});

test("calendar windows cross year boundaries and ignore invalid dates and amounts", () => {
  const result = buildIncomePlan([
    tx("2025-11-10", 900),
    tx("2025-12-10", 1200),
    tx("2026-01-10", 1500),
    tx("2025-13-01", 999999),
    tx("2025-11-31", 999999),
    tx("2025-12-15", Number.NaN),
    tx("not-a-date", 999999),
  ], PLAN, new Date(2026, 1, 1));
  assert.deepEqual(result.history.map((month) => month.month), ["2025-11", "2025-12", "2026-01"]);
  assert.equal(result.averageMonthlyIncome, 1200);
});

test("forecast uses complete-month spending, twelve steps and the first negative month", () => {
  const result = buildForecast(state([
    tx("2026-06-01", 1000), tx("2026-06-02", -1800),
    tx("2026-07-01", 1000), tx("2026-07-02", -1800),
    tx("2026-08-01", 1000), tx("2026-08-02", -1800),
    tx("2026-09-01", -99000),
  ]), {}, NOW);
  assert.equal(result.startingBalance, 1000);
  assert.equal(result.monthlyIncome, 1000);
  assert.equal(result.monthlySpending, 1800);
  assert.equal(result.monthlyNet, -800);
  assert.equal(result.points.length, 12);
  assert.equal(result.points[0].month, "2026-10");
  assert.equal(result.points[0].balance, 200);
  assert.equal(result.points[11].month, "2027-09");
  assert.equal(result.points[11].balance, -8600);
  assert.equal(result.firstNegativeMonth, "2026-11");
});

test("what-if changes only discretionary spending and applies monthly income adjustment", () => {
  const ledger = state([
    tx("2026-08-01", 1000),
    tx("2026-08-02", -800, "Housing"),
    tx("2026-08-03", -200, "Dining"),
    tx("2026-08-04", -100, "Shopping"),
    tx("2026-08-05", -100, "Entertainment"),
    tx("2026-08-06", -100, "Subscriptions"),
  ]);
  const result = buildForecast(ledger, { discretionaryReductionPercent: 50, incomeAdjustment: 200 }, NOW);
  assert.equal(result.monthlyIncome, 1200);
  assert.equal(result.monthlySpending, 1100);
  assert.equal(result.monthlyNet, 100);
  assert.equal(result.firstNegativeMonth, null);
  assert.equal(buildForecast(ledger, { discretionaryReductionPercent: 999, incomeAdjustment: -9999 }, NOW).monthlySpending, 900);
  assert.equal(buildForecast(ledger, { incomeAdjustment: -9999 }, NOW).monthlyIncome, 0);
});

test("reserve balance is never counted again as forecast principal", () => {
  const ledger = state([tx("2026-08-01", 1000)], { reserveBalance: 9000 });
  const result = buildForecast(ledger, {}, NOW);
  assert.equal(result.startingBalance, 1000);
  assert.equal(result.points[0].balance, 2000);
});

test("an already negative liquid balance is flagged in the current month", () => {
  const ledger = state([]);
  ledger.settings.startingBalance = -50;
  const result = buildForecast(ledger, {}, NOW);
  assert.equal(result.firstNegativeMonth, "2026-09");
});

test("invalid plan or scenario values cannot produce NaN forecasts", () => {
  const ledger = state([], { mode: "manual", monthlyTarget: Number.NaN, reserveBalance: -100 });
  const result = buildForecast(ledger, { incomeAdjustment: Number.POSITIVE_INFINITY, discretionaryReductionPercent: Number.NaN }, NOW);
  assert.equal(result.monthlyIncome, 0);
  assert.equal(result.monthlySpending, 0);
  assert.equal(result.incomePlan.reserveBalance, 0);
  assert.ok(result.points.every((point) => Number.isFinite(point.balance)));
});

test("monetary outputs round to cents and inputs remain unchanged", () => {
  const transactions = [tx("2026-06-01", 10), tx("2026-07-01", 10), tx("2026-08-01", 11)];
  const before = JSON.stringify(transactions);
  const result = buildForecast(state(transactions), {}, NOW);
  assert.equal(result.monthlyIncome, 10.33);
  assert.equal(result.points[11].balance, 1123.96);
  assert.equal(JSON.stringify(transactions), before);
});


test("income and what-if inputs reject amounts too large for reliable currency arithmetic", () => {
  for (const draft of ["9".repeat(308), String(Number.MAX_SAFE_INTEGER), "Infinity", "NaN", "1e5"] ) {
    assert.equal(parseIncomeAmount(draft), null);
    assert.equal(parseIncomeAmount(draft, true), null);
  }
  assert.equal(parseIncomeAmount("-250.50"), null);
  assert.equal(parseIncomeAmount(" -250.50 ", true), -250.5);
  assert.equal(parseIncomeAmount("+250.50", true), 250.5);
  assert.equal(parseIncomeAmount("2500.50"), 2500.5);
  assert.equal(parseIncomeAmount(".50"), 0.5);
  assert.equal(parseIncomeAmount(" "), 0);
  assert.equal(parseIncomeAmount("-" , true), null);
});
