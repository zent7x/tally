import logoUrl from "@/assets/logo/tally-icon.svg";
import { LandingDock } from "@/components/LandingDock";

export interface EmptyStateProps {
  onImport: () => void;
  onAdd: () => void;
  onDemo: () => void;
}

export function EmptyState({ onImport, onAdd, onDemo }: EmptyStateProps) {
  return (
    <section className="landing-hero !min-h-[calc(100dvh-140px)] !justify-center !gap-10 !py-10">
      <div className="landing-copy anim-1">
        <div className="brand-hero">
          <img src={logoUrl} alt="" className="hero-mark" width={56} height={56} />
          Tally
        </div>
        <h1 className="anim-2">Your ledger, on this device.</h1>
        <p className="anim-2">
          Import a bank CSV, add a transaction manually, or explore with demo data. No account. No
          cloud. Everything stays here.
        </p>
        <LandingDock onImport={onImport} onAdd={onAdd} onDemo={onDemo} />
      </div>
    </section>
  );
}
