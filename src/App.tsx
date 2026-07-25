import { useEffect, useState } from "react";
import { LandingDock } from "./components/LandingDock";
import { FaqAccordion } from "./components/FaqAccordion";
import { HowItWorks } from "./components/HowItWorks";
import { PageBackground } from "./components/PageBackground";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { AnimeReveal } from "./lib/anime";
import { appHref } from "./lib/paths";
import logoUrl from "./assets/logo/tally-icon.svg";

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("tally.v1.theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("tally.v1.theme", theme);
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0d0f11" : "#f7f7f3");
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <PageBackground>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} variant="landing" />

      <main className="landing-hero">
        <div className="landing-copy">
          <AnimeReveal staggerMs={90} y={18} duration={760}>
            <div className="brand-hero" data-anime>
              <img src={logoUrl} alt="" className="hero-mark" width={56} height={56} />
              Tally
            </div>
            <h1 data-anime>Your money, on your machine.</h1>
            <p data-anime>
              A personal finance tracker that runs entirely on your device. No account. No bank
              login. No cloud. Import a statement and everything is computed right here — in this
              browser, or on any static host you upload.
            </p>

            <div className="hero-cta-row" data-anime>
              <a className="btn hero-cta-primary" href={appHref()}>
                Open app
              </a>
              <a className="btn sec hero-cta-secondary" href={appHref("demo")}>
                Try demo data
              </a>
            </div>
          </AnimeReveal>

          <LandingDock />
        </div>

        <HowItWorks />

        <section className="faq-section anim-3" aria-label="Frequently asked questions">
          <FaqAccordion />
        </section>

        <SiteFooter />
      </main>
    </PageBackground>
  );
}
