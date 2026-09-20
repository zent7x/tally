import { defaultAccount, DEFAULT_ACCOUNT_ID } from "./accounts";
import { DEFAULT_RULES } from "./categories";
import { encryptWith } from "./crypto";
import type {
  Account,
  EncryptedEnvelope,
  FinanceState,
  ImportMapping,
  ImportPreset,
  IncomePlan,
  Rule,
  StorageLike,
  Transaction,
} from "./types";

export const KEY = "tally.v1";

export function defaultState(): FinanceState {
  return {
    transactions: [],
    rules: DEFAULT_RULES.map(([pattern, category]) => [pattern, category]),
    budgets: {},
    accounts: [defaultAccount()],
    importPresets: [],
    settings: {
      currency: "USD",
      startingBalance: null,
      theme: "light",
      incomePlan: { mode: "average", windowMonths: 6, monthlyTarget: 0, reserveBalance: 0 },
    },
  };
}

function invalid(path: string, expected: string): never {
  throw new Error(`Invalid backup: ${path} must be ${expected}.`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid(path, "an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path, "a plain object");
  const result = value as Record<string, unknown>;
  for (const key of ["__proto__", "prototype", "constructor"]) {
    if (Object.hasOwn(result, key)) invalid(`${path}.${key}`, "a safe property name");
  }
  return result;
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    return invalid(path, allowEmpty ? "text" : "nonempty text");
  }
  return value;
}

function finite(value: unknown, path: string, nonnegative = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || (nonnegative && value < 0)) {
    return invalid(path, nonnegative ? "a finite, nonnegative number" : "a finite number");
  }
  return value;
}

function nullableBalance(value: unknown, path: string): number | null {
  return value === null ? null : finite(value, path);
}

function array(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : invalid(path, "an array");
}

function uniqueIds(items: { id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) invalid(`${path}.id`, "unique");
    seen.add(item.id);
  }
}

function transaction(value: unknown, index: number): Transaction {
  const path = `transactions[${index}]`;
  const item = record(value, path);
  const date = string(item.date, `${path}.date`);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    invalid(`${path}.date`, "a valid YYYY-MM-DD date");
  }
  return {
    id: string(item.id, `${path}.id`),
    date,
    desc: string(item.desc, `${path}.desc`, true),
    amount: finite(item.amount, `${path}.amount`),
    category: string(item.category, `${path}.category`, true),
    accountId: item.accountId === undefined ? DEFAULT_ACCOUNT_ID : string(item.accountId, `${path}.accountId`),
  };
}

function account(value: unknown, index: number): Account {
  const path = `accounts[${index}]`;
  const item = record(value, path);
  const type = item.type;
  if (type !== "checking" && type !== "savings" && type !== "cash" && type !== "investment" && type !== "credit" && type !== "loan") {
    invalid(`${path}.type`, "a supported account type");
  }
  return {
    id: string(item.id, `${path}.id`),
    name: string(item.name, `${path}.name`),
    type,
    balance: nullableBalance(item.balance, `${path}.balance`),
  };
}

function preset(value: unknown, index: number): ImportPreset {
  const path = `importPresets[${index}]`;
  const item = record(value, path);
  const headers = array(item.headers, `${path}.headers`).map((header, i) => string(header, `${path}.headers[${i}]`, true));
  const rawMapping = record(item.mapping, `${path}.mapping`);
  const column = (key: string): number => {
    const value = finite(rawMapping[key], `${path}.mapping.${key}`);
    if (!Number.isInteger(value) || value < -1 || value >= headers.length) {
      invalid(`${path}.mapping.${key}`, "a valid column index or -1");
    }
    return value;
  };
  const dateFormat = rawMapping.dateFormat;
  if (dateFormat !== "auto" && dateFormat !== "mdy" && dateFormat !== "dmy" && dateFormat !== "ymd") {
    invalid(`${path}.mapping.dateFormat`, "a supported date format");
  }
  if (typeof rawMapping.invertAmounts !== "boolean") invalid(`${path}.mapping.invertAmounts`, "a boolean");
  const mapping: ImportMapping = {
    date: column("date"), description: column("description"), amount: column("amount"),
    debit: column("debit"), credit: column("credit"), dateFormat, invertAmounts: rawMapping.invertAmounts,
  };
  if (mapping.date < 0 || mapping.description < 0 || (mapping.amount < 0 && mapping.debit < 0 && mapping.credit < 0)) {
    invalid(`${path}.mapping`, "a mapping with date, description, and amount columns");
  }
  return { id: string(item.id, `${path}.id`), name: string(item.name, `${path}.name`), headers, mapping };
}

function incomePlan(value: unknown, defaults: IncomePlan): IncomePlan {
  const raw = value === undefined ? {} : record(value, "settings.incomePlan");
  const mode = raw.mode ?? defaults.mode;
  const windowMonths = raw.windowMonths ?? defaults.windowMonths;
  if (mode !== "average" && mode !== "conservative" && mode !== "manual") invalid("settings.incomePlan.mode", "a supported planning mode");
  if (windowMonths !== 3 && windowMonths !== 6 && windowMonths !== 12) invalid("settings.incomePlan.windowMonths", "3, 6, or 12");
  return {
    mode, windowMonths,
    monthlyTarget: raw.monthlyTarget === undefined ? defaults.monthlyTarget : finite(raw.monthlyTarget, "settings.incomePlan.monthlyTarget", true),
    reserveBalance: raw.reserveBalance === undefined ? defaults.reserveBalance : finite(raw.reserveBalance, "settings.incomePlan.reserveBalance", true),
  };
}

