"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";
import { subDays } from "date-fns";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useReaderTimeZone } from "@/components/reader-time-zone";
import { formatDay, formatShortDay } from "@/lib/utils/date";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatSignedPercent,
} from "@/lib/utils/format";
import type { ChartConfig, ChartDataPoint } from "@/types/chart";
import { rangeGain, type CashFlowPoint } from "./performance-series";

const chartConfig = {
  value: {
    label: "Portfolio value",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const RANGES = ["1M", "3M", "YTD", "1Y", "All"] as const;
type Range = (typeof RANGES)[number];

type PerformanceChartProps = {
  data: ChartDataPoint[];
  /** Approved cash in (+) and out (-). Without them every deposit inside the
   *  range counted as performance: a $3,000 top-up read as a 40% gain. */
  cashFlows?: CashFlowPoint[];
};

export function PerformanceChart({
  data,
  cashFlows = [],
  hideValues = false,
}: PerformanceChartProps & { hideValues?: boolean }) {
  const timeZone = useReaderTimeZone();
  const [timeRange, setTimeRange] = useState<Range>("All");

  const filteredData = useMemo(() => {
    if (timeRange === "All" || data.length === 0) return data;

    const now = new Date();
    // YTD is a calendar boundary, not a rolling window — Jan 1 of this year.
    const startDate =
      timeRange === "YTD"
        ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
        : subDays(now, { "1M": 30, "3M": 90, "1Y": 365 }[timeRange]);
    return data.filter((point) => new Date(point.date) >= startDate);
  }, [data, timeRange]);

  const first = filteredData[0]?.value ?? 0;
  const last = filteredData[filteredData.length - 1]?.value ?? 0;
  const { gain: delta, percent: deltaPct } = useMemo(
    () => rangeGain(filteredData, cashFlows),
    [filteredData, cashFlows]
  );
  const positive = delta >= 0;

  return (
    <section className="flex flex-col gap-3">
      {/* Inline legend strip — no card chrome, sits on page bg. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading level="h5" as="h2" className="text-muted-foreground">
            Performance
          </Heading>
          <div className="flex items-baseline gap-2">
            <Mono className="text-xl font-semibold tabular-nums sm:text-2xl">
              {hideValues ? formatSignedPercent(deltaPct, 1) : formatCurrency(last)}
            </Mono>
            {filteredData.length > 1 && (
              <Mono className={cn("text-sm", positive ? "text-success" : "text-destructive")}>
                {positive ? "↑" : "↓"}{" "}
                {hideValues
                  ? "over this range"
                  : `${formatCurrency(Math.abs(delta))} (${formatPercent(Math.abs(deltaPct), 2)})`}
              </Mono>
            )}
          </div>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          aria-label="Time range"
          value={timeRange}
          onValueChange={(v) => v && setTimeRange(v as Range)}
        >
          {RANGES.map((r) => (
            <ToggleGroupItem key={r} value={r} className="font-mono tabular-nums">
              {r}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
            tickFormatter={(value: string) => formatShortDay(value, timeZone)}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={56}
            tickFormatter={(value: number) =>
              hideValues
                ? first === 0
                  ? ""
                  : formatPercent(((value - first) / first) * 100, 0)
                : formatCurrencyCompact(value)
            }
            domain={["auto", "auto"]}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--foreground)", strokeWidth: 1, strokeOpacity: 0.3 }}
            content={
              <ChartTooltipContent
                indicator="line"
                // Hovering must not leak the amount the axis is hiding.
                formatter={(value) =>
                  hideValues
                    ? first === 0
                      ? "—"
                      : `${formatSignedPercent((((value as number) - first) / first) * 100, 1)} vs start`
                    : formatCurrency(value as number)
                }
                labelFormatter={(value: string) => formatDay(value, timeZone)}
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

      {filteredData[0] && (
        <Text variant="small">
          {formatDay(filteredData[0].date, timeZone)} — today · gain excludes money added or
          withdrawn
        </Text>
      )}
    </section>
  );
}
