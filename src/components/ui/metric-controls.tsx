import { cn } from "@/lib/utils";
import { BarChart3, LineChart } from "lucide-react";
import type { ChartView } from "@/components/ui/metric-chart";

export type PeriodOption = {
  label: string;
  points?: number;
};

export type PeriodSelectProps = {
  options: PeriodOption[];
  value: string;
  onValueChange: (label: string) => void;
  className?: string;
};

export function PeriodSelect({
  options,
  value,
  onValueChange,
  className,
}: PeriodSelectProps) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {options.map((option) => {
        const isActive = option.label === value;

        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onValueChange(option.label)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-[var(--wash,#eeede5)] text-[var(--text,#171a1c)]"
                : "text-[var(--muted,#5b646c)] hover:text-[var(--text,#171a1c)]"
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export type ViewToggleProps = {
  view: ChartView;
  onViewChange: (view: ChartView) => void;
  className?: string;
};

export function ViewToggle({ view, onViewChange, className }: ViewToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border p-0.5",
        className
      )}
      style={{
        borderColor: "var(--border, #e3e1d8)",
        background: "color-mix(in srgb, var(--surface, #fff) 88%, transparent)",
      }}
      role="group"
      aria-label="Chart view"
    >
      <button
        type="button"
        onClick={() => onViewChange("curve")}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          view === "curve"
            ? "bg-[var(--wash,#eeede5)] text-[var(--text,#171a1c)] shadow-sm"
            : "text-[var(--muted,#5b646c)] hover:text-[var(--text,#171a1c)]"
        )}
        aria-pressed={view === "curve"}
        aria-label="Curve view"
      >
        <LineChart className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("bars")}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          view === "bars"
            ? "bg-[var(--wash,#eeede5)] text-[var(--text,#171a1c)] shadow-sm"
            : "text-[var(--muted,#5b646c)] hover:text-[var(--text,#171a1c)]"
        )}
        aria-pressed={view === "bars"}
        aria-label="Bar view"
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
