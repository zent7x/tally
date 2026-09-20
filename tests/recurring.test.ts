import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRecurring } from "../src/lib/finance/recurring.ts";
import type { Transaction } from "../src/lib/finance/types.ts";
const series = (description: string, accountId: string, category = "Subscriptions"): Transaction[] => [1, 2, 3].map((month) => ({
  id: `${accountId}-${month}`, date: `2026-0${month}-04`, desc: description, amount: -20, category, accountId,
}));
test("identical recurring merchants in separate accounts remain separate", () => {
  const result = detectRecurring([...series("Netflix", "checking"), ...series("Netflix", "credit")], -1);
  assert.equal(result.length, 2);
  assert.equal(result.reduce((total, item) => total + item.monthly, 0), 40);
});
test("bank descriptions cannot collide with Object prototype properties", () => {
  assert.equal(detectRecurring(series("constructor", "checking"), -1).length, 1);
});
test("recurring transfers do not become estimated bills", () => {
  assert.equal(detectRecurring(series("Savings transfer", "checking", "Transfers"), -1).length, 0);
});
