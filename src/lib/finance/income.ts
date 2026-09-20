import { currentBalance } from "./balances";
import type { FinanceState, IncomePlan, Transaction } from "./types";

export interface IncomeMonth {
  /** Local calendar month, YYYY-MM. Only completed months are included. */
  month: string;
  income: number;
  spending: number;
  discretionarySpending: number;
}

export interface IncomePlanSummary {
  history: IncomeMonth[];
  monthsObserved: number;
  hasHistory: boolean;
  averageMonthlyIncome: number;
  /** The linearly interpolated 25th percentile of observed monthly income. */
  conservativeMonthlyIncome: number;
  selectedMonthlyIncome: number;
  monthlyTarget: number;
  averageMonthlySpending: number;
  averageDiscretionarySpending: number;
  /** Population standard deviation / mean. Multiply by 100 for a percentage. */
  incomeVariability: number;
  reserveRecommendation: number;
  reserveBalance: number;
  reserveGap: number;
  /** null means that there is no positive monthly target to cover. */
  reserveMonthsCover: number | null;
  explanation: string;
}

export interface ForecastOptions {
  /** Reduction applied only to Dining, Shopping and Entertainment; 0–100. */
  discretionaryReductionPercent?: number;
  /** A monthly currency amount added to the selected income estimate. */
  incomeAdjustment?: number;
}

export interface ForecastPoint {
  month: string;
  income: number;
  spending: number;
  net: number;
  balance: number;
}

export interface ForecastSummary {
  points: ForecastPoint[];
  startingBalance: number;
  monthlyIncome: number;
  monthlySpending: number;
  monthlyNet: number;
  /** If cash is already negative, this is the current calendar month. */
  firstNegativeMonth: string | null;
  incomePlan: IncomePlanSummary;
  explanation: string;
}

const DISCRETIONARY_CATEGORIES = new Set(["dining", "shopping", "entertainment"]);

