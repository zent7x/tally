import { type ReactNode } from "react";

/** The ledger needs no canvas, image download, or animation loop to feel at home. */
export function PageBackground({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-bg" aria-hidden="true" />
      <div className="page-fg">{children}</div>
    </div>
  );
}
