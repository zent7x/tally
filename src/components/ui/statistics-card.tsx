import NumberFlow from "@number-flow/react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const candyCss = `
.candy-bg {
  background-color: color-mix(in srgb, var(--wash) 70%, transparent);
  background-image: linear-gradient(
    135deg,
    var(--wash) 25%,
    transparent 25.5%,
    transparent 50%,
    var(--wash) 50.5%,
    var(--wash) 75%,
    transparent 75.5%,
    transparent
  );
  background-size: 10px 10px;
}
`;

export type StatBar = {
  value: number;
  label: string;
  /** Short line under the label */
  detail?: string;
  /** Pill / callout above the bar */
  tip?: string;
  /** Always show tip (vs hover) */
  tipPinned?: boolean;
  delay?: number;
  className?: string;
  step?: string;
};

type StatsProps = {
  title: string;
  description: string;
  eyebrow?: string;
  bars: StatBar[];
  className?: string;
};

export function Stats({ title, description, eyebrow, bars, className }: StatsProps) {
  return (
    <section className={cn("how-stats w-full", className)} aria-labelledby="how-heading">
      <style>{candyCss}</style>
      <div className="how-stats-inner mx-auto w-full max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow ? <p className="how-eyebrow">{eyebrow}</p> : null}
          <h2
            id="how-heading"
            className="w-full text-[clamp(1.75rem,4vw,3rem)] font-medium tracking-[-0.04em] text-[var(--ink)]"
          >
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] tracking-tight text-[var(--muted)] lg:text-lg">
            {description}
          </p>
        </div>

        <div className="relative mx-auto mt-14 flex h-72 max-w-4xl items-end justify-center gap-2 sm:mt-16 sm:h-[26rem] sm:gap-3">
          {bars.map((props, index) => (
            <motion.div
              key={props.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                type: "spring",
                damping: 12,
              }}
              className="h-full w-full min-w-0"
            >
              <BarChart
                {...props}
                step={props.step ?? String(index + 1).padStart(2, "0")}
                delay={props.delay ?? index * 0.14}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BarChart({
  value,
  label,
  detail,
  className = "",
  tip = "on device",
  tipPinned = false,
  delay = 0,
  step,
}: StatBar) {
  return (
    <div className="group relative flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="candy-bg relative h-full w-full overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] sm:rounded-[40px]">
          <motion.div
            initial={{ opacity: 0, y: 100, height: 0 }}
            whileInView={{ opacity: 1, y: 0, height: `${value}%` }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, type: "spring", damping: 20, delay }}
            className={cn(
              "absolute bottom-0 mt-auto w-full rounded-[28px] bg-[color-mix(in_srgb,var(--accent)_78%,transparent)] p-2 text-white shadow-[0_-8px_24px_color-mix(in_srgb,var(--accent)_18%,transparent)] sm:rounded-[40px] sm:p-3",
              className,
            )}
          >
            <div className="relative flex h-10 w-full items-center justify-center gap-0.5 rounded-full bg-[color-mix(in_srgb,var(--surface)_24%,transparent)] text-sm font-medium tracking-tighter tabular-nums sm:h-12 sm:text-base">
              <NumberFlow value={value} suffix="%" />
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 100, height: 0 }}
          whileInView={{ opacity: 1, y: 0, height: `${value}%` }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, type: "spring", damping: 15, delay }}
          className="pointer-events-none absolute bottom-0 w-full"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, type: "spring", damping: 16, delay: delay + 0.18 }}
            className={cn(
              "absolute -top-10 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl px-2.5 py-1 text-[11px] font-semibold tracking-tight sm:-top-9 sm:text-xs",
              tipPinned
                ? "bg-[var(--accent)] text-white opacity-100"
                : "bg-[var(--ink)] text-[var(--bg)] opacity-100 max-sm:opacity-100 sm:opacity-90 sm:group-hover:opacity-100",
            )}
          >
            <div
              className={cn(
                "absolute -bottom-8 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] sm:-bottom-9 sm:size-3.5",
                tipPinned ? "bg-[var(--accent)]" : "bg-[var(--ink)]",
              )}
            />
            <svg
              className={cn(
                "absolute -bottom-2 left-1/2 -translate-x-1/2",
                tipPinned ? "text-[var(--accent)]" : "text-[var(--ink)]",
              )}
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M3.83855 8.41381C4.43827 9.45255 5.93756 9.45255 6.53728 8.41381L9.65582 3.01233C10.2555 1.97359 9.50589 0.675159 8.30646 0.675159H2.06937C0.869935 0.675159 0.120287 1.97359 0.720006 3.01233L3.83855 8.41381Z"
                fill="currentColor"
              />
            </svg>
            {tip}
          </motion.div>
        </motion.div>
      </div>

      <div className="mt-3 px-0.5 text-center sm:mt-3.5">
        {step ? (
          <p className="mb-0.5 text-[10px] font-semibold tracking-[0.08em] text-[var(--faint)] sm:text-[11px]">
            {step}
          </p>
        ) : null}
        <p className="text-[12px] font-semibold tracking-tight text-[var(--text)] sm:text-sm">
          {label}
        </p>
        {detail ? (
          <p className="mx-auto mt-1 max-w-[14ch] text-[10px] leading-snug tracking-tight text-[var(--muted)] sm:max-w-[16ch] sm:text-[11px]">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
