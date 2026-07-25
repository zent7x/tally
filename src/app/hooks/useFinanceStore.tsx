import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { categorize } from "@/lib/finance/categories";
import { importCSV } from "@/lib/finance/csv";
import { applyDemo } from "@/lib/finance/demo";
import { defaultState, loadState, migrate, saveState } from "@/lib/finance/storage";
import type { EncryptedEnvelope, FinanceState, Transaction } from "@/lib/finance/types";
import { uid } from "@/lib/finance/types";

const storage = localStorage;

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface FinanceContextValue {
  state: FinanceState;
  lockedEnvelope: EncryptedEnvelope | null;
  hasTransactions: boolean;
  setState: (next: FinanceState | ((prev: FinanceState) => FinanceState)) => void;
  addTransaction: (partial?: Partial<Pick<Transaction, "desc" | "amount" | "date">>) => void;
  importTransactions: (text: string) => number;
  loadDemo: () => void;
  replaceTransactions: (transactions: Transaction[]) => void;
  unlock: (state: FinanceState) => void;
  eraseEncrypted: () => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function initialLoad(): { state: FinanceState; locked: EncryptedEnvelope | null } {
  return loadState(storage);
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [{ state, locked }, setBundle] = useState(initialLoad);

  const persist = useCallback((next: FinanceState) => {
    setBundle((prev) => {
      if (!prev.locked) void saveState(storage, next);
      return { ...prev, state: next };
    });
  }, []);

  const setState = useCallback((next: FinanceState | ((prev: FinanceState) => FinanceState)) => {
    setBundle((prev) => {
      const resolved = typeof next === "function" ? next(prev.state) : next;
      if (!prev.locked) void saveState(storage, resolved);
      return { ...prev, state: resolved };
    });
  }, []);

  const addTransaction = useCallback(
    (partial?: Partial<Pick<Transaction, "desc" | "amount" | "date">>) => {
      setState((prev) => {
        const tx: Transaction = {
          id: uid(),
          date: partial?.date ?? isoLocal(new Date()),
          desc: partial?.desc ?? "New transaction",
          amount: partial?.amount ?? -1,
          category: categorize(partial?.desc ?? "", prev.rules),
        };
        return { ...prev, transactions: [...prev.transactions, tx] };
      });
    },
    [setState],
  );

  const importTransactions = useCallback(
    (text: string) => {
      let count = 0;
      setState((prev) => {
        const parsed = importCSV(text, prev.rules);
        count = parsed.length;
        if (!parsed.length) return prev;
        return { ...prev, transactions: [...prev.transactions, ...parsed] };
      });
      return count;
    },
    [setState],
  );

  const loadDemo = useCallback(() => {
    setBundle((prev) => {
      const next = applyDemo(prev.state);
      if (!prev.locked) {
        void saveState(storage, next);
      }
      return { ...prev, state: next, locked: null };
    });
  }, []);

  const replaceTransactions = useCallback(
    (transactions: Transaction[]) => {
      persist({ ...state, transactions });
    },
    [persist, state],
  );

  const unlock = useCallback((unlocked: FinanceState) => {
    const migrated = migrate(unlocked);
    setBundle({ state: migrated, locked: null });
    void saveState(storage, migrated);
  }, []);

  const eraseEncrypted = useCallback(() => {
    storage.removeItem("tally.v1");
    setBundle({ state: defaultState(), locked: null });
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      lockedEnvelope: locked,
      hasTransactions: state.transactions.length > 0,
      setState,
      addTransaction,
      importTransactions,
      loadDemo,
      replaceTransactions,
      unlock,
      eraseEncrypted,
    }),
    [
      state,
      locked,
      setState,
      addTransaction,
      importTransactions,
      loadDemo,
      replaceTransactions,
      unlock,
      eraseEncrypted,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
