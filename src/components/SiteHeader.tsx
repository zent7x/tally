import { CloudOff, Moon, Shield, Sun } from "lucide-react";
import { AnimeReveal } from "../lib/anime";
import { appHref, homeHref } from "../lib/paths";
import logoUrl from "../assets/logo/tally-icon.svg";

type Theme = "light" | "dark";

const REPO = "https://github.com/zent7x/tally";

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export interface SiteHeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  /** Landing → Open app; App → Home */
  variant: "landing" | "app";
}

function BrandMark() {
  return (
    <AnimeReveal
      as="span"
      className="brand-anime"
      staggerMs={80}
      y={10}
      delayMs={40}
      duration={640}
    >
      <span className="logo" data-anime>
        <img src={logoUrl} alt="" width={32} height={32} className="mark" />
        <span className="logo-lockup">
          <span className="logo-word">Tally</span>
          <span className="logo-tag">on your machine</span>
        </span>
      </span>

      <span className="trust-pills" aria-label="Private and offline">
        <span
          className="trust-pill trust-pill-private"
          data-anime
          title="No account. Nothing is uploaded — data stays in this browser."
        >
          <Shield size={12} strokeWidth={2.25} aria-hidden />
          <span className="trust-pill-copy">
            <span className="trust-pill-label">Private</span>
            <span className="trust-pill-hint">no account</span>
          </span>
        </span>

        <span className="trust-divider" aria-hidden data-anime />

        <span
          className="trust-pill trust-pill-offline"
          data-anime
          title="Works without a network. Every total is computed locally."
        >
          <CloudOff size={12} strokeWidth={2.25} aria-hidden />
          <span className="trust-pill-copy">
            <span className="trust-pill-label">Offline</span>
            <span className="trust-pill-hint">zero cloud</span>
          </span>
        </span>
      </span>
    </AnimeReveal>
  );
}

export function SiteHeader({ theme, onToggleTheme, variant }: SiteHeaderProps) {
  const isDark = theme === "dark";

  return (
    <header className="top">
      <div className="top-shell">
        {variant === "app" ? (
          <a href={homeHref()} className="brand" aria-label="Tally home">
            <BrandMark />
          </a>
        ) : (
          <div className="brand">
            <BrandMark />
          </div>
        )}

        <AnimeReveal
          className="top-actions"
          staggerMs={60}
          y={8}
          delayMs={220}
          duration={560}
        >
          <a
            className="ghost icon"
            data-anime
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub repository"
            aria-label="GitHub repository"
          >
            <GitHubIcon size={16} />
          </a>
          <button
            type="button"
            className="ghost icon"
            data-anime
            onClick={onToggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={16} strokeWidth={2} aria-hidden="true" /> : <Moon size={16} strokeWidth={2} aria-hidden="true" />}
          </button>

          {variant === "landing" ? (
            <a className="top-cta" href={appHref()} data-anime>
              Open app
            </a>
          ) : (
            <a className="ghost top-secondary" href={homeHref()} data-anime>
              Home
            </a>
          )}
        </AnimeReveal>
      </div>
    </header>
  );
}
