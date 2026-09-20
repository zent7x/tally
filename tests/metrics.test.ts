import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDailyFinanceData,
  buildFinanceMetricSummaries,
  buildIncomeSeries,
  buildSpendSeries,
  buildWeeklyFinanceData,
  formatAxisMoney,
  metricPercentageChange,
  netBalance,
} from "../src/lib/finance/metrics.ts";
import { defaultState } from "../src/lib/finance/storage.ts";
import type { Transaction } from "../src/lib/finance/types.ts";

const now = new Date(2026, 8, 20, 19, 30);
const tx = (date: string, amount: number, category = "Income"): Transaction => ({
  id: `${date}-${amount}-${category}`, date, amount, category, desc: "Test transaction",
});

test("calendar windows include today, zero-fill gaps, and exclude future and old history", () => {
  const data = buildDailyFinanceData([
    tx("2026-07-22", 999), tx("2026-07-23", 10), tx("2026-08-21", 20),
    tx("2026-08-22", 30), tx("2026-09-20", -5), tx("2026-09-21", 999),
  ], now);
  assert.equal(data.length, 60);
  assert.equal(data[0].date, "2026-07-23");
  assert.equal(data.at(-1)?.date, "2026-09-20");
  assert.deepEqual(data.find((row) => row.date === "2026-09-19"), {
    date: "2026-09-19", spend: 0, income: 0, net: 0, transactions: 0,
  });
  const metrics = buildFinanceMetricSummaries(data, "EUR", now);
  assert.deepEqual(metrics.map(({ key, value, previousValue }) => ({ key, value, previousValue })), [
    { key: "spend", value: 5, previousValue: 0 },
    { key: "income", value: 30, previousValue: 30 },
    { key: "net", value: 25, previousValue: 30 },
    { key: "transactions", value: 2, previousValue: 2 },
  ]);
});

test("summaries compare sparse input by date, never by transaction-day count", () => {
  const metrics = buildFinanceMetricSummaries([
    { date: "2026-06-01", spend: 1000, income: 1000, net: 0, transactions: 10 },
    { date: "2026-08-01", spend: 50, income: 200, net: 150, transactions: 2 },
    { date: "2026-09-20", spend: 10, income: 100, net: 90, transactions: 2 },
    { date: "2026-10-01", spend: 1000, income: 1000, net: 0, transactions: 10 },
  ], "INR", now);
  assert.deepEqual(metrics.map((metric) => [metric.value, metric.previousValue]), [[10, 50], [100, 200], [90, 150], [2, 2]]);
  assert.match(metrics[0].format(metrics[0].value), /₹|INR/);
});

test("transfer entries remain counted but are excluded from income, spending, and net cash flow", () => {
  const transactions = [tx("2026-09-20", -300, "Transfers"), tx("2026-09-20", 200, " transfers "), tx("2026-09-20", -20, "Food"), tx("2026-09-20", 50)];
  assert.deepEqual(buildDailyFinanceData(transactions, now).at(-1), {
    date: "2026-09-20", spend: 20, income: 50, net: 30, transactions: 4,
  });
  assert.equal(buildSpendSeries(transactions, now).at(-1)?.value, 20);
  assert.equal(buildIncomeSeries(transactions, now).at(-1)?.value, 50);
});

test("empty and stale history produces actual zero baselines and today-anchored sparklines", () => {
  const old = [tx("2025-01-01", 999), tx("2026-09-21", 999)];
  const spend = buildSpendSeries(old, now);
  const income = buildIncomeSeries([], now);
  for (const series of [spend, income]) {
    assert.equal(series.length, 45);
    assert.equal(series.at(-1)?.date, "2026-09-20");
    assert.equal(series.every((point) => point.value === 0), true);
  }
  const metrics = buildFinanceMetricSummaries(buildDailyFinanceData([tx("2026-09-20", 100)], now), "USD", now);
  assert.equal(metrics.every((metric) => metric.previousValue === 0), true);
  assert.equal(metricPercentageChange(100, 0), null);
  assert.equal(metricPercentageChange(0, 0), null);
  assert.equal(metricPercentageChange(-50, -100), 50);
  assert.equal(metricPercentageChange(50, 100), -50);
});

test("calendar windows work across leap days and month boundaries", () => {
  const data = buildDailyFinanceData([], new Date(2024, 2, 1));
  assert.equal(data.at(-2)?.date, "2024-02-29");
  assert.equal(new Set(data.map((point) => point.date)).size, 60);
});

test("weekly buckets preserve the current 30-day totals", () => {
  const transactions = [tx("2026-08-21", 999), tx("2026-08-22", 50), tx("2026-09-20", -10), tx("2026-09-21", 999)];
  const weekly = buildWeeklyFinanceData(transactions, now);
  assert.equal(weekly.reduce((sum, point) => sum + point.income, 0), 50);
  assert.equal(weekly.reduce((sum, point) => sum + point.spend, 0), 10);
});

test("axis formatting honors selected currency for small and compact values", () => {
  for (const amount of [10, 1500, -1500, 10000]) {
    assert.match(formatAxisMoney(amount, "EUR"), /€|EUR/);
    assert.doesNotMatch(formatAxisMoney(amount, "EUR"), /\$/);
    assert.match(formatAxisMoney(amount, "INR"), /₹|INR/);
  }
});

test("overview cash uses account snapshots and excludes investments and debt", () => {
  const state = defaultState();
  state.settings.startingBalance = 99999;
  state.accounts = [
    { id: "checking", name: "Bank", type: "checking", balance: 200 },
    { id: "cash", name: "Wallet", type: "cash", balance: null },
    { id: "investment", name: "Investments", type: "investment", balance: 3000 },
    { id: "debt", name: "Credit card", type: "credit", balance: -100 },
  ];
  state.transactions = [{ ...tx("2026-09-20", 30), accountId: "cash" }];
  assert.equal(netBalance(state), 230);
});
