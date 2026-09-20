import { ArrowDownToLine, CirclePlus } from "lucide-react";
export interface EmptyStateProps { onImport: () => void; onAdd: () => void; onDemo: () => void }
export function EmptyState({ onImport, onAdd, onDemo }: EmptyStateProps) {
  return <section className="empty-ledger" aria-labelledby="empty-ledger-title">
    <h2 id="empty-ledger-title">Add your first transaction</h2>
    <p>Import a statement from your bank or enter a transaction manually.</p>
    <div className="empty-ledger-actions"><button type="button" className="btn" onClick={onImport}><ArrowDownToLine size={16} aria-hidden="true" />Import bank CSV</button><button type="button" className="btn sec" onClick={onAdd}><CirclePlus size={16} aria-hidden="true" />Add manually</button></div>
    <button type="button" className="text-button" onClick={onDemo}>Explore with demo data</button>
  </section>;
}
