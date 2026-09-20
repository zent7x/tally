import { useId, useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/app/components/Modal";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { CATS, categorize } from "@/lib/finance/categories";
import { uid, type Transaction } from "@/lib/finance/types";

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function TransactionDialog({ transaction, onClose, onSaved }: {
  transaction?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { state, setState } = useFinance();
  const id = useId();
  const [date, setDate] = useState(transaction?.date || localToday());
  const [description, setDescription] = useState(transaction?.desc || "");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [category, setCategory] = useState(transaction?.category || "");
  const [accountId, setAccountId] = useState(transaction?.accountId || state.accounts[0]?.id || "default");
  const [remember, setRemember] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");
  const suggestedCategory = categorize(description, state.rules);
  const selectedCategory = category || suggestedCategory;
  const categories = useMemo(() => [...new Set([
    ...CATS.map(([name]) => name), ...state.transactions.map((item) => item.category),
    ...state.rules.map(([, name]) => name), ...(transaction ? [transaction.category] : []),
  ])].filter(Boolean).sort(), [state.transactions, state.rules, transaction]);
  const missingAccount = !state.accounts.some((account) => account.id === accountId);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    const cleanDescription = description.trim();
    const cleanKeyword = keyword.trim().toLowerCase();
    if (!validDate(date)) { setError("Enter a valid calendar date."); return; }
    if (!cleanDescription) { setError("Add a description for this transaction."); return; }
    if (!amount.trim() || !Number.isFinite(value)) { setError("Enter a valid amount. Use a minus sign for money spent."); return; }
    if (!accountId) { setError("Choose an account for this transaction."); return; }
    if (remember && (!cleanKeyword || !cleanDescription.toLowerCase().includes(cleanKeyword))) {
      setError("Choose a keyword contained in this description so the rule matches this transaction."); return;
    }
    if (transaction && !state.transactions.some((item) => item.id === transaction.id)) {
      setError("This transaction no longer exists. Close this form to refresh your ledger."); return;
    }
    const saved: Transaction = {
      id: transaction?.id || uid(), date, desc: cleanDescription, amount: value,
      category: selectedCategory, accountId,
    };
    setState((previous) => ({
      ...previous,
      transactions: transaction
        ? previous.transactions.map((item) => item.id === transaction.id ? saved : item)
        : [...previous.transactions, saved],
      rules: remember
        ? [[cleanKeyword, selectedCategory], ...previous.rules.filter(([rule]) => rule.toLowerCase() !== cleanKeyword)]
        : previous.rules,
    }));
    onSaved();
  }

  return <Modal title={transaction ? "Edit transaction" : "Add transaction"} onClose={onClose}>
    <form onSubmit={save} className="space-y-5">
      <p className="muted">Keep the details that make your ledger useful. Changes stay on this device.</p>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="field-grid">
        <label className="ledger-field" htmlFor={`${id}-date`}>Date
          <input id={`${id}-date`} className="ledger-input" type="date" min="0001-01-01" max="9999-12-31" value={date}
            onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="ledger-field" htmlFor={`${id}-amount`}>Amount ({state.settings.currency})
          <input id={`${id}-amount`} className="ledger-input" type="number" step="any" inputMode="decimal" value={amount}
            onChange={(event) => setAmount(event.target.value)} placeholder="e.g. -24.50" aria-describedby={`${id}-amount-help`} required />
          <span id={`${id}-amount-help`} className="muted text-xs">Negative for expenses (−24.50), positive for income (2500).</span>
        </label>
      </div>
      <label className="ledger-field" htmlFor={`${id}-description`}>Description
        <input id={`${id}-description`} className="ledger-input" type="text" value={description}
          onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Weekly groceries" required maxLength={1000} />
      </label>
      <div className="field-grid">
        <label className="ledger-field" htmlFor={`${id}-category`}>Category
          <select id={`${id}-category`} className="ledger-input" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Automatic · {suggestedCategory}</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="ledger-field" htmlFor={`${id}-account`}>Account
          <select id={`${id}-account`} className="ledger-input" value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
            {missingAccount && <option value={accountId}>Unassigned account</option>}
            {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
        <label className="flex items-start gap-2 text-sm" htmlFor={`${id}-remember`}>
          <input id={`${id}-remember`} className="mt-1" type="checkbox" checked={remember} onChange={(event) => {
            setRemember(event.target.checked);
            if (event.target.checked && !keyword) setKeyword(description.trim().toLowerCase());
          }} />
          Remember this category for matching descriptions
        </label>
        {remember && <label className="ledger-field" htmlFor={`${id}-keyword`}>Matching keyword
          <input id={`${id}-keyword`} className="ledger-input" value={keyword} onChange={(event) => setKeyword(event.target.value)}
            placeholder="e.g. grocery" required aria-describedby={`${id}-rule-help`} />
          <span id={`${id}-rule-help`} className="muted text-xs">Future automatic categorization will use {selectedCategory} when a description contains this keyword. Other existing transactions stay as they are.</span>
        </label>}
      </div>
      <div className="form-actions">
        <button className="btn sec" type="button" onClick={onClose}>Cancel</button>
        <button className="btn" type="submit">{transaction ? "Save changes" : "Save transaction"}</button>
      </div>
    </form>
  </Modal>;
}
