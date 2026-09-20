import { ArrowDownToLine, ArrowRight, CirclePlus, FileSpreadsheet, ShieldCheck } from "lucide-react";

export interface EmptyStateProps {
  onImport: () => void;
  onAdd: () => void;
  onDemo: () => void;
}

export function EmptyState({ onImport, onAdd, onDemo }: EmptyStateProps) {
  return <section className="empty-ledger glass-panel" aria-labelledby="empty-ledger-title">
    <div className="empty-ledger-icon"><FileSpreadsheet size={30} strokeWidth={1.4} aria-hidden="true" /></div>
    <p className="eyebrow">A FRESH PAGE</p>
    <h2 id="empty-ledger-title">Make yourself at home.</h2>
    <p>Your ledger is ready for its first entry. Bring a bank statement or add a transaction, and start making sense of your money.</p>
    <div className="empty-ledger-actions"><button type="button" className="btn" onClick={onImport}><ArrowDownToLine size={16} aria-hidden="true" />Import bank CSV</button><button type="button" className="btn sec" onClick={onAdd}><CirclePlus size={16} aria-hidden="true" />Add manually</button></div>
    <button type="button" className="text-button" onClick={onDemo}>Have a look around with demo data <ArrowRight size={15} aria-hidden="true" /></button>
    <p className="empty-ledger-note"><ShieldCheck size={14} aria-hidden="true" /> Stored on this device. Always yours.</p>
  </section>;
}
