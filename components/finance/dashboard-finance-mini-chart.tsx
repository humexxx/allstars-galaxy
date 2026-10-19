"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { DashboardPoint } from "@/lib/finance/dashboard";
import { cn } from "@/lib/utils";
import { niceTicks, yAxisWidth } from "@/lib/utils/chart-axis";
import { formatCurrency, formatCurrencyCompact, moneySign } from "@/lib/utils/format";
import type { ChartConfig } from "@/types/chart";

const chartConfig = {
  netWorth: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * The stock tooltip printed the raw number ("-1,467", no currency) under a
 * bare month that appears twice in a 13-point year ("Sep" today and "Sep" a
 * year on). This one prints the figure the way the KPI tiles above do.
 */
function MiniTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardPoint }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{point.label}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Net worth</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            moneySign(point.netWorth) < 0 ? "text-destructive" : "text-foreground"
          )}
        >
          {formatCurrency(point.netWorth)}
        </span>
      </div>
    </div>
  );
}

/**
 * `aspect-auto` drops ChartContainer's 16:9 default: beside the card's figure
 * rail the chart stretches to the rail's height, and an aspect ratio would
 * size it from its width instead.
 */
export function DashboardFinanceMiniChart({
  data,
  color,
  className,
}: {
  data: DashboardPoint[];
  /** The plan's own colour token, as on its plan page. */
  color?: string;
  className?: string;
}) {
  if (data.length === 0) return null;
  const stroke = color || "var(--color-netWorth)";
  const ticks = niceTicks(data.map((d) => d.netWorth));
  return (
    <ChartContainer config={chartConfig} className={cn("aspect-auto h-48 w-full", className)}>
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.25} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          minTickGap={20}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={yAxisWidth(ticks.map(formatCurrencyCompact))}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          tickFormatter={formatCurrencyCompact}
        />
        <ChartTooltip content={<MiniTooltip />} />
        <Area
          dataKey="netWorth"
          type="monotone"
          fill={stroke}
          fillOpacity={0.25}
          stroke={stroke}
          strokeWidth={2}
          // Like every other finance chart: no 1.5s draw-in, which read as a
          // series ending months before its own axis in the first second.
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
