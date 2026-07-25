import { DockNav, type DockNavItem } from "./ui/dock-nav";
import { appHref } from "../lib/paths";
import iconImport from "../assets/dock/import.png";
import iconAdd from "../assets/dock/add.png";
import iconDemo from "../assets/dock/demo.png";

function openApp(action: "import" | "add" | "demo") {
  try {
    sessionStorage.setItem("tally.boot.action", action);
  } catch {
    /* ignore */
  }
  window.location.assign(appHref(action));
}

export type TallyDockActions = {
  onImport?: () => void;
  onAdd?: () => void;
  onDemo?: () => void;
};

/** Shared action dock — homepage navigates; app can pass in-page handlers. */
export function LandingDock({ onImport, onAdd, onDemo }: TallyDockActions = {}) {
  const items: DockNavItem[] = [
    {
      label: "Import bank CSV",
      iconSrc: iconImport,
      onClick: () => (onImport ? onImport() : openApp("import")),
    },
    {
      label: "Add manually",
      iconSrc: iconAdd,
      onClick: () => (onAdd ? onAdd() : openApp("add")),
    },
    {
      label: "Try demo data",
      iconSrc: iconDemo,
      onClick: () => (onDemo ? onDemo() : openApp("demo")),
    },
  ];

  return (
    <div className="dock-shell anim-3">
      <DockNav className="w-full max-w-md" items={items} aria-label="Tally actions" />
    </div>
  );
}
