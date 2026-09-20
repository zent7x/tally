import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { categorize } from "@/lib/finance/categories";
import { applyDemo } from "@/lib/finance/demo";
import { deriveKey, encryptWith } from "@/lib/finance/crypto";
import { createSaveQueue, defaultState, KEY, loadState, migrate, saveState } from "@/lib/finance/storage";
import type { EncryptedEnvelope, FinanceState, Transaction } from "@/lib/finance/types";
import { uid } from "@/lib/finance/types";

const storage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};
type Security = { key: CryptoKey; salt: BufferSource };
type StateUpdate = FinanceState | ((prev: FinanceState) => FinanceState);
const CONFLICT_MESSAGE = "Another tab changed your ledger. Saving in this tab has stopped to protect the newer data. Export a backup of this tab's changes, then reload before continuing.";

class StorageConflict extends Error {
  constructor() { super(CONFLICT_MESSAGE); }
}

interface FinanceContextValue {
  state: FinanceState;
  lockedEnvelope: EncryptedEnvelope | null;
  hasTransactions: boolean;
  encrypted: boolean;
  saving: boolean;
  storageError: string;
  setState: (next: StateUpdate) => void;
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  loadDemo: () => void;
  replaceTransactions: (transactions: Transaction[]) => void;
  unlock: (state: FinanceState, key: CryptoKey, salt: BufferSource) => void;
  enableEncryption: (passphrase: string) => Promise<void>;
  disableEncryption: () => Promise<void>;
  lock: () => Promise<void>;
  eraseEncrypted: () => void;
  reset: () => void;
  flush: () => Promise<void>;
  serializeBackup: () => Promise<{ data: string; encrypted: boolean }>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    let token: string | null | undefined;
    const bundle = loadState({
      ...storage,
      getItem: (key) => {
        const raw = storage.getItem(key);
        if (key === KEY) token = raw;
        return raw;
      },
      removeItem: (key) => {
        storage.removeItem(key);
        if (key === KEY) token = null;
      },
    });
    return { bundle, token };
  });
  const [bundle, setBundle] = useState(initial.bundle);
  const bundleRef = useRef(bundle);
  const storageToken = useRef(initial.token);
  const conflict = useRef(false);
  const revision = useRef(0);
  const security = useRef<Security | null>(null);
  const queue = useRef(createSaveQueue());
  const changingSecurity = useRef(false);
  const [encrypted, setEncrypted] = useState(!!bundle.locked);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(initial.bundle.recoveryError ?? "");
  const pending = useRef(0);

  useEffect(() => {
    const detectOtherTab = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== KEY && event.key !== null)) return;
      // An event can be delivered after a later save; compare the current value.
      if (storage.getItem(KEY) !== storageToken.current) {
        conflict.current = true;
        setStorageError(CONFLICT_MESSAGE);
      }
    };
    window.addEventListener("storage", detectOtherTab);
    return () => window.removeEventListener("storage", detectOtherTab);
  }, []);

  useEffect(() => {
    const protectPendingChanges = (event: BeforeUnloadEvent) => {
      if (pending.current > 0 || changingSecurity.current || conflict.current || storageError) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protectPendingChanges);
    return () => window.removeEventListener("beforeunload", protectPendingChanges);
  }, [storageError]);

  const enqueue = useCallback((task: () => Promise<void>) => {
    pending.current++;
    setSaving(true);
    return queue.current.enqueue(task).then(() => {
      if (!conflict.current) setStorageError("");
    }, (error: unknown) => {
      if (error instanceof StorageConflict) conflict.current = true;
      setStorageError(conflict.current ? CONFLICT_MESSAGE
        : "Your latest changes could not be saved. Export a backup before closing this page. " +
          (error instanceof Error ? error.message : "Browser storage is unavailable."));
      throw error;
    }).finally(() => {
      pending.current--;
      setSaving(pending.current > 0);
    });
  }, []);

  const assertCurrentStore = useCallback(() => {
    if (initial.bundle.recoveryError) throw new Error(initial.bundle.recoveryError);
    if (conflict.current || storageToken.current === undefined || storage.getItem(KEY) !== storageToken.current) {
      conflict.current = true;
      throw new StorageConflict();
    }
  }, [initial.bundle.recoveryError]);

  const persist = useCallback(async (state: FinanceState, protection: Security | null) => {
    const save = () => saveState({
      ...storage,
      setItem: (key, raw) => {
        // Check immediately before writing, after any asynchronous encryption.
        assertCurrentStore();
        storage.setItem(key, raw);
        storageToken.current = raw;
      },
    }, state, { cryptoKey: protection?.key, cryptoSalt: protection?.salt });
    // Serialize the comparison and write across tabs where Web Locks are available.
    if (navigator.locks) await navigator.locks.request(`${KEY}.write`, save);
    else await save();
  }, [assertCurrentStore]);

  const write = useCallback(async (state: FinanceState) => {
    // A successful lock already includes edits that arrived while it was saving.
    if (bundleRef.current.locked) return;
    await persist(state, security.current);
  }, [persist]);

  const setState = useCallback((next: StateUpdate) => {
    if (bundleRef.current.locked) return;
    const resolved = typeof next === "function" ? next(bundleRef.current.state) : next;
    const updated = { state: resolved, locked: null };
    bundleRef.current = updated;
    revision.current++;
    setBundle(updated);
    void enqueue(() => write(resolved)).catch(() => {});
  }, [enqueue, write]);

  const addTransaction = useCallback((transaction: Omit<Transaction, "id">) => {
    setState((prev) => ({ ...prev, transactions: [...prev.transactions, {
      ...transaction, id: uid(), category: transaction.category || categorize(transaction.desc, prev.rules),
      accountId: transaction.accountId || prev.accounts[0]?.id || "default",
    }] }));
  }, [setState]);

  const loadDemo = useCallback(() => setState((prev) => migrate(applyDemo(defaultStateWithPreferences(prev)))) , [setState]);
  const replaceTransactions = useCallback((transactions: Transaction[]) => {
    setState((prev) => ({ ...prev, transactions }));
  }, [setState]);

  const unlock = useCallback((unlocked: FinanceState, key: CryptoKey, salt: BufferSource) => {
    const next = { state: migrate(unlocked), locked: null };
    security.current = { key, salt };
    bundleRef.current = next;
    setEncrypted(true);
    setBundle(next);
  }, []);

  const enableEncryption = useCallback(async (passphrase: string) => {
    if (changingSecurity.current || bundleRef.current.locked) return;
    if (passphrase.length < 8) throw new Error("Use at least 8 characters for your passphrase.");
    changingSecurity.current = true;
    try {
      await enqueue(async () => {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(passphrase, salt);
        await persist(bundleRef.current.state, { key, salt });
        security.current = { key, salt };
        setEncrypted(true);
      });
    } finally { changingSecurity.current = false; }
  }, [enqueue, persist]);

  const disableEncryption = useCallback(async () => {
    if (changingSecurity.current || bundleRef.current.locked) return;
    changingSecurity.current = true;
    try {
      await enqueue(async () => {
        await persist(bundleRef.current.state, null);
        security.current = null;
        setEncrypted(false);
      });
    } finally { changingSecurity.current = false; }
  }, [enqueue, persist]);

  const lock = useCallback(async () => {
    if (!security.current || changingSecurity.current) return;
    changingSecurity.current = true;
    try {
      await enqueue(async () => {
        // Include edits made while encryption is in flight before clearing memory.
        let savedRevision: number;
        do {
          savedRevision = revision.current;
          await write(bundleRef.current.state);
        } while (savedRevision !== revision.current);
        const envelope = JSON.parse(storageToken.current!) as EncryptedEnvelope;
        const next = { state: defaultState(), locked: envelope };
        security.current = null;
        bundleRef.current = next;
        setBundle(next);
      });
    } finally { changingSecurity.current = false; }
  }, [enqueue, write]);

  const eraseEncrypted = useCallback(() => {
    try {
      assertCurrentStore();
      storage.removeItem(KEY);
      storageToken.current = null;
      const next = { state: defaultState(), locked: null };
      security.current = null;
      bundleRef.current = next;
      setBundle(next);
      setEncrypted(false);
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Browser storage could not be cleared.");
    }
  }, [assertCurrentStore]);
  const reset = useCallback(() => setState(defaultState()), [setState]);
  const flush = useCallback(() => enqueue(() => write(bundleRef.current.state)), [enqueue, write]);
  const serializeBackup = useCallback(async () => {
    // Wait for a security change to settle without requiring a successful disk write.
    await queue.current.enqueue(async () => {});
    if (bundleRef.current.locked) return { data: JSON.stringify(bundleRef.current.locked), encrypted: true };
    const currentSecurity = security.current;
    const currentState = bundleRef.current.state;
    return currentSecurity
      ? { data: await encryptWith(currentSecurity.key, currentSecurity.salt, currentState), encrypted: true }
      : { data: JSON.stringify(currentState, null, 2), encrypted: false };
  }, []);

  const value = useMemo<FinanceContextValue>(() => ({
    state: bundle.state, lockedEnvelope: bundle.locked, hasTransactions: bundle.state.transactions.length > 0,
    encrypted, saving, storageError, setState, addTransaction, loadDemo, replaceTransactions,
    unlock, enableEncryption, disableEncryption, lock, eraseEncrypted, reset, flush, serializeBackup,
  }), [bundle, encrypted, saving, storageError, setState, addTransaction, loadDemo, replaceTransactions,
    unlock, enableEncryption, disableEncryption, lock, eraseEncrypted, reset, flush, serializeBackup]);
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

function defaultStateWithPreferences(previous: FinanceState): FinanceState {
  const state = defaultState();
  state.settings.currency = previous.settings.currency;
  state.settings.theme = previous.settings.theme;
  return state;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used within FinanceProvider");
  return context;
}
