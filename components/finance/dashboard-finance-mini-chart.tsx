"use client";

import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { DashboardPoint } from "@/lib/finance/dashboard";
import { cn } from "@/lib/utils";
import { formatCurrency, moneySign } from "@/lib/utils/format";
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

export function DashboardFinanceMiniChart({
  data,
  color,
}: {
  data: DashboardPoint[];
  /** The plan's own colour token, as on its plan page. */
  color?: string;
}) {
  if (data.length === 0) return null;
  const stroke = color || "var(--color-netWorth)";
  return (
    <ChartContainer config={chartConfig} className="h-36 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          minTickGap={20}
        />
        <YAxis hide />
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
