import type { AppState, Transaction } from "./types";
import { accountSummary, isTransfer } from "./accounts";

export const ym = (d: string): string => d.slice(0, 7);

export function sum<T>(
  arr: T[],
  f: (item: T) => number = (x) => x as unknown as number,
): number {
  return arr.reduce((a, b) => a + f(b), 0);
}

export function months(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((t) => ym(t.date)))].sort();
}

export function txForMonth(
  transactions: Transaction[],
  key: string,
): Transaction[] {
  return transactions.filter((t) => ym(t.date) === key);
}

export function net(transactions: Transaction[]): number {
  return sum(transactions, (t) => t.amount);
}

export function currentBalance(state: AppState): number {
  if (state.accounts?.length) return accountSummary(state).cashBalance;
  return state.settings.startingBalance != null
    ? state.settings.startingBalance
    : net(state.transactions);
}

export function nMonthsData(transactions: Transaction[]): number {
  return Math.max(1, months(transactions).length);
}

export function monthSpend(
  transactions: Transaction[],
  key: string,
): number {
  return -sum(
    txForMonth(transactions, key).filter((t) => t.amount < 0 && !isTransfer(t)),
    (t) => t.amount,
  );
}

export function monthIncome(
  transactions: Transaction[],
  key: string,
): number {
  return sum(
    txForMonth(transactions, key).filter((t) => t.amount > 0 && !isTransfer(t)),
    (t) => t.amount,
  );
}
