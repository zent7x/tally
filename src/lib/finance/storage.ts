import { DEFAULT_RULES } from "./categories";
import { encryptWith } from "./crypto";
import type {
  EncryptedEnvelope,
  FinanceState,
  StorageLike,
} from "./types";

export const KEY = "tally.v1";

export function defaultState(): FinanceState {
  return {
    transactions: [],
    rules: DEFAULT_RULES.slice(),
    budgets: {},
    settings: { currency: "USD", startingBalance: null, theme: "light" },
  };
}

export function migrate(s: Partial<FinanceState> | FinanceState): FinanceState {
  const state: FinanceState = {
    ...defaultState(),
    ...s,
    transactions: s.transactions ?? [],
    rules: s.rules ?? DEFAULT_RULES.slice(),
    budgets: s.budgets ?? {},
    settings: {
      ...defaultState().settings,
      ...s.settings,
    },
  };
  state.settings.currency ||= "USD";
  if (state.settings.startingBalance === undefined) {
    state.settings.startingBalance = null;
  }
  if (state.settings.theme !== "dark" && state.settings.theme !== "light") {
    try {
      const legacy =
        typeof localStorage !== "undefined" ? localStorage.getItem(KEY + ".theme") : null;
      state.settings.theme = legacy === "dark" || legacy === "light" ? legacy : "light";
    } catch {
      state.settings.theme = "light";
    }
  }
  return state;
}

export interface LoadResult {
  state: FinanceState;
  locked: EncryptedEnvelope | null;
}

export function loadState(storage: StorageLike): LoadResult {
  try {
    const raw = storage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FinanceState | EncryptedEnvelope;
      if (parsed && "enc" in parsed && parsed.enc) {
        return { state: defaultState(), locked: parsed as EncryptedEnvelope };
      }
      return { state: migrate(parsed as FinanceState), locked: null };
    }
  } catch {
    try {
      const raw = storage.getItem(KEY);
      if (raw) {
        storage.setItem(KEY + ".corrupt-" + Date.now(), raw);
        storage.removeItem(KEY);
      }
    } catch {
      /* ignore secondary storage errors */
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
      queue = queue.then(task).catch(() => {});
      return queue;
    },
  };
}
