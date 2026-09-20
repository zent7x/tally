import assert from "node:assert/strict";
import test from "node:test";
import { createSaveQueue, defaultState, KEY, loadState, migrate, saveState } from "../src/lib/finance/storage.ts";
import { decryptWith, deriveKey, encryptWith, envelopeSalt } from "../src/lib/finance/crypto.ts";
import { exportCSV } from "../src/lib/finance/export.ts";
import { parseCSV } from "../src/lib/finance/csv.ts";
import type { FinanceState, StorageLike } from "../src/lib/finance/types.ts";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function populatedState(): FinanceState {
  const state = defaultState();
  state.accounts = [
    { id: "default", name: "Everyday", type: "checking", balance: 1600 },
    { id: "savings", name: "Rainy day", type: "savings", balance: 12000 },
    { id: "credit", name: "Credit card", type: "credit", balance: -325 },
  ];
  state.transactions = [
    { id: "pay", date: "2026-09-01", desc: "Freelance invoice", amount: 2400, category: "Income", accountId: "default" },
    { id: "groceries", date: "2026-09-02", desc: "Market", amount: -45.5, category: "Groceries", accountId: "credit" },
  ];
  state.importPresets = [{ id: "bank", name: "My bank", headers: ["Posted", "Details", "Debit", "Credit"], mapping: {
    date: 0, description: 1, amount: -1, debit: 2, credit: 3, dateFormat: "dmy", invertAmounts: false,
  } }];
  state.settings = { currency: "INR", startingBalance: null, theme: "dark", incomePlan: {
    mode: "conservative", windowMonths: 3, monthlyTarget: 2100, reserveBalance: 4250,
  } };
  state.rules = [["market", "Groceries"]];
  state.budgets = { Groceries: 450 };
  return state;
}

const salt = new Uint8Array(16).fill(7);
const keyPromise = deriveKey("correct horse battery staple", salt);

test("plain save and reload preserve accounts, presets, income plan, and transaction identities", async () => {
  const storage = new MemoryStorage();
  const state = populatedState();
  await saveState(storage, state);
  assert.deepEqual(loadState(storage), { state, locked: null });
  assert.deepEqual(state, populatedState(), "saving must not mutate the caller's ledger");
});

test("encrypted reload stays locked until decryption, then preserves the full ledger", async () => {
  const storage = new MemoryStorage();
  const state = populatedState();
  const key = await keyPromise;
  await saveState(storage, state, { cryptoKey: key, cryptoSalt: salt });
  const raw = storage.getItem(KEY)!;
  assert.equal(raw.includes("Freelance invoice"), false);
  assert.equal(raw.includes("Rainy day"), false);
  const loaded = loadState(storage);
  assert.ok(loaded.locked);
  assert.deepEqual(loaded.state, defaultState(), "locked data must not appear as plaintext");
  assert.deepEqual(envelopeSalt(loaded.locked), salt);
  const restoredKey = await deriveKey("correct horse battery staple", envelopeSalt(loaded.locked));
  assert.deepEqual(migrate(await decryptWith(restoredKey, loaded.locked)), state);
});

test("wrong passphrase and tampered ciphertext are rejected without changing saved data", async () => {
  const storage = new MemoryStorage();
  await saveState(storage, populatedState(), { cryptoKey: await keyPromise, cryptoSalt: salt });
  const raw = storage.getItem(KEY)!;
  const envelope = JSON.parse(raw);
  await assert.rejects(decryptWith(await deriveKey("incorrect passphrase", salt), envelope));
  const ciphertext = Uint8Array.from(atob(envelope.ct), (char) => char.charCodeAt(0));
  ciphertext[0] ^= 1;
  envelope.ct = btoa(String.fromCharCode(...ciphertext));
  await assert.rejects(decryptWith(await keyPromise, envelope));
  assert.equal(storage.getItem(KEY), raw);
});

test("AES-GCM uses fresh IVs and a nonexportable 256-bit key", async () => {
  const key = await keyPromise;
  const first = JSON.parse(await encryptWith(key, salt, populatedState()));
  const second = JSON.parse(await encryptWith(key, salt, populatedState()));
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ct, second.ct);
  assert.equal(atob(first.iv).length, 12);
  assert.equal(key.algorithm.name, "AES-GCM");
  assert.equal((key.algorithm as AesKeyAlgorithm).length, 256);
  await assert.rejects(crypto.subtle.exportKey("raw", key));
});

