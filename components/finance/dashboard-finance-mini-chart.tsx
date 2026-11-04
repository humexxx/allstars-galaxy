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

import { DASHBOARD_SERIES, dashboardSeries, visibleSeriesKeys } from "./dashboard-finance-series";

const chartConfig: ChartConfig = Object.fromEntries(
  DASHBOARD_SERIES.map((s) => [s.key, { label: s.label, color: s.color }])
);

/**
 * Assets stack up from zero and debts down from it, each in its own stack:
 * a stack that mixes signs draws its layers across each other. Savings is
 * split for the same reason — an overdraft is owed, so it sits with the debt.
 *
 * Owed to you is the bottom layer. On top of cash it rode every rise in cash,
 * so a band that was shrinking read as growing with net worth.
 */
const PLOTTED = ["receivables", "investments", "savingsAbove", "savingsBelow", "debtBelow", "netWorth"] as const;
type Plotted = (typeof PLOTTED)[number];

/**
 * Every plotted series twice: `…Past` up to today and `…Ahead` from today,
 * null elsewhere. Today is in both, so the solid run and the dashed one meet
 * there. A null in a stacked area is a gap, not a zero, so each half draws
 * only its own months.
 */
export type Row = DashboardPoint & {
  projected: boolean;
} & Record<`${Plotted}${"Past" | "Ahead"}`, number | null>;

export function toRows(data: DashboardPoint[], pastCount: number): Row[] {
  return data.map((p, i) => {
    const values: Record<Plotted, number> = {
      savingsAbove: Math.max(0, p.savings),
      investments: p.investments,
      receivables: p.receivables,
      savingsBelow: Math.min(0, p.savings),
      debtBelow: -p.debt,
      netWorth: p.netWorth,
    };
    const row = { ...p, projected: i > pastCount } as Row;
    for (const key of PLOTTED) {
      row[`${key}Past`] = i <= pastCount ? values[key] : null;
      row[`${key}Ahead`] = i >= pastCount ? values[key] : null;
    }
    return row;
  });
}

/** Same rhythm as the plan page's projected line. */
const PROJECTED_DASH = "6 4";

/**
 * The series this range shows (`visibleSeriesKeys`), each with the
 * swatch of the area it reads. Only net worth carries a sign colour, as in
 * the card's figure rail.
 */
function MiniTooltip({
  active,
  payload,
  visible,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
  visible: ReadonlySet<string>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium">{point.label}</span>
        {point.projected && <span className="text-muted-foreground">Projected</span>}
      </div>
      <div className="grid gap-1">
        {DASHBOARD_SERIES.map((s) => {
          const value = point[s.key];
          const isTotal = s.key === "netWorth";
          if (!visible.has(s.key)) return null;
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
  pastCount = 0,
  className,
}: {
  data: DashboardPoint[];
  /** Points before today's: drawn solid, everything after it dashed. */
  pastCount?: number;
  className?: string;
}) {
  if (data.length === 0) return null;
  const rows = toRows(data, pastCount);
  const tickTimes = data.filter((p) => p.tick).map((p) => p.time);
  const monthByTime = new Map(data.map((p) => [p.time, p.month]));
  const visible = visibleSeriesKeys(data);
  const ticks = niceTicks(
    data.flatMap((p) => [
      Math.max(0, p.savings) + p.investments + p.receivables,
      Math.min(0, p.savings) - p.debt,
      p.netWorth,
    ])
  );
  const owesAnything = data.some((p) => moneySign(Math.min(0, p.savings) - p.debt) < 0);
  const savings = dashboardSeries("savings").color;
  const debt = dashboardSeries("debt").color;
  // A projected month is the same series, dashed and fainter: the plan's
  // guess, not a balance anyone has seen.
  const area = (key: Plotted, stack: "assets" | "debts", color: string, ahead: boolean) => (
    <Area
      key={`${key}-${ahead ? "ahead" : "past"}`}
      dataKey={`${key}${ahead ? "Ahead" : "Past"}`}
      stackId={`${stack}-${ahead ? "ahead" : "past"}`}
      type="monotone"
      fill={color}
      fillOpacity={ahead ? 0.2 : 0.35}
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray={ahead ? PROJECTED_DASH : undefined}
      activeDot={false}
      // Like every other finance chart: no 1.5s draw-in, which read as a
      // series ending months before its own axis in the first second.
      isAnimationActive={false}
    />
  );
  const halves = [false, true].flatMap((ahead) => [
    area("receivables", "assets", dashboardSeries("receivables").color, ahead),
    area("investments", "assets", dashboardSeries("investments").color, ahead),
    area("savingsAbove", "assets", savings, ahead),
    area("savingsBelow", "debts", savings, ahead),
    area("debtBelow", "debts", debt, ahead),
  ]);
  const netWorth = (ahead: boolean) => (
    <Line
      key={`netWorth-${ahead ? "ahead" : "past"}`}
      dataKey={ahead ? "netWorthAhead" : "netWorthPast"}
      type="monotone"
      stroke={dashboardSeries("netWorth").color}
      strokeWidth={2}
      strokeDasharray={ahead ? PROJECTED_DASH : undefined}
      dot={false}
      activeDot={{ r: 3 }}
      isAnimationActive={false}
    />
  );
  return (
    // Fades and rises in once on load (skipped under reduced motion). Not
    // recharts' own draw-in: it sweeps left to right, which read as a series
    // ending months short of its axis, and it breaks the dashed projection.
    <ChartContainer
      config={chartConfig}
      className={cn(
        "aspect-auto h-48 w-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:ease-out",
        className
      )}
    >
      {/* The right margin is half the last month's label, which every
          interval now draws on the chart's very edge. */}
      <ComposedChart data={rows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.25} />
        {/* Every third month counted from today, so "Now" — where the solid
            line turns dashed — always has its label. Left to `minTickGap`,
            the axis skipped it as soon as the past pushed it off the edge. */}
        {/* A time axis, not one slot per point: the past mixes period
            closes with the days money moved, and equal slots would stretch a
            busy week as wide as a quiet month. Labels on the oldest point,
            "Now", and every third close after it. */}
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          ticks={tickTimes}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(time: number) => monthByTime.get(time) ?? ""}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={yAxisWidth(ticks.map(formatCurrencyCompact))}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          tickFormatter={formatCurrencyCompact}
        />
        <ChartTooltip content={<MiniTooltip visible={visible} />} />
        {halves}
        {owesAnything && (
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        )}
        {netWorth(false)}
        {netWorth(true)}
      </ComposedChart>
    </ChartContainer>
  );
}
