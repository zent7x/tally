export type Theme = "light" | "dark";

export interface Transaction {
  id: string;
  date: string;
  desc: string;
  amount: number;
  category: string;
}

export type Rule = [string, string];
export type CategoryRule = Rule;
export type CategoryName = string;

export interface FinanceSettings {
  currency: string;
  startingBalance: number | null;
  theme: Theme;
}

export interface FinanceState {
  transactions: Transaction[];
  rules: Rule[];
  budgets: Record<string, number>;
  settings: FinanceSettings;
}

/** Alias used by legacy finance modules */
export type AppState = FinanceState;

export interface EncryptedEnvelope {
  v: number;
  enc: true;
  salt: string;
  iv: string;
  ct: string;
}

export interface RecurringItem {
  key: string;
  name: string;
  category: string;
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  amount: number;
  monthly: number;
  count: number;
  last: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type AppTab =
  | "overview"
  | "transactions"
  | "categories"
  | "subscriptions"
  | "budgets"
  | "forecast";

export type DeepLinkAction = "demo" | "import" | "add";

export const STORAGE_KEY = "tally.v1";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