test("missing encryption salt rejects before replacing the existing store", async () => {
  const storage = new MemoryStorage();
  storage.setItem(KEY, "existing encrypted backup");
  const writes = storage.writes;
  await assert.rejects(saveState(storage, populatedState(), { cryptoKey: await keyPromise }), /salt/i);
  assert.equal(storage.getItem(KEY), "existing encrypted backup");
  assert.equal(storage.writes, writes);
});

test("locked saves never overwrite an encrypted envelope", async () => {
  const storage = new MemoryStorage();
  storage.setItem(KEY, "locked envelope");
  await saveState(storage, defaultState(), { locked: true });
  assert.equal(storage.getItem(KEY), "locked envelope");
  assert.equal(storage.writes, 1);
});

test("storage write failures reject for both plaintext and encrypted saves", async () => {
  const failure = new Error("Storage quota exceeded");
  const storage: StorageLike = { getItem: () => "existing", removeItem: () => {}, setItem: () => { throw failure; } };
  await assert.rejects(saveState(storage, populatedState()), (error) => error === failure);
  await assert.rejects(saveState(storage, populatedState(), { cryptoKey: await keyPromise, cryptoSalt: salt }), (error) => error === failure);
});

test("legacy migration assigns the main account and fills new roadmap fields", () => {
  const legacy = {
    transactions: [{ id: "old", date: "2024-02-29", desc: "Rent", amount: -1000, category: "Housing" }],
    settings: { currency: "usd", startingBalance: 3200 },
  };
  const migrated = migrate(legacy);
  assert.equal(migrated.accounts[0].id, "default");
  assert.equal(migrated.accounts[0].balance, 3200);
  assert.equal(migrated.transactions[0].accountId, "default");
  assert.equal(migrated.settings.currency, "USD");
  assert.deepEqual(migrated.importPresets, []);
  assert.deepEqual(migrated.settings.incomePlan, defaultState().settings.incomePlan);
  assert.equal(Object.hasOwn(legacy.transactions[0], "accountId"), false);
});

test("default ledgers do not share mutable rules or account data", () => {
  const first = defaultState();
  first.rules[0][0] = "changed";
  first.accounts[0].name = "changed";
  first.settings.incomePlan.monthlyTarget = 999;
  const second = defaultState();
  assert.notEqual(second.rules[0][0], "changed");
  assert.notEqual(second.accounts[0].name, "changed");
  assert.equal(second.settings.incomePlan.monthlyTarget, 0);
});

test("migration rejects malformed or ambiguous data before replacement", () => {
  const scenarios: [string, (state: FinanceState) => void][] = [
    ["invalid calendar date", (state) => { state.transactions[0].date = "2023-02-29"; }],
    ["nonfinite amount", (state) => { state.transactions[0].amount = Infinity; }],
    ["duplicate transaction id", (state) => { state.transactions[1].id = state.transactions[0].id; }],
    ["duplicate account id", (state) => { state.accounts[1].id = state.accounts[0].id; }],
    ["orphan account", (state) => { state.transactions[0].accountId = "missing"; }],
    ["negative budget", (state) => { state.budgets.Groceries = -1; }],
    ["bad preset column", (state) => { state.importPresets[0].mapping.date = 99; }],
    ["negative reserve", (state) => { state.settings.incomePlan.reserveBalance = -1; }],
  ];
  for (const [name, change] of scenarios) {
    const state = populatedState(); change(state);
    assert.throws(() => migrate(state), /Invalid backup/, name);
  }
  assert.throws(() => migrate(JSON.parse('{"budgets":{"__proto__":10}}')), /safe property name/);
  assert.throws(() => migrate({ transactions: "not an array" }), /transactions/);
});

test("corrupt stores are backed up before the active key is cleared", () => {
  const storage = new MemoryStorage();
  const invalid = '{"transactions":';
  storage.setItem(KEY, invalid);
  assert.deepEqual(loadState(storage), { state: defaultState(), locked: null });
  assert.equal(storage.getItem(KEY), null);
  const recovered = [...storage.values.entries()].find(([key]) => key.startsWith(KEY + ".corrupt-"));
  assert.equal(recovered?.[1], invalid);
});

