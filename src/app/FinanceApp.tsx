import { useCallback, useEffect, useRef, useState } from "react";
import { AppActionPanel } from "@/components/AppActionPanel";
import { PageBackground } from "@/components/PageBackground";
import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState } from "@/app/components/EmptyState";
import { LockScreen } from "@/app/components/LockScreen";
import { FinanceProvider, useFinance } from "@/app/hooks/useFinanceStore";
import { useTheme } from "@/app/hooks/useTheme";
import { BudgetsView } from "@/app/views/BudgetsView";
import { CategoriesView } from "@/app/views/CategoriesView";
import { ForecastView } from "@/app/views/ForecastView";
import { OverviewView } from "@/app/views/OverviewView";
import { SubscriptionsView } from "@/app/views/SubscriptionsView";
import { TransactionsView } from "@/app/views/TransactionsView";
import type { AppTab, DeepLinkAction } from "@/lib/finance/types";

const TABS: { id: AppTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "categories", label: "Categories" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "budgets", label: "Budgets" },
  { id: "forecast", label: "Forecast" },
];

function parseDeepLinkAction(): DeepLinkAction | null {
  try {
    const action = new URLSearchParams(window.location.search).get("action");
    if (action === "demo" || action === "import" || action === "add") return action;
  } catch {
    /* ignore */
  }
  return null;
}

/** Survives React Strict Mode remounts. */
let bootDeepLink: DeepLinkAction | null | undefined;

function takeBootDeepLink(): DeepLinkAction | null {
  if (bootDeepLink === undefined) {
    try {
      const fromSession = sessionStorage.getItem("tally.boot.action");
      if (fromSession === "demo" || fromSession === "import" || fromSession === "add") {
        sessionStorage.removeItem("tally.boot.action");
        bootDeepLink = fromSession;
      } else {
        bootDeepLink = parseDeepLinkAction();
      }
    } catch {
      bootDeepLink = parseDeepLinkAction();
    }
  }
  const action = bootDeepLink;
  bootDeepLink = null;
  return action;
}

function stripDeepLinkQuery() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("action")) return;
    url.searchParams.delete("action");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}` || url.pathname);
  } catch {
    /* ignore */
  }
}

function FinanceAppInner() {
  const { theme, toggleTheme } = useTheme();
  const {
    lockedEnvelope,
    hasTransactions,
    loadDemo,
    addTransaction,
    importTransactions,
    unlock,
    eraseEncrypted,
  } = useFinance();

  const [tab, setTab] = useState<AppTab>("overview");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bootRan = useRef(false);

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDemo = useCallback(() => {
    if (hasTransactions && !window.confirm("Replace current data with demo data?")) return;
    loadDemo();
    setTab("overview");
  }, [hasTransactions, loadDemo]);

  const handleAdd = useCallback(() => {
    addTransaction();
    setTab("transactions");
  }, [addTransaction]);

  useEffect(() => {
    if (lockedEnvelope || bootRan.current) return;
    const action = takeBootDeepLink();
    stripDeepLinkQuery();
    if (!action) return;
    bootRan.current = true;
    if (action === "demo") {
      loadDemo();
      setTab("overview");
    } else if (action === "import") {
      triggerImport();
    } else if (action === "add") {
      addTransaction();
      setTab("transactions");
    }
  }, [lockedEnvelope, loadDemo, triggerImport, addTransaction]);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const count = importTransactions(text);
    if (count > 0) setTab("transactions");
  };

  if (lockedEnvelope) {
    return (
      <PageBackground>
        <LockScreen envelope={lockedEnvelope} onUnlock={unlock} onErase={eraseEncrypted} />
      </PageBackground>
    );
  }

  return (
    <PageBackground>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} variant="app" />

      <div className="app-frame">
        {hasTransactions ? (
          <nav className="app-tabs anim-1" aria-label="App sections">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`app-tab${tab === item.id ? " is-active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}

        <main className="app-main anim-2">
          {!hasTransactions ? (
            <EmptyState onImport={triggerImport} onAdd={handleAdd} onDemo={handleDemo} />
          ) : (
            <>
              {tab === "overview" && <OverviewView />}
              {tab === "transactions" && <TransactionsView />}
              {tab === "categories" && <CategoriesView />}
              {tab === "subscriptions" && <SubscriptionsView />}
              {tab === "budgets" && <BudgetsView />}
              {tab === "forecast" && <ForecastView />}
            </>
          )}
        </main>
      </div>

      {hasTransactions ? (
        <div className="app-fab">
          <AppActionPanel onImport={triggerImport} onAdd={handleAdd} onDemo={handleDemo} />
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden
        onChange={(e) => void onFileChange(e)}
      />
    </PageBackground>
  );
}

export default function FinanceApp() {
  return (
    <FinanceProvider>
      <FinanceAppInner />
    </FinanceProvider>
  );
}
