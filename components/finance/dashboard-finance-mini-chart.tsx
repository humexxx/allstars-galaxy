"use client";

import { Area, AreaChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/types/chart";

const chartConfig = {
  netWorth: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

type MiniPoint = { month: string; netWorth: number };

export function DashboardFinanceMiniChart({ data }: { data: MiniPoint[] }) {
  if (data.length === 0) return null;
  return (
    <ChartContainer config={chartConfig} className="h-36 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          minTickGap={20}
        />
        <YAxis hide />
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
