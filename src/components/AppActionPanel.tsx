import { Database, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppActionPanelProps {
  onImport: () => void;
  onAdd: () => void;
  onDemo: () => void;
  className?: string;
}

/** Compact glass action bar — matches homepage dock language. */
export function AppActionPanel({ onImport, onAdd, onDemo, className }: AppActionPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-[0_16px_40px_-24px_rgba(20,107,74,0.45)] backdrop-blur-xl",
        className,
      )}
      style={{
        borderColor: "color-mix(in srgb, var(--border) 85%, transparent)",
        background: "color-mix(in srgb, var(--surface) 82%, transparent)",
      }}
      role="toolbar"
      aria-label="Ledger actions"
    >
      <ActionButton onClick={onImport} icon={<Upload className="h-4 w-4" aria-hidden />}>
        Import CSV
      </ActionButton>
      <ActionButton onClick={onAdd} icon={<Plus className="h-4 w-4" aria-hidden />}>
        Add
      </ActionButton>
      <ActionButton onClick={onDemo} icon={<Database className="h-4 w-4" aria-hidden />}>
        Demo
      </ActionButton>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--wash)]"
      style={{ color: "var(--text)" }}
    >
      {icon}
      {children}
    </button>
  );
}
