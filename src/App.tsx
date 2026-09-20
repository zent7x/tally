import { ArrowRight, Check, FileSpreadsheet, Landmark, SlidersHorizontal } from "lucide-react";
import { FaqAccordion } from "./components/FaqAccordion";
import { PageBackground } from "./components/PageBackground";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { TallyCalculator } from "./components/TallyCalculator";
import { useTheme } from "./app/hooks/useTheme";
import { appHref } from "./lib/paths";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  return <PageBackground>
    <a href="#main" className="skip-link">Skip to content</a>
    <SiteHeader theme={theme} onToggleTheme={toggleTheme} variant="landing" />
    <main id="main" className="landing-main" tabIndex={-1}>
      <section className="landing-intro" aria-labelledby="hero-title">
        <div className="landing-copy">
          <h1 id="hero-title">Your accounts.<br />Stored locally.</h1>
          <p>Import your bank statements, track spending, and plan for uneven income. Everything stays in your browser.</p>
          <div className="hero-actions"><a className="btn" href={appHref()}>Open your ledger <ArrowRight size={17} aria-hidden="true" /></a><a className="btn sec" href={appHref("demo")}>Try the demo</a></div>
          <ul className="product-facts"><li><Check size={16} aria-hidden="true" />No account required</li><li><Check size={16} aria-hidden="true" />Free and open source</li></ul>
        </div>
        <TallyCalculator />
      </section>
      <section id="features" className="feature-list" aria-label="Features">
        <article><FileSpreadsheet size={20} aria-hidden="true" /><div><h2>Import once. Reuse your layout.</h2><p>Match your CSV columns, check the preview, and save a preset for your bank.</p><a href={appHref("import")}>Import a statement <ArrowRight size={14} aria-hidden="true" /></a></div></article>
        <article><Landmark size={20} aria-hidden="true" /><div><h2>See every account.</h2><p>Keep cash, savings, investments, and debts together with a clear net-worth total.</p><a href={appHref("demo")}>View demo accounts <ArrowRight size={14} aria-hidden="true" /></a></div></article>
        <article><SlidersHorizontal size={20} aria-hidden="true" /><div><h2>Plan around your income.</h2><p>Use your completed months to set a monthly draw and estimate a reserve.</p><a href={appHref("demo")}>Explore income planning <ArrowRight size={14} aria-hidden="true" /></a></div></article>
      </section>
      <section id="privacy" className="privacy-section" aria-labelledby="privacy-title">
        <div><h2 id="privacy-title">Your data stays yours.</h2><p>No bank login, cloud account, or tracking. Add local encryption and export a backup whenever you need one.</p><a href="https://github.com/zent7x/tally" target="_blank" rel="noopener noreferrer">Read the source ↗</a></div>
        <FaqAccordion />
      </section>
      <SiteFooter />
    </main>
  </PageBackground>;
}
