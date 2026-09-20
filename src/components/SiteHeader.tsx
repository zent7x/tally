import { ArrowUpRight, Code, Moon, Sun } from "lucide-react";
import { appHref, homeHref } from "../lib/paths";
import logoUrl from "../assets/logo/tally-icon.svg";

type Theme = "light" | "dark";
export interface SiteHeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  variant: "landing" | "app";
}

export function SiteHeader({ theme, onToggleTheme, variant }: SiteHeaderProps) {
  return <header className={`top top-${variant}`}>
    <div className="top-shell">
      <a href={homeHref()} className="brand" aria-label="Tally home">
        <img src={logoUrl} alt="" width={28} height={28} className="mark" />
        <span className="logo-word">Tally</span>
      </a>
      {variant === "landing" && <nav className="site-navigation" aria-label="Website"><a href="#features">Features</a><a href="#privacy">Privacy</a></nav>}
      <div className="top-actions">
        <a className="ghost icon" href="https://github.com/zent7x/tally" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="GitHub repository"><Code size={18} aria-hidden="true" /></a>
        <button className="ghost icon" type="button" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
        {variant === "landing" ? <a className="btn top-cta" href={appHref()}>Open app <ArrowUpRight size={15} aria-hidden="true" /></a> : <a className="ghost home-link" href={homeHref()}>Home</a>}
      </div>
    </div>
  </header>;
}
