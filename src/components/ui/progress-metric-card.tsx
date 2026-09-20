/*
 * Tailwind token mapping for Tally (no shadcn theme in index.css):
 * border-border → border-[var(--border)]
 * bg-card → bg-[var(--surface)]
 * text-muted-foreground → text-[var(--muted)]
 * text-foreground → text-[var(--text)]
 * bg-muted → bg-[var(--wash)]
 */

import { cn } from "@/lib/utils";
import { useId, useMemo, useState } from "react";
import {
  MetricChart,
  formatCompact,
  type ChartView,
  type MetricAccent,
  type SeriesPoint,
} from "@/components/ui/metric-chart";
import {
  PeriodSelect,
  ViewToggle,
  type PeriodOption,
} from "@/components/ui/metric-controls";

export type { SeriesPoint };

const DEFAULT_PERIODS: PeriodOption[] = [
  { label: "7D", points: 7 },
  { label: "14D", points: 14 },
  { label: "30D", points: 30 },
  { label: "All" },
];

export type ProgressMetricCardProps = {
  title: string;
  unit?: string;
  data: SeriesPoint[];
  defaultIndex?: number;
  accent?: MetricAccent;
  periods?: PeriodOption[];
  defaultPeriod?: string;
  className?: string;
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
};

function sliceByPeriod(data: SeriesPoint[], points?: number) {
  if (!points || points >= data.length) {
    return data;
  }
  return data.slice(-points);
}

export function ProgressMetricCard({
  title,
  unit,
  data,
  defaultIndex,
  accent = "emerald",
  periods = DEFAULT_PERIODS,
  defaultPeriod = periods[periods.length - 1]?.label ?? "All",
  className,
  valueFormatter = formatCompact,
  dateFormatter = (date) => date,
}: ProgressMetricCardProps) {
  const titleId = useId();
  const [periodLabel, setPeriodLabel] = useState(defaultPeriod);
  const [view, setView] = useState<ChartView>("curve");
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const selectedPeriod =
    periods.find((option) => option.label === periodLabel) ?? periods[periods.length - 1];

  const visibleData = useMemo(
    () => sliceByPeriod(data, selectedPeriod?.points),
    [data, selectedPeriod?.points]
  );

  const resolvedDefaultIndex = useMemo(() => {
    if (typeof defaultIndex === "number") {
      return Math.min(Math.max(defaultIndex, 0), Math.max(visibleData.length - 1, 0));
    }
    return Math.max(visibleData.length - 1, 0);
  }, [defaultIndex, visibleData.length]);

  const displayIndex = activeIndex ?? resolvedDefaultIndex;
  const activePoint = visibleData[displayIndex];

  return (
    <section
      className={cn("panel w-full p-5 sm:p-6", className)}
      aria-labelledby={titleId}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="text-sm font-medium" style={{ color: "var(--muted, #5b646c)" }}>
            {title}
          </h3>
          <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-1">
            <p
              className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl"
              style={{ color: "var(--text, #171a1c)" }}
            >
              {activePoint ? valueFormatter(activePoint.value) : "—"}
            </p>
            {unit ? (
              <span
                className="pb-1 text-sm font-medium"
                style={{ color: "var(--muted, #5b646c)" }}
              >
                {unit}
              </span>
            ) : null}
          </div>
          {activePoint ? (
            <p className="mt-1 text-xs" style={{ color: "var(--muted, #5b646c)" }}>
              {dateFormatter(activePoint.date)}

            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${title} chart controls`}>
          <PeriodSelect
            options={periods}
            value={periodLabel}
            onValueChange={(label) => {
              setPeriodLabel(label);
              setActiveIndex(undefined);
            }}
          />
          <ViewToggle view={view} onViewChange={setView} />
        </div>
      </div>

      <MetricChart
        data={visibleData}
        label={title}
        view={view}
        accent={accent}
        defaultIndex={resolvedDefaultIndex}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        valueFormatter={valueFormatter}
        dateFormatter={dateFormatter}
        height={160}
      />
    </section>
  );
}

export default ProgressMetricCard;
