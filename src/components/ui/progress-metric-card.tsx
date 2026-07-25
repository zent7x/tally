/*
 * Tailwind token mapping for Tally (no shadcn theme in index.css):
 * border-border → border-[var(--border)]
 * bg-card → bg-[var(--surface)]
 * text-muted-foreground → text-[var(--muted)]
 * text-foreground → text-[var(--text)]
 * bg-muted → bg-[var(--wash)]
 */

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import {
  MetricChart,
  formatCompact,
  ACCENTS,
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

function computeDelta(data: SeriesPoint[], index: number) {
  if (index <= 0 || !data[index] || !data[index - 1]) {
    return null;
  }

  const current = data[index].value;
  const previous = data[index - 1].value;

  if (previous === 0) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
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
  const delta = computeDelta(visibleData, displayIndex);
  const accentColors = ACCENTS[accent];

  return (
    <section
      className={cn("glass-panel w-full p-5 sm:p-6", className)}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--muted, #5b646c)" }}>
            {title}
          </p>
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
              {delta !== null ? (
                <span
                  className="ml-2 font-medium tabular-nums"
                  style={{
                    color: delta >= 0 ? accentColors.text : ACCENTS.rose.text,
                  }}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
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
        view={view}
        accent={accent}
        defaultIndex={resolvedDefaultIndex}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        valueFormatter={valueFormatter}
        dateFormatter={dateFormatter}
        height={200}
      />
    </section>
  );
}

export default ProgressMetricCard;
