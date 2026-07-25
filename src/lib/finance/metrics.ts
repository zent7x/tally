import type { FinanceDataPoint, FinanceMetricSummary } from "@/components/FinanceMetricsChart";
import type { SeriesPoint } from "@/components/ui/progress-metric-card";
import type { FinanceState, Transaction } from "./types";

function ym(date: string): string {
  return date.slice(0, 7);
}

function groupByDate(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = map.get(tx.date) ?? [];
    list.push(tx);
    map.set(tx.date, list);
  }
  return map;
}

export function buildDailyFinanceData(transactions: Transaction[]): FinanceDataPoint[] {
  const byDate = groupByDate(transactions);
  const dates = [...byDate.keys()].sort();
  return dates.map((date) => {
    const txs = byDate.get(date)!;
    const spend = txs.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);
    const income = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const net = txs.reduce((a, t) => a + t.amount, 0);
    return { date, spend, income, net, transactions: txs.length };
  });
}

/** Bucket daily points into weeks so the overview chart stays readable. */
export function buildWeeklyFinanceData(transactions: Transaction[]): FinanceDataPoint[] {
  const daily = buildDailyFinanceData(transactions);
  if (daily.length <= 14) return daily;

  const weeks = new Map<string, FinanceDataPoint>();
  for (const point of daily) {
    const d = parseLocalDate(point.date);
    // Monday-start week key
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    const key = toLocalIso(d);
    const prev = weeks.get(key);
    if (!prev) {
      weeks.set(key, { ...point, date: key });
    } else {
      weeks.set(key, {
        date: key,
        spend: prev.spend + point.spend,
        income: prev.income + point.income,
        net: prev.net + point.net,
        transactions: prev.transactions + point.transactions,
      });
    }
  }
  return [...weeks.values()].sort((a, b) => a.date.localeCompare(b.date));
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

export function formatAxisDate(iso: string): string {
  const date = parseLocalDate(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatAxisMoney(value: number, currency = "USD"): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) {
    const k = abs / 1000;
    const body = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${sign}$${body}k`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${sign}$${Math.round(abs)}`;
  }
}

function sumPeriod(data: FinanceDataPoint[], key: keyof Pick<FinanceDataPoint, "spend" | "income" | "net" | "transactions">, days: number) {
  const slice = data.slice(-days);
  return slice.reduce((a, d) => a + d[key], 0);
}

export function buildFinanceMetricSummaries(data: FinanceDataPoint[]): FinanceMetricSummary[] {
  const period = Math.min(30, data.length || 1);

  const currentSpend = sumPeriod(data, "spend", period);
  const prevSpend = data.slice(-period * 2, -period).reduce((a, d) => a + d.spend, 0) || currentSpend * 0.9;

  const currentIncome = sumPeriod(data, "income", period);
  const prevIncome = data.slice(-period * 2, -period).reduce((a, d) => a + d.income, 0) || currentIncome * 0.9;

  const currentNet = sumPeriod(data, "net", period);
  const prevNet = data.slice(-period * 2, -period).reduce((a, d) => a + d.net, 0) || currentNet;

  const currentTx = sumPeriod(data, "transactions", period);
  const prevTx = data.slice(-period * 2, -period).reduce((a, d) => a + d.transactions, 0) || currentTx;

  const fmtMoney = (val: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

  return [
    { key: "spend", label: "Spend", value: currentSpend, previousValue: prevSpend || 1, format: fmtMoney },
    { key: "income", label: "Income", value: currentIncome, previousValue: prevIncome || 1, format: fmtMoney },
    {
      key: "net",
      label: "Net",
      value: currentNet,
      previousValue: prevNet || 1,
      format: (val) => `${val >= 0 ? "+" : ""}${fmtMoney(val)}`,
      isNegative: true,
    },
    {
      key: "transactions",
      label: "Transactions",
      value: currentTx,
      previousValue: prevTx || 1,
      format: (val) => val.toLocaleString(),
    },
  ];
}

const SERIES_WINDOW_DAYS = 45;

function resampleDailySeries(points: SeriesPoint[], days = SERIES_WINDOW_DAYS): SeriesPoint[] {
  if (points.length === 0) {
    return points;
  }

  const byDate = new Map(points.map((point) => [point.date, point.value]));
  const end = parseLocalDate(points[points.length - 1]!.date);
  const series: SeriesPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - offset);
    const date = toLocalIso(day);
    series.push({ date, value: byDate.get(date) ?? 0 });
  }

  return series;
}

export function buildSpendSeries(transactions: Transaction[]): SeriesPoint[] {
  const byDate = groupByDate(transactions);
  const sparse = [...byDate.keys()]
    .sort()
    .map((date) => ({
      date,
      value: (byDate.get(date) ?? []).filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0),
    }));

  return resampleDailySeries(sparse);
}

export function buildIncomeSeries(transactions: Transaction[]): SeriesPoint[] {
  const byDate = groupByDate(transactions);
  const sparse = [...byDate.keys()]
    .sort()
    .map((date) => ({
      date,
      value: (byDate.get(date) ?? []).filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0),
    }));

  return resampleDailySeries(sparse);
}

export function netBalance(state: FinanceState): number {
  const net = state.transactions.reduce((a, t) => a + t.amount, 0);
  return state.settings.startingBalance != null ? state.settings.startingBalance : net;
}

export function monthCount(transactions: Transaction[]): number {
  return Math.max(1, new Set(transactions.map((t) => ym(t.date))).size);
}
