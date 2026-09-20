import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, FileUp, LockKeyhole, ShieldCheck } from "lucide-react";
import { Modal } from "@/app/components/Modal";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { decryptWith, deriveKey, envelopeSalt, isEncryptedEnvelope } from "@/lib/finance/crypto";
import { downloadFile, exportCSV } from "@/lib/finance/export";
import { migrate } from "@/lib/finance/storage";
import type { EncryptedEnvelope, FinanceState } from "@/lib/finance/types";

const CURRENCIES = [
  ["USD", "US dollar"], ["INR", "Indian rupee"], ["EUR", "Euro"], ["GBP", "British pound"],
  ["AUD", "Australian dollar"], ["CAD", "Canadian dollar"], ["JPY", "Japanese yen"],
  ["CHF", "Swiss franc"], ["CNY", "Chinese yuan"], ["SGD", "Singapore dollar"],
  ["AED", "UAE dirham"], ["NZD", "New Zealand dollar"], ["BRL", "Brazilian real"],
  ["MXN", "Mexican peso"], ["ZAR", "South African rand"],
];

type Confirmation = "demo" | "reset" | "decrypt" | null;
type RestorePreview = { state: FinanceState; name: string; wasEncrypted: boolean };

function validateBackup(value: unknown): FinanceState {
  if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).transactions)) {
    throw new Error("Choose a Tally JSON backup containing a transactions list.");
  }
  return migrate(value);
}

function validateEnvelope(value: unknown): EncryptedEnvelope {
  if (!isEncryptedEnvelope(value) || value.v !== 1) throw new Error("This encrypted backup format is not supported.");
  try {
    if (atob(value.salt).length !== 16 || atob(value.iv).length !== 12 || atob(value.ct).length < 16) {
      throw new Error("incomplete");
    }
  } catch {
    throw new Error("The encrypted backup is incomplete or damaged.");
  }
  return value;
}

