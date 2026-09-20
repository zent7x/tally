export type Theme = "light" | "dark";

export interface Transaction {
  id: string;
  date: string;
  desc: string;
  amount: number;
  category: string;
  accountId?: string;
}

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "investment" | "credit" | "loan";
  balance: number | null;
}

export interface ImportMapping {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  dateFormat: "auto" | "mdy" | "dmy" | "ymd";
  invertAmounts: boolean;
}

export interface ImportPreset {
  id: string;
  name: string;
  headers: string[];
  mapping: ImportMapping;
}

export interface IncomePlan {
  mode: "average" | "conservative" | "manual";
  windowMonths: 3 | 6 | 12;
  monthlyTarget: number;
  reserveBalance: number;
}

export type Rule = [string, string];
export type CategoryRule = Rule;
export type CategoryName = string;

export interface FinanceSettings {
  currency: string;
  startingBalance: number | null;
  theme: Theme;
  incomePlan: IncomePlan;
}

export interface FinanceState {
  transactions: Transaction[];
  rules: Rule[];
  budgets: Record<string, number>;
  settings: FinanceSettings;
  accounts: Account[];
  importPresets: ImportPreset[];
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
  accountId?: string;
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
  | "forecast"
  | "accounts"
  | "income"
  | "data";

export type DeepLinkAction = "demo" | "import" | "add";

export const STORAGE_KEY = "tally.v1";

export function uid(): string {
  return crypto.randomUUID();
}