/** Parse entered money without admitting infinities or losing whole cents. */
export function parseIncomeAmount(draft: string, allowNegative = false): number | null {
  const trimmed = draft.trim();
  if (trimmed === "") return 0;
  const format = allowNegative ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!format.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / 100 ? value : null;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function nonnegative(value: number): number {
  return Math.max(0, finite(value));
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthKey(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/** Reject invalid calendar dates instead of allowing Date to roll them forward. */
function transactionMonth(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return year * 12 + month - 1;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = (sorted.length - 1) * fraction;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

/**
 * Estimate income from a trailing window of completed calendar months. Empty
 * months after the first ledger month count as zero; months before the ledger
 * began and the incomplete current month do not. Transfers are never income or
 * spending. Anchoring the window to `now` makes old earnings age out naturally.
 */
export function buildIncomePlan(
  transactions: Transaction[],
  plan: IncomePlan,
  now = new Date(),
): IncomePlanSummary {
  const currentMonth = monthIndex(now);
  const windowMonths = [3, 6, 12].includes(plan.windowMonths) ? plan.windowMonths : 6;
  const completed = transactions.flatMap((transaction) => {
    const month = transactionMonth(transaction.date);
    return month !== null && month < currentMonth && Number.isFinite(transaction.amount)
      ? [{ transaction, month }]
      : [];
  });
  const firstLedgerMonth = completed.reduce((first, item) => Math.min(first, item.month), currentMonth);
  const startMonth = Math.max(currentMonth - windowMonths, firstLedgerMonth);
  const buckets = new Map<number, IncomeMonth>();
  for (let month = startMonth; month < currentMonth; month += 1) {
    buckets.set(month, { month: monthKey(month), income: 0, spending: 0, discretionarySpending: 0 });
  }
  for (const { transaction, month } of completed) {
    const bucket = buckets.get(month);
    const category = transaction.category.trim().toLowerCase();
    if (!bucket || category === "transfers" || category === "transfer") continue;
    if (transaction.amount > 0) bucket.income += transaction.amount;
    else if (transaction.amount < 0) {
      bucket.spending -= transaction.amount;
      if (DISCRETIONARY_CATEGORIES.has(category)) bucket.discretionarySpending -= transaction.amount;
    }
  }
  const history = [...buckets.values()].map((bucket) => ({
    ...bucket,
    income: money(bucket.income),
    spending: money(bucket.spending),
    discretionarySpending: money(bucket.discretionarySpending),
  }));
  const divisor = history.length || 1;
  const average = history.reduce((total, month) => total + month.income, 0) / divisor;
  const conservative = percentile(history.map((month) => month.income), 0.25);
  const manualTarget = nonnegative(plan.monthlyTarget);
  const selected = plan.mode === "manual" ? manualTarget : plan.mode === "conservative" ? conservative : average;
  const target = manualTarget > 0 ? manualTarget : selected;
  const variance = history.reduce((total, month) => total + (month.income - average) ** 2, 0) / divisor;
  const reserveBalance = nonnegative(plan.reserveBalance);
  let runningShortfall = 0;
  let peakShortfall = 0;
  for (const month of history) {
    // Surpluses refill the modeled reserve; prior surpluses do not mask a later
    // run of lean months because this measures the peak-to-trough drawdown.
    runningShortfall = Math.max(0, runningShortfall + target - month.income);
    peakShortfall = Math.max(peakShortfall, runningShortfall);
  }
  const reserveRecommendation = money(3 * target + peakShortfall);
  return {
    history,
    monthsObserved: history.length,
    hasHistory: history.length > 0,
    averageMonthlyIncome: money(average),
    conservativeMonthlyIncome: money(conservative),
    selectedMonthlyIncome: money(selected),
    monthlyTarget: money(target),
    averageMonthlySpending: money(history.reduce((total, month) => total + month.spending, 0) / divisor),
    averageDiscretionarySpending: money(history.reduce((total, month) => total + month.discretionarySpending, 0) / divisor),
    incomeVariability: average > 0 ? Math.sqrt(variance) / average : 0,
    reserveRecommendation,
    reserveBalance: money(reserveBalance),
    reserveGap: money(Math.max(0, reserveRecommendation - reserveBalance)),
    reserveMonthsCover: target > 0 ? reserveBalance / target : null,
    explanation: `Based on ${history.length} completed calendar month${history.length === 1 ? "" : "s"} in the last ${windowMonths} months. Missing months after the ledger began count as zero; the current month and transfers are excluded. Conservative income is the 25th percentile. The illustrative reserve is three target months plus the largest historical run of target shortfalls.`,
  };
}

/**
 * Project twelve full months from today's liquid balance using the same calendar
 * window as the income plan. The reserve is earmarked cash already in that
 * balance and is never added again. This is a constant-pattern scenario rather
 * than a prediction of future transactions or investment returns.
 */
export function buildForecast(
  state: FinanceState,
  options: ForecastOptions = {},
  now = new Date(),
): ForecastSummary {
  const incomePlan = buildIncomePlan(state.transactions, state.settings.incomePlan, now);
  const reduction = Math.min(100, nonnegative(options.discretionaryReductionPercent ?? 0)) / 100;
  const monthlyIncome = money(Math.max(0, incomePlan.selectedMonthlyIncome + finite(options.incomeAdjustment ?? 0)));
  const monthlySpending = money(Math.max(0, incomePlan.averageMonthlySpending - incomePlan.averageDiscretionarySpending * reduction));
  const monthlyNet = money(monthlyIncome - monthlySpending);
  const startingBalance = money(finite(currentBalance(state)));
  const currentMonth = monthIndex(now);
  let balance = startingBalance;
  let firstNegativeMonth: string | null = balance < 0 ? monthKey(currentMonth) : null;
  const points: ForecastPoint[] = [];
  for (let offset = 1; offset <= 12; offset += 1) {
    balance = money(balance + monthlyNet);
    const month = monthKey(currentMonth + offset);
    if (firstNegativeMonth === null && balance < 0) firstNegativeMonth = month;
    points.push({ month, income: monthlyIncome, spending: monthlySpending, net: monthlyNet, balance });
  }
  return {
    points,
    startingBalance,
    monthlyIncome,
    monthlySpending,
    monthlyNet,
    firstNegativeMonth,
    incomePlan,
    explanation: "Twelve full monthly steps from your current liquid balance using the selected income estimate and average spending. This assumes recent patterns continue; month labels begin next month. The discretionary adjustment covers Dining, Shopping and Entertainment. The reserve is already part of your cash and is not added again.",
  };
}
