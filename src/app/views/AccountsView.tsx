import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Pencil, Plus, Wallet } from "lucide-react";
import { Modal } from "@/app/components/Modal";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { accountBalance, accountSummary, DEFAULT_ACCOUNT_ID } from "@/lib/finance/accounts";
import { uid, type Account } from "@/lib/finance/types";

const ACCOUNT_TYPES: { value: Account["type"]; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "credit", label: "Credit card" },
  { value: "loan", label: "Loan" },
];

function isDebt(type: Account["type"]) {
  return type === "credit" || type === "loan";
}

interface AccountDraft {
  id: string | null;
  name: string;
  type: Account["type"];
  balance: string;
}

export function AccountsView() {
  const { state, setState } = useFinance();
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const summary = accountSummary(state);
  const money = (value: number) => new Intl.NumberFormat(undefined, {
    style: "currency", currency: state.settings.currency,
  }).format(value);
  const transactionCount = (accountId: string) => state.transactions.filter(
    (transaction) => (transaction.accountId ?? DEFAULT_ACCOUNT_ID) === accountId,
  ).length;
  const editingAccount = draft?.id ? state.accounts.find((account) => account.id === draft.id) : undefined;
  const deleteReason = !editingAccount ? "" : state.accounts.length <= 1
    ? "Keep at least one account for your transactions."
    : transactionCount(editingAccount.id) > 0
      ? "This account has transactions. Move them to another account before deleting it."
      : "";

  function openEditor(account?: Account) {
    setError("");
    setConfirmDelete(false);
    setDraft(account ? {
      id: account.id, name: account.name, type: account.type,
      balance: account.balance === null ? "" : String(isDebt(account.type) ? -account.balance : account.balance),
    } : { id: null, name: "", type: "checking", balance: "" });
  }

  function closeEditor() {
    setDraft(null);
    setError("");
    setConfirmDelete(false);
  }

  function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError("Enter an account name.");
      return;
    }
    const enteredBalance = draft.balance.trim() === "" ? null : Number(draft.balance);
    if (enteredBalance !== null && !Number.isFinite(enteredBalance)) {
      setError("Enter a valid balance, or leave it blank to use transaction history.");
      return;
    }
    const account: Account = {
      id: draft.id ?? `account-${uid()}`,
      name,
      type: draft.type,
      balance: enteredBalance === null ? null : isDebt(draft.type) ? -enteredBalance : enteredBalance,
    };
    setState((previous) => ({
      ...previous,
      accounts: draft.id
        ? previous.accounts.map((existing) => existing.id === draft.id ? account : existing)
        : [...previous.accounts, account],
    }));
    closeEditor();
  }

  function deleteAccount() {
    if (!editingAccount || deleteReason || !confirmDelete) return;
    const accountId = editingAccount.id;
    setState((previous) => {
      if (previous.accounts.length <= 1 || previous.transactions.some(
        (transaction) => (transaction.accountId ?? DEFAULT_ACCOUNT_ID) === accountId,
      )) return previous;
      return { ...previous, accounts: previous.accounts.filter((account) => account.id !== accountId) };
    });
    closeEditor();
  }

  return (
    <div className="space-y-6">
      <div className="section-heading flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Balances</h2>
          <p className="muted mt-1 text-sm">Manage accounts and current balance snapshots.</p>
        </div>
        <button type="button" className="btn" onClick={() => openEditor()}><Plus size={16} aria-hidden="true" /> Add account</button>
      </div>

      <div className="metric-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Net worth", value: summary.netWorth, detail: "Assets minus debts", icon: Landmark },
          { title: "Assets", value: summary.assets, detail: "All positive account balances", icon: ArrowUpRight },
          { title: "Debts", value: summary.liabilities, detail: "Amount owed, including overdrafts", icon: ArrowDownLeft },
          { title: "Cash available", value: summary.cashBalance, detail: "Checking, savings, and cash", icon: Wallet },
        ].map(({ title, value, detail, icon: Icon }) => (
          <section className="metric-card panel min-w-0 p-5" key={title} aria-label={title}>
            <div className="flex items-center justify-between gap-2"><h3 className="muted text-sm">{title}</h3><Icon size={17} aria-hidden="true" /></div>
            <p className="my-3 break-words text-3xl font-semibold tracking-tight tabular-nums">{money(value)}</p>
            <p className="muted text-xs">{detail}</p>
          </section>
        ))}
      </div>

      <section className="panel p-5 sm:p-6" aria-labelledby="account-list-title">
        <div className="section-heading mb-5 flex flex-wrap items-start justify-between gap-3">
          <div><h3 id="account-list-title" className="text-lg font-semibold">Accounts</h3><p className="muted mt-1 text-sm">{state.accounts.length} {state.accounts.length === 1 ? "account" : "accounts"} · stored only on this device</p></div>
          <span className="muted text-xs">All balances in {state.settings.currency}</span>
        </div>
        <ul className="space-y-3">
          {state.accounts.map((account) => {
            const balance = accountBalance(state, account.id);
            const count = transactionCount(account.id);
            return (
              <li key={account.id} className="account-row flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0 flex-1">
                  <h4 className="break-words font-semibold">{account.name}</h4>
                  <p className="muted mt-1 text-xs">{ACCOUNT_TYPES.find((type) => type.value === account.type)?.label} · {count} {count === 1 ? "transaction" : "transactions"}</p>
                  <p className="muted mt-1 text-xs">{account.balance === null ? "Calculated from assigned transaction history" : "Current balance snapshot · history is not added"}</p>
                </div>
                <div className="account-totals flex max-w-full flex-wrap items-center gap-4">
                  <div className="min-w-0 text-right"><p className="break-words text-lg font-semibold tabular-nums">{money(balance)}</p>{balance < 0 && <p className="muted text-xs">Amount owed: {money(-balance)}</p>}</div>
                  <button type="button" className="btn sec" aria-label={`Edit ${account.name}`} onClick={() => openEditor(account)}><Pencil size={14} aria-hidden="true" /> Edit</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="notice muted text-sm">Enter a current balance for an accurate snapshot, or leave it blank to total that account’s imported history. Imported history may not include your opening balance. All accounts use {state.settings.currency}; Tally does not convert currencies or fetch live balances.</p>

      {draft && <Modal title={draft.id ? "Edit account" : "Add account"} onClose={closeEditor}>
        <form onSubmit={saveAccount} className="space-y-5">
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <label className="ledger-field">Account name
            <input className="ledger-input" autoFocus required maxLength={120} value={draft.name} placeholder="e.g. Everyday checking" onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setError(""); }} />
          </label>
          <div className="field-grid">
            <label className="ledger-field">Account type
              <select className="ledger-input" value={draft.type} onChange={(event) => {
                const type = event.target.value as Account["type"];
                const flipSign = isDebt(type) !== isDebt(draft.type);
                setDraft({ ...draft, type, balance: flipSign && draft.balance.trim() !== "" && Number.isFinite(Number(draft.balance)) ? String(-Number(draft.balance)) : draft.balance });
              }}>{ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
            </label>
            <label className="ledger-field">{isDebt(draft.type) ? "Amount owed" : "Current balance"} ({state.settings.currency})
              <input className="ledger-input" type="number" step="any" value={draft.balance} placeholder="Use transaction history" aria-describedby="account-balance-help" onChange={(event) => { setDraft({ ...draft, balance: event.target.value }); setError(""); }} />
            </label>
          </div>
          <p id="account-balance-help" className="muted text-sm">{isDebt(draft.type)
            ? "Enter the amount you owe as a positive number. It is stored as a negative balance and reduces net worth. A negative amount owed represents a credit surplus."
            : "Enter today’s balance. A negative balance represents an overdraft and is included in debts."} Leave blank to calculate from this account’s transactions. A snapshot replaces the calculated balance; transactions are never added on top.</p>
          <div className="form-actions flex flex-wrap justify-end gap-3">
            <button type="button" className="btn sec" onClick={closeEditor}>Cancel</button>
            <button type="submit" className="btn">{draft.id ? "Save changes" : "Add account"}</button>
          </div>
          {editingAccount && <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {deleteReason ? <p className="muted text-xs">{deleteReason}</p> : confirmDelete ? <div className="notice space-y-3">
              <p className="text-sm">Delete {editingAccount.name}? This account has no transactions. Its {money(accountBalance(state, editingAccount.id))} balance will be removed from your totals.</p>
              <div className="flex flex-wrap gap-3"><button type="button" className="btn sec" onClick={() => setConfirmDelete(false)}>Keep account</button><button type="button" className="btn sec" onClick={deleteAccount}>Confirm deletion</button></div>
            </div> : <button type="button" className="btn sec" onClick={() => setConfirmDelete(true)}>Delete account</button>}
          </div>}
        </form>
      </Modal>}
    </div>
  );
}
