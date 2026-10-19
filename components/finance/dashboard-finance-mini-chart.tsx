"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { DashboardPoint } from "@/lib/finance/dashboard";
import { cn } from "@/lib/utils";
import { niceTicks, yAxisWidth } from "@/lib/utils/chart-axis";
import { formatCurrency, formatCurrencyCompact, moneySign } from "@/lib/utils/format";
import type { ChartConfig } from "@/types/chart";

import { DASHBOARD_SERIES, dashboardSeries } from "./dashboard-finance-series";

const chartConfig: ChartConfig = Object.fromEntries(
  DASHBOARD_SERIES.map((s) => [s.key, { label: s.label, color: s.color }])
);

/**
 * Assets stack up from zero and debts down from it, each in its own stack:
 * a stack that mixes signs draws its layers across each other. Savings is
 * split for the same reason — an overdraft is owed, so it sits with the debt.
 */
type Row = DashboardPoint & {
  savingsAbove: number;
  savingsBelow: number;
  debtBelow: number;
};

function toRow(p: DashboardPoint): Row {
  return {
    ...p,
    savingsAbove: Math.max(0, p.savings),
    savingsBelow: Math.min(0, p.savings),
    debtBelow: -p.debt,
  };
}

/**
 * Net worth, then the parts that are not zero at this point, each with the
 * swatch of the area it reads. Only net worth carries a sign colour, as in
 * the card's figure rail.
 */
function MiniTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{point.label}</div>
      <div className="grid gap-1">
        {DASHBOARD_SERIES.map((s) => {
          const value = point[s.key];
          const isTotal = s.key === "netWorth";
          if (!isTotal && moneySign(value) === 0) return null;
          return (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-xs"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums text-foreground",
                  isTotal && (moneySign(value) < 0 ? "text-destructive" : "text-success")
                )}
              >
                {formatCurrency(value)}
              </span>
            </div>
          );
        })}
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
  className,
}: {
  data: DashboardPoint[];
  className?: string;
}) {
  if (data.length === 0) return null;
  const rows = data.map(toRow);
  const ticks = niceTicks(
    rows.flatMap((r) => [
      r.savingsAbove + r.investments + r.receivables,
      r.savingsBelow + r.debtBelow,
      r.netWorth,
    ])
  );
  const owesAnything = rows.some((r) => moneySign(r.savingsBelow + r.debtBelow) < 0);
  const savings = dashboardSeries("savings").color;
  const debt = dashboardSeries("debt").color;
  const area = (dataKey: keyof Row, stackId: string, color: string) => (
    <Area
      dataKey={dataKey}
      stackId={stackId}
      type="monotone"
      fill={color}
      fillOpacity={0.35}
      stroke={color}
      strokeWidth={1.5}
      activeDot={false}
      // Like every other finance chart: no 1.5s draw-in, which read as a
      // series ending months before its own axis in the first second.
      isAnimationActive={false}
    />
  );
  return (
    <ChartContainer config={chartConfig} className={cn("aspect-auto h-48 w-full", className)}>
      <ComposedChart data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.25} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={yAxisWidth(ticks.map(formatCurrencyCompact))}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          tickFormatter={formatCurrencyCompact}
        />
        <ChartTooltip content={<MiniTooltip />} />
        {area("savingsAbove", "assets", savings)}
        {area("investments", "assets", dashboardSeries("investments").color)}
        {area("receivables", "assets", dashboardSeries("receivables").color)}
        {area("savingsBelow", "debts", savings)}
        {area("debtBelow", "debts", debt)}
        {owesAnything && (
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        )}
        <Line
          dataKey="netWorth"
          type="monotone"
          stroke={dashboardSeries("netWorth").color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
