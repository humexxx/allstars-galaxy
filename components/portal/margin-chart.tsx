"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Mono, Text } from "@/components/ui/typography";
import { maskValue } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type MarginChartPoint = {
  month: string;
  deployed: number;
  liability: number;
  ownPosition: number;
  margin: number;
  invested: number;
};

type View = "margin" | "allocations";

const CONFIG = {
  deployed: { label: "Allocations", color: "var(--chart-1)" },
  liability: { label: "Owed to investors", color: "var(--chart-2)" },
  margin: { label: "Margin", color: "var(--chart-3)" },
  invested: { label: "Contributed", color: "var(--chart-5)" },
} as const;

/**
 * The margin over time.
 *
 * Two views rather than one crowded chart: "Margin" answers *am I ahead*, and
 * "Allocations" shows the two quantities that produce it — what the deployed
 * capital is worth against what is owed. They share no axis trick; each is
 * plain dollars, so the eye can compare across the toggle.
 *
 * The zero line is drawn explicitly in the margin view because crossing it is
 * the only event on this chart that changes what the number MEANS: above it
 * the deployment covers the promise, below it the owner is paying for it.
 */
export function MarginChart({
  data,
  hideValues = false,
}: {
  data: MarginChartPoint[];
  hideValues?: boolean;
}) {
  const [view, setView] = useState<View>("margin");

  if (data.length < 2) {
    return (
      <Text variant="small" className="text-muted-foreground">
        Not enough history yet — the chart needs at least two months of
        contributions.
      </Text>
    );
  }

  const latest = data[data.length - 1];
  const headline = view === "margin" ? latest.margin : latest.deployed;

  const money = (v: number) =>
    hideValues ? maskValue(formatCurrency(v)) : formatCurrency(v);

  const axisTick = (v: number) => {
    if (hideValues) return "";
    const abs = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    return abs >= 1000 ? `${sign}$${Math.round(abs / 1000)}k` : `${sign}$${Math.round(abs)}`;
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Text variant="small" className="text-muted-foreground">
            {view === "margin" ? "Margin" : "Deployed capital"}
          </Text>
          <Mono
            className={cn(
              "text-2xl font-semibold tabular-nums sm:text-3xl",
              view === "margin" &&
                (latest.margin >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400")
            )}
          >
            {money(headline)}
          </Mono>
        </div>

        <div role="group" aria-label="Chart view" className="flex items-center gap-1">
          {(
            [
              ["margin", "Margin"],
              ["allocations", "Allocations"],
            ] as const
          ).map(([v, label]) => (
            <Button
              key={v}
              variant="ghost"
              size="sm"
              data-active={view === v}
              className="h-7 rounded-full px-3 text-xs text-muted-foreground data-[active=true]:bg-foreground/5 data-[active=true]:text-foreground"
              onClick={() => setView(v)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <ChartContainer config={CONFIG} className="h-64 w-full sm:h-72">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.4} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(m: string) => {
              const [y, mo] = m.split("-");
              return new Date(Number(y), Number(mo) - 1).toLocaleDateString("en-US", {
                month: "short",
              });
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={hideValues ? 8 : 56}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={axisTick}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                // The hover is the breakdown: allocations, what is owed, and
                // the owner's own stake shown apart because it is capital.
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {CONFIG[name as keyof typeof CONFIG]?.label ?? name}
                    </span>
                    <Mono className="tabular-nums">{money(value as number)}</Mono>
                  </span>
                )}
                labelFormatter={(m: string) => {
                  const [y, mo] = m.split("-");
                  return new Date(Number(y), Number(mo) - 1).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  });
                }}
              />
            }
          />

          {view === "margin" ? (
            <>
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              <Area
                dataKey="margin"
                type="monotone"
                stroke="var(--color-margin)"
                fill="var(--color-margin)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </>
          ) : (
            <>
              <Area
                dataKey="deployed"
                type="monotone"
                stroke="var(--color-deployed)"
                fill="var(--color-deployed)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                dataKey="liability"
                type="monotone"
                stroke="var(--color-liability)"
                fill="var(--color-liability)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </>
          )}
        </AreaChart>
      </ChartContainer>
    </section>
  );
}
