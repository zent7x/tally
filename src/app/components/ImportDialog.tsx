import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { useFinance } from "@/app/hooks/useFinanceStore";
import { inspectCSV, matchingPreset, matchingPresets, previewCSV } from "@/lib/finance/csv";
import type { ImportMapping, ImportPreset } from "@/lib/finance/types";
import { uid } from "@/lib/finance/types";
import { Modal } from "./Modal";

type InspectedCSV = ReturnType<typeof inspectCSV>;
type ColumnField = "date" | "description" | "amount" | "debit" | "credit";

export function ImportDialog({ onClose, onImported }: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const { state, setState } = useFinance();
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [inspected, setInspected] = useState<InspectedCSV | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [amountMode, setAmountMode] = useState<"signed" | "separate">("signed");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [presetId, setPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [needsPresetChoice, setNeedsPresetChoice] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const hasImported = useRef(false);

  useEffect(() => () => { readVersion.current++; }, []);

  const effectiveMapping = useMemo(() => mapping ? {
    ...mapping,
    ...(amountMode === "signed" ? { debit: -1, credit: -1 } : { amount: -1 }),
  } : null, [mapping, amountMode]);
  const compatiblePresets = useMemo(() => inspected
    ? matchingPresets(inspected.headers, state.importPresets)
    : [], [inspected, state.importPresets]);
  const preview = useMemo(() => effectiveMapping && inspected
    ? previewCSV(text, state.rules, effectiveMapping, accountId || undefined)
    : null, [text, effectiveMapping, inspected, state.rules, accountId]);
  const mappingValid = !!(inspected && effectiveMapping && matchingPreset(inspected.headers, [{
    id: "validation", name: "validation", headers: inspected.headers, mapping: effectiveMapping,
  }]));
  const accountValid = state.accounts.some((account) => account.id === accountId);
  const selectedPreset = compatiblePresets.find((preset) => preset.id === presetId);

  function applyPreset(preset: ImportPreset) {
    setNeedsPresetChoice(false);
    setMapping({ ...preset.mapping });
    setAmountMode(preset.mapping.amount >= 0 ? "signed" : "separate");
    setPresetId(preset.id);
    setPresetName(preset.name);
    setStatus(`Applied ${preset.name}. Review the preview before importing.`);
    setError("");
  }

  async function readFile(file: File) {
    const version = ++readVersion.current;
    setReading(true);
    setFileName(file.name);
    setText("");
    setInspected(null);
    setMapping(null);
    setPresetId("");
    setPresetName("");
    setNeedsPresetChoice(false);
    setStatus("");
    setError("");
    try {
      const contents = await file.text();
      if (version !== readVersion.current) return;
      const data = inspectCSV(contents);
      if (!data.headers.length) throw new Error("This file is empty. Choose a CSV with a header row and transactions.");
      if (!data.rows.length) throw new Error("This file has a header but no transaction rows.");
      setText(contents);
      setInspected(data);
      const matches = matchingPresets(data.headers, state.importPresets);
      if (matches.length === 1) applyPreset(matches[0]!);
      else {
        setMapping(data.mapping);
        setAmountMode(data.mapping.amount < 0 && (data.mapping.debit >= 0 || data.mapping.credit >= 0) ? "separate" : "signed");
        setNeedsPresetChoice(matches.length > 1);
        setStatus(matches.length > 1
          ? "Several bank presets match these columns. Choose your bank preset or manual column mapping, then review the dates and signs in the preview."
          : "Columns detected. Check the date order, amount signs, and preview below.");
      }
    } catch (cause) {
      if (version === readVersion.current) setError(cause instanceof Error ? cause.message : "This file could not be read. Choose it again or export a new CSV.");
    } finally {
      if (version === readVersion.current) setReading(false);
    }
  }

  function updateMapping<K extends keyof ImportMapping>(field: K, value: ImportMapping[K]) {
    setNeedsPresetChoice(false);
    setMapping((previous) => previous ? { ...previous, [field]: value } : null);
    setStatus("");
    setError("");
  }

  function savePreset(update: boolean) {
    if (needsPresetChoice) { setError("Choose a bank preset or manual column mapping first."); return; }
    const name = presetName.trim();
    if (!name) { setError("Give this bank preset a name before saving."); return; }
    if (!inspected || !effectiveMapping || !mappingValid) { setError("Choose valid, distinct columns before saving this preset."); return; }
    if (update && !selectedPreset) { setError("Choose a saved preset to update."); return; }
    if (state.importPresets.some((preset) => preset.name.toLowerCase() === name.toLowerCase() && (!update || preset.id !== presetId))) {
      setError("A preset with this name already exists. Choose it to update, or use a different name.");
      return;
    }
    const preset: ImportPreset = { id: update ? presetId : uid(), name, headers: [...inspected.headers], mapping: { ...effectiveMapping } };
    setState((previous) => ({ ...previous, importPresets: update
      ? previous.importPresets.map((item) => item.id === preset.id ? preset : item)
      : [...previous.importPresets, preset] }));
    setPresetId(preset.id);
    setPresetName(name);
    setError("");
    setStatus(`${name} ${update ? "updated" : "saved"}. Use this preset with matching CSV column layouts.`);
  }

  function deletePreset() {
    if (!selectedPreset) return;
    setState((previous) => ({ ...previous, importPresets: previous.importPresets.filter((preset) => preset.id !== presetId) }));
    setStatus(`${selectedPreset.name} deleted. Your current column choices are still available below.`);
    setPresetId("");
    setPresetName("");
    setError("");
  }

  function confirmImport() {
    if (hasImported.current || reading || needsPresetChoice || !mappingValid || !accountValid || !preview?.transactions.length) return;
    hasImported.current = true;
    setImporting(true);
    setState((previous) => ({ ...previous, transactions: [...previous.transactions, ...preview.transactions] }));
    onImported(preview.transactions.length);
    onClose();
  }

  function columnSelect(field: ColumnField, label: string, optional = false) {
    return <label className="ledger-field">
      <span>{label}{optional ? " (optional)" : ""}</span>
      <select className="ledger-input" value={mapping?.[field] ?? -1} onChange={(event) => updateMapping(field, Number(event.target.value))}>
        <option value={-1}>{optional ? "Not in this file" : "Choose a column"}</option>
        {inspected?.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header || "Unnamed column"}</option>)}
      </select>
    </label>;
  }

  return <Modal title="Import transactions" onClose={onClose} wide>
    <div className="space-y-5 import-dialog">
      <p className="muted">Bring a CSV from your bank. Your file stays on this device.</p>
      <div className={`panel import-dropzone${dragging ? " is-dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length !== 1) { setError("Choose one CSV file at a time."); return; }
          const file = event.dataTransfer.files[0];
          if (file) void readFile(file);
        }}>
        <FileUp aria-hidden="true" size={28} />
        <p>{fileName || "Drop a bank CSV here"}</p>
        <button className="btn sec" type="button" onClick={() => fileInput.current?.click()} disabled={importing}>
          <Upload size={16} aria-hidden="true" /> {fileName ? "Choose another file" : "Choose CSV file"}
        </button>
        <input ref={fileInput} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="sr-only" tabIndex={-1} aria-label="Bank CSV file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readFile(file);
          }} />
        <p className="muted">CSV or TSV with a header row. Comma, semicolon, and tab separators are supported.</p>
      </div>
      {reading && <p role="status" className="notice">Reading {fileName}…</p>}
      {error && <p role="alert" className="notice notice-error">{error}</p>}
      {status && <p role="status" className="notice">{status}</p>}
      {inspected && mapping && <>
        <section className="space-y-3" aria-labelledby="import-mapping-heading">
          <div className="section-heading"><h3 id="import-mapping-heading">Match your columns</h3><span className="muted">{inspected.rows.length} rows found</span></div>
          <div className="field-grid">
            <label className="ledger-field"><span>Bank preset</span>
              <select className="ledger-input" value={needsPresetChoice ? "__choose__" : presetId} onChange={(event) => {
                setNeedsPresetChoice(false);
                const preset = compatiblePresets.find((item) => item.id === event.target.value);
                if (preset) applyPreset(preset);
                else { setPresetId(""); setPresetName(""); setStatus(""); }
              }}>
                {needsPresetChoice && <option value="__choose__" disabled>Choose a bank preset or manual mapping</option>}
                <option value="">Manual column mapping</option>
                {compatiblePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </label>
            <label className="ledger-field"><span>Import into account</span>
              <select className="ledger-input" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {!accountValid && <option value="">Choose an account</option>}
                {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            {columnSelect("date", "Date column")}
            {columnSelect("description", "Description column")}
            <label className="ledger-field"><span>Amount layout</span>
              <select className="ledger-input" value={amountMode} onChange={(event) => { setNeedsPresetChoice(false); setAmountMode(event.target.value as "signed" | "separate"); setStatus(""); setError(""); }}>
                <option value="signed">One signed amount column</option>
                <option value="separate">Separate debit / credit columns</option>
              </select>
            </label>
            <label className="ledger-field"><span>Date order</span>
              <select className="ledger-input" value={mapping.dateFormat} onChange={(event) => updateMapping("dateFormat", event.target.value as ImportMapping["dateFormat"])}>
                <option value="auto">Automatic (ambiguous dates use month first)</option>
                <option value="mdy">Month / day / year</option>
                <option value="dmy">Day / month / year</option>
                <option value="ymd">Year / month / day</option>
              </select>
            </label>
            {amountMode === "signed" ? columnSelect("amount", "Amount column") : <>
              {columnSelect("debit", "Debit / money out", true)}
              {columnSelect("credit", "Credit / money in", true)}
            </>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mapping.invertAmounts} onChange={(event) => updateMapping("invertAmounts", event.target.checked)} />Reverse amount signs</label>
          <p className="muted">Expenses should be negative and income positive. {amountMode === "separate" && "Choose at least one debit or credit column. "}Only presets matching this file’s complete column layout are shown.</p>
          <div className="panel space-y-3 p-4">
            <label className="ledger-field"><span>Remember this bank layout</span><input className="ledger-input" value={presetName} maxLength={80} placeholder="e.g. Everyday checking" onChange={(event) => setPresetName(event.target.value)} /></label>
            <div className="form-actions">
              <button type="button" className="btn sec" disabled={needsPresetChoice || !mappingValid || !presetName.trim()} onClick={() => savePreset(false)}>Save new preset</button>
              {selectedPreset && <><button type="button" className="btn sec" disabled={!mappingValid || !presetName.trim()} onClick={() => savePreset(true)}>Update preset</button>
                <button type="button" className="btn sec" onClick={deletePreset}>Delete preset</button></>}
            </div>
          </div>
        </section>
        <section className="space-y-3" aria-labelledby="import-preview-heading">
          <div className="section-heading"><h3 id="import-preview-heading">Preview</h3><span className="muted" aria-live="polite">{preview?.transactions.length ?? 0} ready · {preview?.skipped ?? 0} skipped</span></div>
          {!!preview?.errors.length && <div className="notice notice-error" role="status"><p>{mappingValid ? "Review skipped rows before importing. Only valid rows will be added." : "Complete the column mapping to continue."}</p><ul className="list-disc pl-5">{preview.errors.map((message, index) => <li key={index}>{message}</li>)}</ul></div>}
          {!!preview?.transactions.length && <div className="panel overflow-x-auto"><table className="w-full text-sm">
            <caption className="sr-only">First {Math.min(preview.transactions.length, 5)} valid transactions</caption>
            <thead><tr><th scope="col" className="p-3 text-left">Date</th><th scope="col" className="p-3 text-left">Description</th><th scope="col" className="p-3 text-left">Category</th><th scope="col" className="p-3 text-right">Amount</th></tr></thead>
            <tbody>{preview.transactions.slice(0, 5).map((transaction, index) => <tr key={index}><td className="p-3 whitespace-nowrap">{transaction.date}</td><td className="p-3">{transaction.desc}</td><td className="p-3">{transaction.category}</td><td className="p-3 text-right whitespace-nowrap tabular-nums">{new Intl.NumberFormat(undefined, { style: "currency", currency: state.settings.currency }).format(transaction.amount)}</td></tr>)}</tbody>
          </table></div>}
          {preview && !preview.transactions.length && <p className="muted">No valid transactions to import. Check your file and column choices.</p>}
          {!accountValid && <p className="notice notice-error">Choose an account before importing. You can create accounts in the Accounts view.</p>}
          <p className="muted">Imported transactions are added to your existing ledger. Importing the same file again will add duplicate transactions.</p>
        </section>
      </>}
      <div className="form-actions">
        <button type="button" className="btn sec" onClick={onClose}>Cancel</button>
        <button type="button" className="btn" disabled={reading || importing || needsPresetChoice || !mappingValid || !accountValid || !preview?.transactions.length} onClick={confirmImport}>
          {importing ? "Importing…" : `Import${preview?.transactions.length ? ` ${preview.transactions.length}` : ""} transactions`}
        </button>
      </div>
    </div>
  </Modal>;
}
