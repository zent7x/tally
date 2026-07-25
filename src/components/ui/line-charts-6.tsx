import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useMemo,
  type ComponentProps,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

type TooltipPayloadEntry = {
  name?: string;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
};

type TooltipContentProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  coordinate?: { x?: number; y?: number };
  accessibilityLayer?: boolean;
  activeIndex?: number | string;
};

type TooltipPropsInjectedByRecharts = Pick<
  TooltipContentProps,
  "active" | "payload" | "label" | "coordinate" | "accessibilityLayer" | "activeIndex"
>;

type LegendPayload = {
  value?: string;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
};

type DefaultLegendContentProps = {
  payload?: LegendPayload[];
};

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: ReactNode;
    icon?: ComponentType<{ className?: string }>;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

function useChart() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }
  return context;
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) return undefined;

  const payloadPayload =
    "payload" in payload &&
    typeof (payload as { payload?: unknown }).payload === "object" &&
    (payload as { payload?: unknown }).payload !== null
      ? (payload as { payload: Record<string, unknown> }).payload
      : undefined;

  let configLabelKey: string = key;
  const pl = payload as Record<string, unknown>;

  if (key in pl && typeof pl[key] === "string") {
    configLabelKey = pl[key] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === "string"
  ) {
    configLabelKey = payloadPayload[key] as string;
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

const ChartContainer = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    config: ChartConfig;
    children: ReactNode;
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn(
          "w-full min-h-0 min-w-0 [&_.recharts-responsive-container]:min-h-0",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children as ReactElement}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme != null || itemConfig.color != null,
  );
  if (!colorConfig.length) return null;

  const css = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const selector = prefix ? `${prefix} [data-chart=${id}]` : `[data-chart=${id}]`;
      const vars = colorConfig
        .map(([key, itemConfig]) => {
          const color =
            itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
          return color ? `  --color-${key}: ${color};` : null;
        })
        .filter(Boolean)
        .join("\n");
      return `${selector} {\n${vars}\n}`;
    })
    .join("\n\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = forwardRef<
  HTMLDivElement,
  Omit<TooltipContentProps, keyof TooltipPropsInjectedByRecharts> &
    Partial<TooltipPropsInjectedByRecharts> &
    ComponentProps<"div"> & {
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: "line" | "dot" | "dashed";
      nameKey?: string;
      labelKey?: string;
      labelFormatter?: (value: unknown, payload: TooltipPayloadEntry[]) => ReactNode;
      formatter?: (
        value: number | string,
        name: string,
        item: TooltipPayloadEntry,
        index: number,
        payload: TooltipPayloadEntry[],
      ) => ReactNode;
      labelClassName?: string;
      color?: string;
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = useMemo(() => {
      if (hideLabel || !payload?.length) return null;
      const [item] = payload;
      const key = `${labelKey ?? (item?.dataKey ?? item?.name) ?? "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        labelKey == null && typeof label === "string"
          ? (config[label as keyof typeof config]?.label ?? label)
          : itemConfig?.label;

      if (labelFormatter != null) {
        return <>{labelFormatter(value, payload)}</>;
      }
      if (value == null) return null;
      return <span className={labelClassName}>{value}</span>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) return null;

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-md",
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        {payload.map((item, index) => {
          const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const indicatorColor =
            color ?? (item.payload as { fill?: string } | undefined)?.fill ?? item.color;

          const rowKey =
            typeof item.dataKey === "string" || typeof item.dataKey === "number"
              ? item.dataKey
              : index;

          return (
            <div key={rowKey} className="flex items-center gap-2">
              {formatter != null && item?.value !== undefined && item.name != null ? (
                formatter(item.value, item.name, item, index, payload)
              ) : (
                <>
                  {itemConfig?.icon != null ? (
                    <itemConfig.icon className="size-4 shrink-0" />
                  ) : (
                    !hideIndicator && (
                      <span
                        className={cn(
                          "rounded-full shrink-0",
                          indicator === "dot" && "size-2.5",
                          indicator === "line" && "h-0.5 w-4",
                          indicator === "dashed" && "h-0.5 w-4 border-t-2 border-dashed",
                        )}
                        style={{
                          backgroundColor: indicator === "dot" ? indicatorColor : undefined,
                          borderColor: indicator === "dashed" ? indicatorColor : undefined,
                        }}
                      />
                    )
                  )}
                  {nestLabel ? tooltipLabel : null}
                  <span>{itemConfig?.label ?? item.name}</span>
                  {item.value != null && (
                    <span className="font-medium tabular-nums">
                      {typeof item.value === "number"
                        ? item.value.toLocaleString()
                        : item.value}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltipContent";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = forwardRef<
  HTMLDivElement,
  DefaultLegendContentProps &
    ComponentProps<"div"> & {
      hideIcon?: boolean;
      nameKey?: string;
    }
>(({ className, hideIcon = false, payload, nameKey }, ref) => {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn("flex flex-wrap justify-center gap-4 gap-y-2 [&_svg]:size-3.5", className)}
    >
      {payload.map((item) => {
        const key = `${nameKey ?? item.dataKey ?? "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);
        return (
          <div key={item.value} className="flex items-center gap-1.5">
            {itemConfig?.icon != null && !hideIcon ? (
              <itemConfig.icon className="size-4 shrink-0" />
            ) : (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: item.color ?? (item.payload as { fill?: string } | undefined)?.fill,
                }}
              />
            )}
            <span className="text-muted-foreground text-xs">
              {itemConfig?.label ?? item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
};
