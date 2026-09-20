import test from "node:test";
import assert from "node:assert/strict";
import { accountBalance, accountSummary } from "../src/lib/finance/accounts.ts";
import { currentBalance, monthIncome, monthSpend } from "../src/lib/finance/balances.ts";
import { createSaveQueue, defaultState, KEY, loadState, migrate } from "../src/lib/finance/storage.ts";
import type { StorageLike, Transaction } from "../src/lib/finance/types.ts";

const tx = (id: string, amount: number, accountId?: string, category = "Income"): Transaction => ({ id, date: "2026-08-01", desc: id, amount, category, ...(accountId ? { accountId } : {}) });

test("legacy migration preserves the current snapshot without double counting history", () => {
  const state = migrate({ transactions: [tx("pay", 3000), tx("rent", -1000)], settings: { startingBalance: 4200 } });
  assert.equal(state.transactions[0].accountId, "default");
  assert.equal(accountBalance(state, "default"), 4200);
  assert.equal(currentBalance(state), 4200);
  assert.equal(state.settings.startingBalance, 4200);
  assert.equal(state.settings.incomePlan.windowMonths, 6);
  assert.deepEqual(migrate(state), state);
});

test("legacy balances derive from history when no snapshot exists", () => {
  const state = migrate({ transactions: [tx("pay", 3000), tx("rent", -1000)] });
  assert.equal(accountBalance(state, "default"), 2000);
  assert.equal(accountBalance(state, "missing"), 0);
});

test("net worth includes investments and signed debt while spendable cash does not", () => {
  const state = defaultState();
  state.accounts = [
    { id: "checking", name: "Checking", type: "checking", balance: 2000 },
    { id: "savings", name: "Savings", type: "savings", balance: 5000 },
    { id: "wallet", name: "Wallet", type: "cash", balance: null },
    { id: "stocks", name: "Stocks", type: "investment", balance: 10000 },
    { id: "card", name: "Card", type: "credit", balance: -700 },
    { id: "loan", name: "Loan", type: "loan", balance: -3000 },
  ];
  state.transactions = [tx("cash", 100, "wallet"), tx("old-pay", 4000, "checking")];
  assert.deepEqual(accountSummary(state), { assets: 17100, liabilities: 3700, netWorth: 13400, cashBalance: 7100 });
  assert.equal(currentBalance(state), 7100);
});

test("transfers move derived account balances without creating income or spending", () => {
  const state = defaultState();
  state.accounts.push({ id: "savings", name: "Savings", type: "savings", balance: null });
  state.transactions = [tx("pay", 1000, "default"), tx("out", -300, "default", "Transfers"), tx("in", 300, "savings", "Transfers"), tx("food", -50, "default", "Food")];
  assert.equal(accountBalance(state, "default"), 650);
  assert.equal(accountBalance(state, "savings"), 300);
  assert.equal(accountSummary(state).netWorth, 950);
  assert.equal(monthIncome(state.transactions, "2026-08"), 1000);
  assert.equal(monthSpend(state.transactions, "2026-08"), 50);
});

test("migration preserves valid data without truncating transactions or changing account snapshots", () => {
  const state = defaultState();
  state.accounts[0].balance = 0;
  state.transactions = Array.from({ length: 12000 }, (_, i) => tx(`tx-${i}`, i, "default"));
  state.settings.incomePlan = { mode: "manual", windowMonths: 12, monthlyTarget: 900, reserveBalance: 100 };
  const restored = migrate(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.transactions.length, 12000);
  assert.equal(currentBalance(restored), 0);
  assert.deepEqual(restored.settings, state.settings);
});

test("invalid backup shapes and orphan accounts are rejected before use", () => {
  for (const bad of [null, [], { transactions: {} }, { transactions: [tx("bad", Infinity)] }, { transactions: [tx("bad", 1, "missing")] }, { settings: { startingBalance: "100" } }, { settings: { incomePlan: { monthlyTarget: -1 } } }, { budgets: { Food: NaN } }, { transactions: [{ ...tx("bad", 1), date: "2026-02-31" }] }, { transactions: [tx("same", 1), tx("same", 2)] }, JSON.parse('{"budgets":{"__proto__":1}}')]) {
    assert.throws(() => migrate(bad), /Invalid backup/);
  }
});

test("missing account assignment receives an additional default without dropping existing accounts", () => {
  const state = migrate({ accounts: [{ id: "savings", name: "Savings", type: "savings", balance: 50 }], transactions: [tx("old", 20)] });
  assert.equal(state.accounts.length, 2);
  assert.equal(accountSummary(state).netWorth, 70);
});

test("save queue reports errors and executes subsequent saves in order", async () => {
  const queue = createSaveQueue();
  const order: number[] = [];
  const failed = queue.enqueue(async () => { order.push(1); throw new Error("Disk full"); });
  const next = queue.enqueue(async () => { order.push(2); });
  await assert.rejects(failed, /Disk full/);
  await next;
  assert.deepEqual(order, [1, 2]);
});

test("a corrupt store is retained as a recovery copy", () => {
  const entries = new Map([[KEY, '{"transactions":"broken"}']]);
  const storage: StorageLike = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: (key) => { entries.delete(key); } };
  const loaded = loadState(storage);
  assert.equal(loaded.state.transactions.length, 0);
  assert.equal([...entries.keys()].some((key) => key.startsWith(`${KEY}.corrupt-`)), true);
  assert.equal([...entries.values()][0], '{"transactions":"broken"}');
});

test("failed recovery reports blocked persistence while retaining the only saved ledger", () => {
  const raw = '{"transactions":"broken"}';
  let removed = false;
  const storage: StorageLike = {
    getItem: () => raw,
    setItem: () => { throw new Error("Storage quota exceeded"); },
    removeItem: () => { removed = true; },
  };
  const loaded = loadState(storage);
  assert.match(loaded.recoveryError ?? "", /Saving has stopped/);
  assert.equal(loaded.locked, null);
  assert.equal(removed, false);
  assert.equal(storage.getItem(KEY), raw);
});
