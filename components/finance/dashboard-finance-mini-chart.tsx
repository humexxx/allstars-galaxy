"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { niceTicks, yAxisWidth } from "@/lib/utils/chart-axis";
import { formatCurrencyCompact } from "@/lib/utils/format";
import type { ChartConfig } from "@/types/chart";

const chartConfig = {
  netWorth: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

type MiniPoint = { month: string; netWorth: number };

/**
 * `aspect-auto` drops ChartContainer's 16:9 default: beside the card's figure
 * rail the chart stretches to the rail's height, and an aspect ratio would
 * size it from its width instead.
 */
export function DashboardFinanceMiniChart({
  data,
  className,
}: {
  data: MiniPoint[];
  className?: string;
}) {
  if (data.length === 0) return null;
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
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="netWorth"
          type="monotone"
          fill="var(--color-netWorth)"
          fillOpacity={0.25}
          stroke="var(--color-netWorth)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
