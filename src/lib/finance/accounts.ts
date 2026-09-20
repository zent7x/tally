import type { Account, FinanceState, Transaction } from "./types";

export const DEFAULT_ACCOUNT_ID = "default";

export function defaultAccount(balance: number | null = null): Account {
  return { id: DEFAULT_ACCOUNT_ID, name: "Main account", type: "checking", balance };
}

/** Transfers affect account balances, but are neither earned income nor spending. */
export function isTransfer(transaction: Pick<Transaction, "category">): boolean {
  return transaction.category.trim().toLowerCase() === "transfers";
}

/** A supplied balance is today's snapshot, not a starting point for imported history. */
export function accountBalance(state: FinanceState, accountId: string): number {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account) return 0;
  if (account.balance !== null) return account.balance;
  return state.transactions.reduce(
    (total, transaction) =>
      (transaction.accountId ?? DEFAULT_ACCOUNT_ID) === accountId
        ? total + transaction.amount
        : total,
    0,
  );
}

export interface AccountSummary {
  assets: number;
  /** Positive magnitude of balances owed, including overdrawn asset accounts. */
  liabilities: number;
  netWorth: number;
  cashBalance: number;
}

export function accountSummary(state: FinanceState): AccountSummary {
  const summary: AccountSummary = { assets: 0, liabilities: 0, netWorth: 0, cashBalance: 0 };
  for (const account of state.accounts) {
    const balance = accountBalance(state, account.id);
    summary.assets += Math.max(0, balance);
    summary.liabilities += Math.max(0, -balance);
    summary.netWorth += balance;
    if (account.type === "checking" || account.type === "savings" || account.type === "cash") {
      summary.cashBalance += balance;
    }
  }
  return summary;
}