/** Validate imported data before it can replace the active store, then fill legacy fields. */
export function migrate(value: unknown): FinanceState {
  const source = record(value, "state");
  const defaults = defaultState();
  const settings = source.settings === undefined ? {} : record(source.settings, "settings");
  const startingBalance = settings.startingBalance === undefined ? null : nullableBalance(settings.startingBalance, "settings.startingBalance");
  const currency = settings.currency === undefined ? defaults.settings.currency : string(settings.currency, "settings.currency");
  if (!/^[a-z]{3}$/i.test(currency)) invalid("settings.currency", "a three-letter currency code");
  let theme = settings.theme;
  if (theme === undefined) {
    try {
      const legacy = typeof localStorage !== "undefined" ? localStorage.getItem(KEY + ".theme") : null;
      theme = legacy === "dark" ? "dark" : "light";
    } catch {
      theme = "light";
    }
  }
  if (theme !== "light" && theme !== "dark") invalid("settings.theme", "light or dark");
  const transactions = source.transactions === undefined ? [] : array(source.transactions, "transactions").map(transaction);
  uniqueIds(transactions, "transactions");
  const accounts = source.accounts === undefined ? [defaultAccount(startingBalance)] : array(source.accounts, "accounts").map(account);
  uniqueIds(accounts, "accounts");
  if (accounts.length === 0 || (transactions.some((tx) => tx.accountId === DEFAULT_ACCOUNT_ID) && !accounts.some((item) => item.id === DEFAULT_ACCOUNT_ID))) {
    accounts.push(defaultAccount(source.accounts === undefined ? startingBalance : null));
  }
  const accountIds = new Set(accounts.map((item) => item.id));
  for (const tx of transactions) {
    if (!accountIds.has(tx.accountId!)) invalid(`transaction ${tx.id}.accountId`, "an existing account");
  }
  const rules: Rule[] = source.rules === undefined ? defaults.rules : array(source.rules, "rules").map((value, i) => {
    const rule = array(value, `rules[${i}]`);
    if (rule.length !== 2) invalid(`rules[${i}]`, "a pair of text values");
    return [string(rule[0], `rules[${i}][0]`, true), string(rule[1], `rules[${i}][1]`, true)];
  });
  const rawBudgets = source.budgets === undefined ? {} : record(source.budgets, "budgets");
  const budgets = Object.fromEntries(Object.entries(rawBudgets).map(([key, amount]) => [key, finite(amount, `budgets.${key}`, true)]));
  const importPresets = source.importPresets === undefined ? [] : array(source.importPresets, "importPresets").map(preset);
  uniqueIds(importPresets, "importPresets");
  return {
    transactions, accounts, rules, budgets, importPresets,
    settings: { currency: currency.toUpperCase(), startingBalance, theme, incomePlan: incomePlan(settings.incomePlan, defaults.settings.incomePlan) },
  };
}

export interface LoadResult {
  state: FinanceState;
  locked: EncryptedEnvelope | null;
  /** Prevent replacement when the only copy of an unreadable ledger is still active. */
  recoveryError?: string;
}

function encryptedEnvelope(value: Record<string, unknown>): EncryptedEnvelope {
  if (value.v !== 1 || value.enc !== true) invalid("encrypted backup", "a supported encrypted format");
  const salt = string(value.salt, "encrypted backup.salt");
  const iv = string(value.iv, "encrypted backup.iv");
  const ct = string(value.ct, "encrypted backup.ct");
  try {
    if (atob(salt).length !== 16 || atob(iv).length !== 12 || atob(ct).length < 16) {
      invalid("encrypted backup", "a complete encryption envelope");
    }
  } catch {
    invalid("encrypted backup", "a complete encryption envelope");
  }
  return { v: 1, enc: true, salt, iv, ct };
}

export function loadState(storage: StorageLike): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage.getItem(KEY);
    if (raw) {
      const parsed = record(JSON.parse(raw), "state");
      if (parsed.enc === true) return { state: defaultState(), locked: encryptedEnvelope(parsed) };
      return { state: migrate(parsed), locked: null };
    }
  } catch {
    if (raw) {
      try {
        storage.setItem(KEY + ".corrupt-" + Date.now(), raw);
      } catch {
        return {
          state: defaultState(), locked: null,
          recoveryError: "Tally could not create a recovery copy of the unreadable saved ledger. Saving has stopped to preserve the original data. Free browser storage and reload.",
        };
      }
      try {
        storage.removeItem(KEY);
      } catch {
        /* A recovery copy exists, so later replacement remains safe. */
      }
    }
  }
  return { state: defaultState(), locked: null };
}

export interface SaveOptions {
  cryptoKey?: CryptoKey | null;
  cryptoSalt?: BufferSource | null;
  locked?: boolean;
}

export async function saveState(
  storage: StorageLike,
  state: FinanceState,
  options: SaveOptions = {},
): Promise<void> {
  if (options.locked) return;
  if (options.cryptoKey && !options.cryptoSalt) throw new Error("Cannot save encrypted data without its salt.");
  const raw = options.cryptoKey
    ? await encryptWith(options.cryptoKey, options.cryptoSalt!, state)
    : JSON.stringify(state);
  storage.setItem(KEY, raw);
}

export function createSaveQueue(): {
  enqueue(task: () => Promise<void>): Promise<void>;
} {
  let queue = Promise.resolve();
  return {
    enqueue(task: () => Promise<void>): Promise<void> {
      const result = queue.then(task);
      // The caller sees the failure, while later saves are still allowed to run.
      queue = result.catch(() => {});
      return result;
    },
  };
}
