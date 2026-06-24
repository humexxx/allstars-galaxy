"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Calendar, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { subDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Heading, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ChartConfig } from "@/types/chart";

const chartConfig = {
  value: {
    label: "Portfolio Value",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const RANGES = ["30d", "90d", "120d", "1yr", "All"] as const;
type Range = (typeof RANGES)[number];

type PerformanceChartProps = {
  data: Array<{
    date: string;
    value: number;
  }>;
};

export function PerformanceChart({ data }: PerformanceChartProps) {
  const [timeRange, setTimeRange] = useState<Range>("All");

  const filteredData = useMemo(() => {
    if (timeRange === "All" || data.length === 0) return data;

    const now = new Date();
    const days: Record<Exclude<Range, "All">, number> = {
      "30d": 30,
      "90d": 90,
      "120d": 120,
      "1yr": 365,
    };
    const startDate = subDays(now, days[timeRange]);
    return data.filter((point) => new Date(point.date) >= startDate);
  }, [data, timeRange]);

  const first = filteredData[0]?.value ?? 0;
  const last = filteredData[filteredData.length - 1]?.value ?? 0;
  const delta = last - first;
  const deltaPct = first === 0 ? 0 : (delta / first) * 100;
  const positive = delta >= 0;

  return (
    <section className="space-y-3">
      {/* Inline legend strip — no card chrome, sits on page bg. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Heading level="h5" as="h2" className="text-muted-foreground">
            Performance
          </Heading>
          <div className="flex items-baseline gap-2">
            <Mono className="text-2xl font-semibold tabular-nums sm:text-3xl">
              ${last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Mono>
            {filteredData.length > 1 && (
              <Mono
                className={cn(
                  "text-sm",
                  positive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {positive ? "↑" : "↓"} ${Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({Math.abs(deltaPct).toFixed(1)}%)
              </Mono>
            )}
          </div>
        </div>
      </div>

      {/* Chart body — no card, no border. The page background carries it. */}
      <ChartContainer config={chartConfig} className="h-72 w-full sm:h-80">
        <AreaChart
          accessibilityLayer
          data={filteredData}
          margin={{ left: 0, right: 48, top: 8, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={48}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={56}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
            domain={["auto", "auto"]}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--foreground)", strokeWidth: 1, strokeOpacity: 0.3 }}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });
                }}
              />
            }
          />
          <Area
            dataKey="value"
            type="monotone"
            fill="var(--color-value)"
            fillOpacity={0.15}
            stroke="var(--color-value)"
            strokeWidth={2}
            activeDot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
          />
        </AreaChart>
      </ChartContainer>

      {/* Footer meta strip + time-range pills. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-3" />
            {filteredData.length} pt{filteredData.length === 1 ? "" : "s"}
          </span>
          {filteredData[0] && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              from {new Date(filteredData[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              variant="ghost"
              size="sm"
              data-active={timeRange === r}
              className="h-7 rounded-full px-2.5 font-mono text-xs tabular-nums text-muted-foreground data-[active=true]:bg-foreground/5 data-[active=true]:text-foreground"
              onClick={() => setTimeRange(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