export function DataView() {
  const { state, setState, encrypted, saving, storageError, enableEncryption, disableEncryption, lock, loadDemo, reset, flush, serializeBackup } = useFinance();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreEnvelope, setRestoreEnvelope] = useState<{ envelope: EncryptedEnvelope; name: string } | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const disabled = Boolean(busy) || saving;
  const backupDate = () => new Date().toISOString().slice(0, 10);

  async function runAction(label: string, action: () => Promise<void>, message = "") {
    if (running.current) return;
    running.current = true;
    setBusy(label);
    setError("");
    setSuccess("");
    try {
      await action();
      if (mounted.current && message) setSuccess(message);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      running.current = false;
      if (mounted.current) setBusy("");
    }
  }

  async function saveMutation(change: () => void) {
    const previous = state;
    change();
    try {
      await flush();
    } catch (cause) {
      // Retain the previous ledger in memory if a replacement cannot be persisted.
      setState(previous);
      try { await flush(); } catch { /* The store displays its persistent storage error. */ }
      throw new Error(`The change could not be saved. Your previous data has been restored in this session. ${cause instanceof Error ? cause.message : "Check available browser storage."}`);
    }
  }

  function exportBackup() {
    void runAction("Preparing backup…", async () => {
      const backup = await serializeBackup();
      downloadFile(`tally-${backup.encrypted ? "encrypted" : "backup"}-${backupDate()}.json`, backup.data, "application/json");
    }, "Backup download requested. Keep the file somewhere you can find it again.");
  }

  function readBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || running.current) return;
    void runAction("Reading backup…", async () => {
      const raw: unknown = JSON.parse(await file.text());
      if (!mounted.current) return;
      setRestorePassphrase("");
      if (raw && typeof raw === "object" && (raw as Record<string, unknown>).enc === true) {
        const envelope = validateEnvelope(raw);
        setRestoreEnvelope({ envelope, name: file.name });
      } else {
        setPreview({ state: validateBackup(raw), name: file.name, wasEncrypted: false });
      }
    });
  }

  function decryptBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restoreEnvelope || !restorePassphrase) return;
    const source = restoreEnvelope;
    void runAction("Decrypting backup…", async () => {
      let raw: unknown;
      try {
        const key = await deriveKey(restorePassphrase, envelopeSalt(source.envelope) as BufferSource);
        raw = await decryptWith(key, source.envelope);
      } catch {
        throw new Error("The backup could not be unlocked. Check its passphrase; the file may also be damaged.");
      }
      const restored = validateBackup(raw);
      if (!mounted.current) return;
      setPreview({ state: restored, name: source.name, wasEncrypted: true });
      setRestoreEnvelope(null);
      setRestorePassphrase("");
    });
  }

  function protectData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passphrase.length < 8 || passphrase !== confirmPassphrase) {
      setError(passphrase.length < 8 ? "Use at least 8 characters for your passphrase." : "The passphrases do not match.");
      setSuccess("");
      return;
    }
    void runAction("Encrypting local data…", async () => {
      await enableEncryption(passphrase);
      await flush();
      if (mounted.current) { setPassphrase(""); setConfirmPassphrase(""); }
    }, "Your local data is encrypted. Keep your passphrase safe.");
  }

  function confirmAction() {
    if (!confirmation) return;
    const selected = confirmation;
    void runAction(selected === "decrypt" ? "Removing encryption…" : "Saving changes…", async () => {
      if (selected === "decrypt") { await disableEncryption(); await flush(); }
      else await saveMutation(selected === "demo" ? loadDemo : reset);
      if (mounted.current) setConfirmation(null);
    }, selected === "decrypt" ? "Encryption removed. Local data and future JSON backups are now unencrypted."
      : selected === "demo" ? "Demo data loaded and saved." : "Your ledger has been reset and saved.");
  }

  function closeRestore() {
    if (running.current) return;
    setPreview(null);
    setRestoreEnvelope(null);
    setRestorePassphrase("");
    setError("");
  }

  return (
    <div className="space-y-6" aria-busy={Boolean(busy)}>
      <div className="section-heading">
        <h2 className="text-2xl font-semibold tracking-tight">Your data. Your control.</h2>
        <p className="muted mt-1 text-sm">Manage backups, local protection, and the way your money is displayed.</p>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {busy && <p className="notice muted text-sm" role="status">{busy}</p>}
        {success && <p className="notice text-sm" role="status">{success}</p>}
      </div>
      {error && !preview && !restoreEnvelope && !confirmation && <p className="notice error text-sm" role="alert">{error}</p>}
      {storageError && <p className="notice error text-sm" role="alert">{storageError}</p>}

      <section className="panel space-y-5 p-5 sm:p-6" aria-labelledby="backup-title">
        <div className="section-heading"><h3 id="backup-title" className="text-lg font-semibold">Back up & restore</h3><p className="muted mt-1 text-sm">Browser data can be cleared. A JSON backup keeps your complete ledger, accounts, budgets, import presets, and settings together.</p></div>
        <div className="metric-grid grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[["Transactions", state.transactions.length], ["Accounts", state.accounts.length], ["Budgets", Object.keys(state.budgets).length], ["Import presets", state.importPresets.length]].map(([label, count]) => <div key={label} className="min-w-0"><p className="muted text-xs">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p></div>)}
        </div>
        <div className="form-actions flex flex-wrap gap-3">
          <button type="button" className="btn" disabled={disabled} onClick={exportBackup}><Download size={16} aria-hidden="true" /> Download {encrypted ? "encrypted " : ""}JSON backup</button>
          <button type="button" className="btn sec" disabled={disabled} onClick={() => restoreInput.current?.click()}><FileUp size={16} aria-hidden="true" /> Restore JSON backup</button>
          <input ref={restoreInput} className="sr-only" type="file" accept=".json,application/json" aria-label="Select Tally JSON backup" tabIndex={-1} disabled={disabled} onChange={readBackup} />
        </div>
        <p className="muted text-xs">{encrypted ? "JSON backups stay encrypted with your current passphrase. You will need that passphrase to restore them." : "JSON backups contain unencrypted financial data. Enable passphrase protection below to create encrypted backups."} Restoring a backup replaces the current ledger after you review it.</p>
        <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <h4 className="font-medium">Transaction spreadsheet</h4>
          <p className="muted text-sm">Export categorized transactions and account names as CSV. CSV files are always unencrypted, even when local protection is enabled. They are not complete backups.</p>
          <button type="button" className="btn sec" disabled={disabled || !state.transactions.length} onClick={() => void runAction("Preparing CSV…", async () => {
            downloadFile(`tally-transactions-${backupDate()}.csv`, exportCSV(state), "text/csv;charset=utf-8");
          }, "CSV download requested. This file contains unencrypted transaction data.")}><Download size={16} aria-hidden="true" /> Export unencrypted CSV</button>
        </div>
      </section>

      <section className="panel space-y-5 p-5 sm:p-6" aria-labelledby="protection-title">
        <div className="section-heading flex items-start gap-3"><ShieldCheck size={22} className="mt-1 shrink-0" aria-hidden="true" /><div><h3 id="protection-title" className="text-lg font-semibold">Local passphrase protection</h3><p className="muted mt-1 text-sm">{encrypted ? "Your saved ledger is encrypted with AES-256-GCM." : "Your ledger is stored unencrypted in this browser. Add a passphrase to protect it at rest."}</p></div></div>
        {encrypted ? <div className="space-y-3">
          <div className="form-actions flex flex-wrap gap-3">
            <button type="button" className="btn" disabled={disabled} onClick={() => void runAction("Saving and locking…", lock)}><LockKeyhole size={16} aria-hidden="true" /> Lock now</button>
            <button type="button" className="btn sec" disabled={disabled} onClick={() => { setError(""); setConfirmation("decrypt"); }}>Remove encryption</button>
          </div>
          <p className="muted text-xs">Tally locks when you reload or close this page. Existing encrypted backups keep their original passphrase.</p>
        </div> : <form onSubmit={protectData} className="space-y-4">
          <div className="field-grid grid gap-4 sm:grid-cols-2">
            <label className="ledger-field">New passphrase<input className="ledger-input" type="password" autoComplete="new-password" minLength={8} required disabled={disabled} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} aria-describedby="passphrase-help" /></label>
            <label className="ledger-field">Confirm passphrase<input className="ledger-input" type="password" autoComplete="new-password" minLength={8} required disabled={disabled} value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} /></label>
          </div>
          <p id="passphrase-help" className="muted text-sm">Use at least 8 characters. There is no recovery service: losing your passphrase means losing access to encrypted data and backups.</p>
          <button type="submit" className="btn" disabled={disabled}><LockKeyhole size={16} aria-hidden="true" /> Enable encryption</button>
        </form>}
      </section>

      <section className="panel space-y-4 p-5 sm:p-6" aria-labelledby="currency-title">
        <div className="section-heading"><h3 id="currency-title" className="text-lg font-semibold">Display currency</h3><p className="muted mt-1 text-sm">Use one currency across all accounts. Changing this setting changes formatting only; it does not convert balances or transaction amounts.</p></div>
        <label className="ledger-field max-w-sm">Currency<select className="ledger-input" value={state.settings.currency} disabled={disabled} onChange={(event) => {
          const currency = event.target.value;
          void runAction("Saving currency…", () => saveMutation(() => setState((previous) => ({ ...previous, settings: { ...previous.settings, currency } }))), `Display currency saved as ${currency}. Amounts have not been converted.`);
        }}>
          {!CURRENCIES.some(([code]) => code === state.settings.currency) && <option value={state.settings.currency}>{state.settings.currency}</option>}
          {CURRENCIES.map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}
        </select></label>
      </section>

      <section className="panel space-y-4 p-5 sm:p-6" aria-labelledby="reset-title">
        <div className="section-heading"><h3 id="reset-title" className="text-lg font-semibold">Start fresh</h3><p className="muted mt-1 text-sm">These actions replace your current data. Download a JSON backup first if you want to keep it. Your current encryption protection stays in place.</p></div>
        <div className="form-actions flex flex-wrap gap-3">
          <button type="button" className="btn sec" disabled={disabled} onClick={() => { setError(""); setConfirmation("demo"); }}>Load demo data</button>
          <button type="button" className="btn sec danger" disabled={disabled} onClick={() => { setError(""); setConfirmation("reset"); }}>Reset all data</button>
        </div>
      </section>

      {restoreEnvelope && <Modal title="Unlock backup" onClose={closeRestore}>
        <form className="space-y-4" onSubmit={decryptBackup}>
          <p className="muted break-words text-sm">Enter the passphrase used when you created {restoreEnvelope.name}. You can review its contents before replacing anything.</p>
          <label className="ledger-field">Backup passphrase<input className="ledger-input" autoFocus type="password" autoComplete="current-password" required disabled={Boolean(busy)} value={restorePassphrase} onChange={(event) => setRestorePassphrase(event.target.value)} /></label>
          {error && <p className="notice error text-sm" role="alert">{error}</p>}
          {busy && <p className="muted text-sm" role="status">{busy}</p>}
          <div className="form-actions flex flex-wrap justify-end gap-3"><button type="button" className="btn sec" disabled={Boolean(busy)} onClick={closeRestore}>Cancel</button><button type="submit" className="btn" disabled={Boolean(busy)}>Unlock & review</button></div>
        </form>
      </Modal>}

      {preview && <Modal title="Review backup before restoring" onClose={closeRestore}>
        <div className="space-y-4">
          <p className="muted break-words text-sm">{preview.name}</p>
          <p className="text-sm">Replace your current {state.transactions.length} transactions and {state.accounts.length} accounts with this backup:</p>
          <ul className="list-inside list-disc space-y-1 text-sm"><li>{preview.state.transactions.length} transactions</li><li>{preview.state.accounts.length} accounts</li><li>{Object.keys(preview.state.budgets).length} budgets and {preview.state.rules.length} category rules</li><li>{preview.state.importPresets.length} bank import presets</li><li>Display currency: {preview.state.settings.currency}</li></ul>
          <p className="muted max-h-32 overflow-y-auto break-words text-sm">Accounts: {preview.state.accounts.map((account) => account.name).join(", ")}</p>
          <p className="notice text-sm">{encrypted ? "Restored data will be saved using your current local encryption and current passphrase. The backup’s passphrase does not replace it." : preview.wasEncrypted ? "This backup was encrypted. Restoring it here will save its decrypted data in your currently unencrypted local store. Enable local protection before restoring if you want it encrypted on this device." : "Restored data will be saved unencrypted, matching your current local protection setting."}</p>
          <p className="muted text-sm">This replaces transactions, accounts, rules, budgets, import presets, and settings. It does not merge them.</p>
          {error && <p className="notice error text-sm" role="alert">{error}</p>}
          {busy && <p className="muted text-sm" role="status">{busy}</p>}
          <div className="form-actions flex flex-wrap justify-end gap-3"><button type="button" className="btn sec" disabled={Boolean(busy)} onClick={closeRestore}>Cancel</button><button type="button" className="btn danger" disabled={Boolean(busy)} onClick={() => {
            const replacement = preview.state;
            void runAction("Restoring backup…", async () => { await saveMutation(() => setState(replacement)); if (mounted.current) setPreview(null); }, "Backup restored and saved. Your local protection setting has been preserved.");
          }}>Replace data & restore</button></div>
        </div>
      </Modal>}

      {confirmation && <Modal title={confirmation === "decrypt" ? "Remove local encryption?" : confirmation === "demo" ? "Replace your ledger with demo data?" : "Reset all local data?"} onClose={() => { if (!running.current) { setConfirmation(null); setError(""); } }}>
        <div className="space-y-4">
          <p className="text-sm">{confirmation === "decrypt" ? "Your saved financial data and future JSON backups will be unencrypted. Existing encrypted backups will still need their original passphrase." : confirmation === "demo" ? `This replaces ${state.transactions.length} transactions, ${state.accounts.length} accounts, your budgets, category rules, import presets, and income plan with example data. Your currency and theme are kept.` : `This removes ${state.transactions.length} transactions, ${state.accounts.length} accounts, all custom rules, budgets, import presets, and settings. A new empty main account will be created.`}</p>
          {confirmation !== "decrypt" && <p className="notice text-sm">Save a JSON backup before continuing. You can only recover replaced data from a backup. Your current encryption protection will be preserved.</p>}
          {error && <p className="notice error text-sm" role="alert">{error}</p>}
          {busy && <p className="muted text-sm" role="status">{busy}</p>}
          <div className="form-actions flex flex-wrap justify-end gap-3"><button type="button" className="btn sec" disabled={Boolean(busy)} onClick={() => { setConfirmation(null); setError(""); }}>Cancel</button><button type="button" className="btn danger" disabled={Boolean(busy)} onClick={confirmAction}>{confirmation === "decrypt" ? "Remove encryption" : confirmation === "demo" ? "Replace with demo data" : "Reset all data"}</button></div>
        </div>
      </Modal>}
    </div>
  );
}
