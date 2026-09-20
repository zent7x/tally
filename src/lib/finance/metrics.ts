import type { FinanceDataPoint, FinanceMetricSummary } from "@/components/FinanceMetricsChart";
import type { SeriesPoint } from "@/components/ui/progress-metric-card";
import { isTransfer } from "./accounts";
import { currentBalance } from "./balances";
import type { FinanceState, Transaction } from "./types";

const PERIOD_DAYS = 30;
const SERIES_WINDOW_DAYS = 45;

function ym(date: string): string {
  return date.slice(0, 7);
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calendar dates avoid DST errors caused by subtracting 24-hour durations. */
function calendarDates(days: number, now: Date): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - index));
    return toLocalIso(date);
  });
}

/** The last 60 calendar days, including today, with missing days recorded as zero. */
export function buildDailyFinanceData(transactions: Transaction[], now = new Date()): FinanceDataPoint[] {
  const points = new Map(calendarDates(PERIOD_DAYS * 2, now).map((date) => [date, {
    date, spend: 0, income: 0, net: 0, transactions: 0,
  }]));
  for (const tx of transactions) {
    const point = points.get(tx.date);
    if (!point) continue;
    point.transactions += 1;
    if (isTransfer(tx)) continue;
    point.spend += Math.max(0, -tx.amount);
    point.income += Math.max(0, tx.amount);
    point.net += tx.amount;
  }
  return [...points.values()];
}

/** Weekly buckets for the current 30-day window; boundary weeks may be partial. */
export function buildWeeklyFinanceData(transactions: Transaction[], now = new Date()): FinanceDataPoint[] {
  const weeks = new Map<string, FinanceDataPoint>();
  for (const point of buildDailyFinanceData(transactions, now).slice(-PERIOD_DAYS)) {
    const date = parseLocalDate(point.date);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    const key = toLocalIso(date);
    const previous = weeks.get(key);
    weeks.set(key, {
      date: key,
      spend: (previous?.spend ?? 0) + point.spend,
      income: (previous?.income ?? 0) + point.income,
      net: (previous?.net ?? 0) + point.net,
      transactions: (previous?.transactions ?? 0) + point.transactions,
    });
  }
  return [...weeks.values()];
}

export function formatAxisDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatAxisMoney(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

/** A zero baseline has no defined percentage change. */
export function metricPercentageChange(value: number, previousValue: number): number | null {
  return previousValue === 0 ? null : (value - previousValue) / Math.abs(previousValue) * 100;
}

export function buildFinanceMetricSummaries(
  data: FinanceDataPoint[],
  currency = "USD",
  now = new Date(),
): FinanceMetricSummary[] {
  const dates = calendarDates(PERIOD_DAYS * 2, now);
  const previousDates = new Set(dates.slice(0, PERIOD_DAYS));
  const currentDates = new Set(dates.slice(PERIOD_DAYS));
  const total = (key: "spend" | "income" | "net" | "transactions", period: Set<string>) =>
    data.reduce((sum, point) => sum + (period.has(point.date) ? point[key] : 0), 0);
  const fmtMoney = (value: number) => new Intl.NumberFormat(undefined, {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(value);

  const definitions: Array<Omit<FinanceMetricSummary, "value" | "previousValue">> = [
    { key: "spend", label: "Spend", isNegative: true, format: fmtMoney },
    { key: "income", label: "Income", format: fmtMoney },
    { key: "net", label: "Net cash flow", format: (value: number) => `${value > 0 ? "+" : ""}${fmtMoney(value)}` },
    { key: "transactions", label: "Transactions", format: (value: number) => value.toLocaleString() },
  ];
  return definitions.map((metric) => ({
    ...metric,
    value: total(metric.key, currentDates),
    previousValue: total(metric.key, previousDates),
  }));
}

export function buildSpendSeries(transactions: Transaction[], now = new Date()): SeriesPoint[] {
  return buildDailyFinanceData(transactions, now).slice(-SERIES_WINDOW_DAYS)
    .map(({ date, spend }) => ({ date, value: spend }));
}

export function buildIncomeSeries(transactions: Transaction[], now = new Date()): SeriesPoint[] {
  return buildDailyFinanceData(transactions, now).slice(-SERIES_WINDOW_DAYS)
    .map(({ date, income }) => ({ date, value: income }));
}

/** Liquid cash across checking, savings, and cash accounts. */
export function netBalance(state: FinanceState): number {
  return currentBalance(state);
}

export function monthCount(transactions: Transaction[]): number {
  return Math.max(1, new Set(transactions.map((t) => ym(t.date))).size);
}
