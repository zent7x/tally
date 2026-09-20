import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CirclePlus, LockKeyhole, ShieldCheck } from "lucide-react";
import { PageBackground } from "@/components/PageBackground";
import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState } from "@/app/components/EmptyState";
import { LockScreen } from "@/app/components/LockScreen";
import { ImportDialog } from "@/app/components/ImportDialog";
import { TransactionDialog } from "@/app/components/TransactionDialog";
import { FinanceProvider, useFinance } from "@/app/hooks/useFinanceStore";
import { useTheme } from "@/app/hooks/useTheme";
import { BudgetsView } from "@/app/views/BudgetsView";
import { CategoriesView } from "@/app/views/CategoriesView";
import { ForecastView } from "@/app/views/ForecastView";
import { OverviewView } from "@/app/views/OverviewView";
import { SubscriptionsView } from "@/app/views/SubscriptionsView";
import { TransactionsView } from "@/app/views/TransactionsView";
import { AccountsView } from "@/app/views/AccountsView";
import { IncomeView } from "@/app/views/IncomeView";
import { DataView } from "@/app/views/DataView";
import type { AppTab, DeepLinkAction } from "@/lib/finance/types";

const TABS: { id: AppTab; label: string; description: string }[] = [
  { id: "overview", label: "Overview", description: "A little clarity for your everyday money." },
  { id: "transactions", label: "Transactions", description: "Every little detail, all in one place." },
  { id: "accounts", label: "Accounts", description: "The whole picture. Assets, debts, and what’s yours." },
  { id: "income", label: "Income plan", description: "Uneven income. A steadier month." },
  { id: "forecast", label: "Forecast", description: "Look ahead, with room to change the plan." },
  { id: "categories", label: "Categories", description: "See where your money finds its way." },
  { id: "subscriptions", label: "Recurring", description: "Small payments can add up to a big picture." },
  { id: "budgets", label: "Budgets", description: "Make a little room for what matters." },
  { id: "data", label: "Data & privacy", description: "Your ledger is yours to keep, move, and protect." },
];

function bootAction(): DeepLinkAction | null {
  try {
    const url = new URL(window.location.href);
    const action = sessionStorage.getItem("tally.boot.action") || url.searchParams.get("action");
    sessionStorage.removeItem("tally.boot.action");
    url.searchParams.delete("action");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return action === "demo" || action === "import" || action === "add" ? action : null;
  } catch { return null; }
}

function FinanceAppInner() {
  const { theme, toggleTheme } = useTheme();
  const { state, lockedEnvelope, hasTransactions, loadDemo, unlock, eraseEncrypted, encrypted, lock, saving, storageError } = useFinance();
  const [tab, setTab] = useState<AppTab>("overview");
  const [modal, setModal] = useState<"import" | "add" | null>(null);
  const [notice, setNotice] = useState("");
  const bootRan = useRef(false);
  const active = TABS.find((item) => item.id === tab)!;
  const hasLedger = hasTransactions || state.accounts.length > 1 || state.accounts.some((account) => account.balance !== null);

  const handleDemo = useCallback(() => {
    if (hasLedger && !window.confirm("Replace your ledger, accounts, budgets, and import presets with demo data? Export a backup first if you want to keep them.")) return;
    loadDemo();
    setTab("overview");
    setNotice("Demo ledger loaded. Explore freely — everything stays on this device.");
  }, [hasLedger, loadDemo]);

  useEffect(() => {
    if (lockedEnvelope || bootRan.current) return;
    bootRan.current = true;
    const action = bootAction();
    if (action === "demo") handleDemo();
    else if (action === "import" || action === "add") setModal(action);
  }, [lockedEnvelope, handleDemo]);

  if (lockedEnvelope) {
    return <PageBackground>{storageError && <p className="notice notice-error m-5" role="alert">{storageError}</p>}<LockScreen envelope={lockedEnvelope} onUnlock={unlock} onErase={eraseEncrypted} /></PageBackground>;
  }

  return <PageBackground>
    <a href="#ledger-main" className="skip-link">Skip to ledger</a>
    <SiteHeader theme={theme} onToggleTheme={toggleTheme} variant="app" />
    <div className="app-frame">
      <div className="workspace-heading">
        <div><p className="eyebrow">YOUR PRIVATE LEDGER</p><h1>{active.label}</h1><p>{active.description}</p></div>
        <div className="ledger-actions">
          {encrypted && <button type="button" className="btn sec" onClick={() => { void lock().catch(() => {}); }} disabled={saving}><LockKeyhole size={16} />Lock</button>}
          <button type="button" className="btn sec" onClick={() => setModal("import")}><ArrowDownToLine size={16} />Import CSV</button>
          <button type="button" className="btn" onClick={() => setModal("add")}><CirclePlus size={16} />Add transaction</button>
        </div>
      </div>
      <nav className="app-tabs" aria-label="App sections">
        {TABS.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined}
          className={`app-tab${tab === item.id ? " is-active" : ""}`} onClick={() => { setTab(item.id); setNotice(""); }}>
          {item.label}
        </button>)}
      </nav>
      {storageError && <div className="notice notice-error" role="alert">{storageError}</div>}
      {notice && <div className="notice" role="status">{notice}<button type="button" className="ghost" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
      <main id="ledger-main" className="app-main" tabIndex={-1}>
        {tab === "overview" && (hasLedger ? <OverviewView /> : <EmptyState onImport={() => setModal("import")} onAdd={() => setModal("add")} onDemo={handleDemo} />)}
        {tab === "transactions" && <TransactionsView />}
        {tab === "accounts" && <AccountsView />}
        {tab === "income" && <IncomeView />}
        {tab === "forecast" && <ForecastView />}
        {tab === "categories" && <CategoriesView />}
        {tab === "subscriptions" && <SubscriptionsView />}
        {tab === "budgets" && <BudgetsView />}
        {tab === "data" && <DataView />}
      </main>
      <footer className="ledger-footer"><span><ShieldCheck size={14} />{encrypted ? "Encrypted on this device" : "Stored only on this device"}</span><span role="status">{saving ? "Saving…" : storageError ? "Save needs attention" : "All changes saved locally"}</span></footer>
    </div>
    {modal === "import" && <ImportDialog onClose={() => setModal(null)} onImported={(count: number) => {
      setModal(null); setTab("transactions"); setNotice(`${count} transaction${count === 1 ? "" : "s"} imported.`);
    }} />}
    {modal === "add" && <TransactionDialog onClose={() => setModal(null)} onSaved={() => { setModal(null); setTab("transactions"); }} />}
  </PageBackground>;
}

export default function FinanceApp() {
  return <FinanceProvider><FinanceAppInner /></FinanceProvider>;
}