test("corrupt originals stay intact when recovery storage is unavailable", () => {
  let removed = false;
  const storage: StorageLike = {
    getItem: () => "broken JSON", setItem: () => { throw new Error("Full"); }, removeItem: () => { removed = true; },
  };
  assert.deepEqual(loadState(storage).state, defaultState());
  assert.equal(removed, false);
  assert.equal(storage.getItem(KEY), "broken JSON");
});

test("malformed encrypted envelopes are recovered instead of presenting an unusable lock", () => {
  for (const envelope of [
    { v: 1, enc: true, iv: "AAAA", ct: "AAAA" },
    { v: 1, enc: true, salt: "invalid base64?", iv: "AAAA", ct: "AAAA" },
    { v: 2, enc: true, salt: btoa("a".repeat(16)), iv: btoa("a".repeat(12)), ct: btoa("a".repeat(16)) },
  ]) {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(envelope);
    storage.setItem(KEY, raw);
    assert.equal(loadState(storage).locked, null);
    assert.ok([...storage.values.entries()].some(([key, value]) => key.startsWith(KEY + ".corrupt-" ) && value === raw));
  }
});

test("save queue keeps order and continues after callers observe a failed write", async () => {
  const queue = createSaveQueue();
  const events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = queue.enqueue(async () => { events.push("first started"); await gate; events.push("first finished"); });
  const second = queue.enqueue(async () => { events.push("second failed"); throw new Error("write failed"); });
  const observedFailure = assert.rejects(second, /write failed/);
  const third = queue.enqueue(async () => { events.push("third saved"); });
  await Promise.resolve();
  assert.deepEqual(events, ["first started"]);
  release();
  await Promise.all([first, observedFailure, third]);
  assert.deepEqual(events, ["first started", "first finished", "second failed", "third saved"]);
});

test("queued encrypted saves persist the most recent ledger", async () => {
  const storage = new MemoryStorage();
  const queue = createSaveQueue();
  const key = await keyPromise;
  const first = populatedState();
  const last = populatedState();
  last.settings.incomePlan.monthlyTarget = 1950;
  last.transactions.push({ id: "latest", date: "2026-09-20", desc: "Last edit", amount: -12, category: "Dining", accountId: "default" });
  await Promise.all([first, last].map((state) => queue.enqueue(() => saveState(storage, state, { cryptoKey: key, cryptoSalt: salt }))));
  assert.deepEqual(migrate(await decryptWith(key, loadState(storage).locked!)), last);
});

test("CSV export preserves quoted descriptions, line breaks, account names, signs, and row order", () => {
  const state = populatedState();
  state.transactions[0].desc = 'Invoice, "September"\nDesign work';
  const csv = exportCSV(state);
  const rows = parseCSV(csv);
  assert.deepEqual(rows[0], ["Date", "Description", "Amount", "Category", "Account"]);
  assert.deepEqual(rows[1], ["2026-09-01", 'Invoice, "September"\nDesign work', "2400", "Income", "Everyday"]);
  assert.deepEqual(rows[2], ["2026-09-02", "Market", "-45.5", "Groceries", "Credit card"]);
  assert.ok(csv.includes('"Invoice, ""September""\nDesign work"'));
  assert.ok(csv.includes("\r\n"));
});

test("CSV formula protection covers descriptions, categories, and account names without altering numeric amounts", () => {
  const state = populatedState();
  state.accounts[0].name = '=HYPERLINK("https://example.test")';
  const attacks = ["=1+1", "+1+1", "-1+1", "@SUM(A1)", " \t=1+1", "\r\n=1+1"];
  state.transactions = attacks.map((attack, index) => ({
    id: String(index), date: "2026-09-01", desc: attack, category: attack, amount: -42.75, accountId: "default",
  }));
  const rows = parseCSV(exportCSV(state));
  rows.slice(1).forEach((row, index) => {
    assert.equal(row[1], "'" + attacks[index].replace(/\r\n/g, "\n"));
    assert.equal(row[2], "-42.75");
    assert.equal(row[3], "'" + attacks[index].replace(/\r\n/g, "\n"));
    assert.equal(row[4], "'" + state.accounts[0].name);
  });
});

test("empty and filtered CSV exports contain only the selected ledger rows", () => {
  const state = populatedState();
  assert.equal(parseCSV(exportCSV({ ...state, transactions: [] })).length, 1);
  const filtered = parseCSV(exportCSV({ ...state, transactions: [state.transactions[1]] }));
  assert.equal(filtered.length, 2);
  assert.equal(filtered[1][1], "Market");
  assert.equal(state.transactions.length, 2);
});
