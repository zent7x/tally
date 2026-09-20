import { useEffect, useState } from "react";
import { ArrowRight, Check, CloudOff, FileSpreadsheet, Landmark, SlidersHorizontal } from "lucide-react";
import { FaqAccordion } from "./components/FaqAccordion";
import { PageBackground } from "./components/PageBackground";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { appHref } from "./lib/paths";

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("tally.v1.theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch { /* Browser storage may be unavailable. */ }
  return "light";
}

function LedgerPreview() {
  return <figure className="ledger-preview" aria-label="Illustrative sample ledger, not your financial data">
    <div className="preview-topline"><span className="eyebrow">THE BIG PICTURE</span><span className="sample-label">Sample ledger</span></div>
    <div className="preview-balance"><span>Net worth</span><strong>$24,850<span>.00</span></strong><p><span className="preview-dot" /> Three accounts. One clear view.</p></div>
    <div className="preview-accounts">
      <div><span>Everyday</span><strong>$4,250</strong></div><div><span>Savings</span><strong>$22,000</strong></div><div><span>Credit card</span><strong>−$1,400</strong></div>
    </div>
    <div className="preview-ledger-title"><span>Recent transactions</span><span>SEPTEMBER</span></div>
    <div className="preview-row"><span className="preview-icon"><Landmark size={16} /></span><div><strong>Client payment</strong><span>Freelance · Everyday</span></div><strong className="preview-positive">+$2,400.00</strong></div>
    <div className="preview-row"><span className="preview-icon"><FileSpreadsheet size={16} /></span><div><strong>Neighborhood market</strong><span>Groceries · Everyday</span></div><strong>−$68.40</strong></div>
    <div className="preview-row"><span className="preview-icon"><SlidersHorizontal size={16} /></span><div><strong>Studio membership</strong><span>Subscriptions · Credit card</span></div><strong>−$24.00</strong></div>
    <figcaption><CloudOff size={13} aria-hidden="true" /> Every number stays on your device.</figcaption>
  </figure>;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("tally.v1.theme", theme); } catch { /* Optional preference. */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#151d19" : "#f6f4ec");
  }, [theme]);

  return <PageBackground>
    <a href="#main" className="skip-link">Skip to content</a>
    <SiteHeader theme={theme} onToggleTheme={() => setTheme((value) => value === "dark" ? "light" : "dark")} variant="landing" />
    <main id="main" className="landing-hero" tabIndex={-1}>
      <section className="hero-grid" aria-labelledby="hero-title">
        <div className="landing-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> PERSONAL FINANCE, PERSONALLY YOURS</p>
          <h1 id="hero-title">A little clarity.<br />A lot more<br /><em>peace of mind.</em></h1>
          <p className="hero-description">Your money, on your machine. A thoughtful place to bring your accounts together, understand your spending, and find your own rhythm.</p>
          <div className="hero-cta-row"><a className="btn hero-cta-primary" href={appHref()}>Open your ledger <ArrowRight size={17} aria-hidden="true" /></a><a className="hero-demo-link" href={appHref("demo")}>Explore a demo <ArrowRight size={15} aria-hidden="true" /></a></div>
          <p className="hero-promise"><Check size={14} aria-hidden="true" /> No sign-up. No bank login. No cloud.</p>
        </div>
        <LedgerPreview />
      </section>
      <section className="feature-strip" aria-label="Made for your everyday money">
        <article><span className="feature-number">01 / BRING IT TOGETHER</span><FileSpreadsheet size={23} aria-hidden="true" /><h2>Your bank. Your layout.</h2><p>Import a statement, map its columns, and save a preset. Your next import feels familiar.</p><a href={appHref("import")}>Import a CSV <ArrowRight size={14} aria-hidden="true" /></a></article>
        <article><span className="feature-number">02 / SEE THE WHOLE PICTURE</span><Landmark size={23} aria-hidden="true" /><h2>More than one balance.</h2><p>Keep everyday accounts, savings, and debts in view. See what you own and what you owe.</p><a href={appHref("demo")}>Explore your accounts <ArrowRight size={14} aria-hidden="true" /></a></article>
        <article><span className="feature-number">03 / FIND YOUR RHYTHM</span><SlidersHorizontal size={23} aria-hidden="true" /><h2>Uneven income. A plan.</h2><p>Turn your income history into a monthly planning guide, with room for quieter months.</p><a href={appHref("demo")}>Try an income plan <ArrowRight size={14} aria-hidden="true" /></a></article>
      </section>
      <section className="privacy-section" aria-labelledby="privacy-title"><div><p className="eyebrow">A SMALL PROMISE. A FIRM ONE.</p><h2 id="privacy-title">Your finances are<br /><em>your business.</em></h2><p>Tally calculates and saves everything in your browser. Add a passphrase for local encryption, and export your data whenever you like. You stay in control.</p><div className="privacy-facts"><span><Check size={15} /> AES-256-GCM encryption</span><span><Check size={15} /> CSV &amp; JSON export</span><span><Check size={15} /> Open source, always</span></div></div><div className="faq-section"><FaqAccordion /></div></section>
      <SiteFooter />
    </main>
  </PageBackground>;
}
