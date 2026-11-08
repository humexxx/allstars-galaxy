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
import { shownCash } from "@/lib/finance/cash";
import type { DashboardPoint } from "@/lib/finance/dashboard";
import { cn } from "@/lib/utils";
import { niceTicks, yAxisWidth } from "@/lib/utils/chart-axis";
import { formatCurrency, formatCurrencyCompact, moneySign } from "@/lib/utils/format";
import type { ChartConfig } from "@/types/chart";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { DASHBOARD_SERIES, dashboardSeries, visibleSeriesKeys } from "./dashboard-finance-series";
import { DRAW_ORDER, drawDelay, splitEasedStroke, sweepEasing, SWEEP_MS } from "./dashboard-motion";

const chartConfig: ChartConfig = Object.fromEntries(
  DASHBOARD_SERIES.map((s) => [s.key, { label: s.label, color: s.color }])
);

/**
 * Assets stack up from zero and debts down from it, each in its own stack:
 * a stack that mixes signs draws its layers across each other. Savings is
 * split for the same reason — an overdraft is owed, so it sits with the debt.
 *
 * Cash is the bottom layer, so at $0 its outline is a flat line on zero
 * rather than a trace along the top of the stack. Cash is usually $0 now
 * that the surplus is routed the day it lands, so Owed to you above it no
 * longer rides its swings.
 */
const PLOTTED = ["savingsAbove", "receivables", "investments", "savingsBelow", "debtBelow", "netWorth"] as const;
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

/** Parts that stop being drawn while they are $0: once a debt is paid off its outline ran along zero to the end. */
const ENDS_AT_ZERO: ReadonlySet<Plotted> = new Set(["debtBelow", "receivables"]);

export function toRows(data: DashboardPoint[], pastCount: number): Row[] {
  const valuesOf = (p: DashboardPoint): Record<Plotted, number> => ({
    savingsAbove: shownCash(p.savings),
    // A negative margin is net worth's business, not an area: the stack is
    // drawn up from zero.
    investments: Math.max(0, p.investments),
    receivables: p.receivables,
    // Cash is never drawn under zero (see `shownCash`).
    savingsBelow: 0,
    // `0 - debt`, not `-debt`: a paid-off debt is 0, not -0.
    debtBelow: 0 - p.debt,
    netWorth: p.netWorth,
  });
  const all = data.map(valuesOf);
  // A $0 point is drawn only beside a point that is not: the area comes down
  // to zero where the debt is paid off (or rises from it), then ends.
  const drawn = (key: Plotted, i: number): boolean =>
    !ENDS_AT_ZERO.has(key) ||
    moneySign(all[i][key]) !== 0 ||
    (i > 0 && moneySign(all[i - 1][key]) !== 0) ||
    (i < all.length - 1 && moneySign(all[i + 1][key]) !== 0);
  return data.map((p, i) => {
    const values = all[i];
    const row = { ...p, projected: i > pastCount } as Row;
    for (const key of PLOTTED) {
      const value = drawn(key, i) ? values[key] : null;
      row[`${key}Past`] = i <= pastCount ? value : null;
      row[`${key}Ahead`] = i >= pastCount ? value : null;
    }
    return row;
  });
}

/** Which part each plotted area is, for its place in the draw-in. */
const AREA_PART: Record<string, keyof typeof DRAW_ORDER> = {
  savingsAbove: "savings",
  savingsBelow: "savings",
  investments: "investments",
  debtBelow: "debt",
  receivables: "receivables",
};

// recharts types `animationEasing` as the named curves only, but its
// animator (react-smooth) takes any t → progress function.
type Easing = "ease-out";
const asEasing = (fn: (t: number) => number): Easing => fn as unknown as Easing;

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
  const reducedMotion = usePrefersReducedMotion();
  if (data.length === 0) return null;
  const rows = toRows(data, pastCount);
  const tickTimes = data.filter((p) => p.tick).map((p) => p.time);
  const monthByTime = new Map(data.map((p) => [p.time, p.month]));
  const visible = visibleSeriesKeys(data);
  const ticks = niceTicks(
    data.flatMap((p) => [
      Math.max(0, p.savings) + p.investments + p.receivables,
      -p.debt,
      p.netWorth,
    ])
  );
  const owesAnything = data.some((p) => moneySign(p.debt) > 0);
  const savings = dashboardSeries("savings").color;
  const debt = dashboardSeries("debt").color;
  // A projected month is the same series, dashed and fainter: the plan's
  // guess, not a balance anyone has seen.
  // A part that is $0 at every point draws nothing — its outline would lie
  // along the stack — except cash, which always shows, flat on zero.
  const present = (key: Plotted): boolean =>
    key === "savingsAbove" ||
    rows.some((r) => moneySign(r[`${key}Past`] ?? r[`${key}Ahead`] ?? 0) !== 0);
  const area = (key: Plotted, stack: "assets" | "debts", color: string, ahead: boolean) =>
    present(key) && (
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
      isAnimationActive={!reducedMotion}
      // The card's clock (see dashboard-motion): each area sweeps in on
      // the standard curve, in its turn.
      animationBegin={drawDelay(AREA_PART[key])}
      animationDuration={SWEEP_MS}
      animationEasing={asEasing(sweepEasing)}
    />
  );
  const halves = [false, true].flatMap((ahead) => [
    area("savingsAbove", "assets", savings, ahead),
    area("receivables", "assets", dashboardSeries("receivables").color, ahead),
    area("investments", "assets", dashboardSeries("investments").color, ahead),
    area("savingsBelow", "debts", savings, ahead),
    area("debtBelow", "debts", debt, ahead),
  ]);
  // Net worth draws last, past first and then the projection, as one eased
  // stroke: each half animates along its own length, so `splitEasedStroke`
  // gives each its slice of the time and of the curve. recharts keeps the
  // projection's dashes while it draws.
  const first = data[0].time;
  const span = Math.max(1, data[data.length - 1].time - first);
  const stroke = splitEasedStroke((data[pastCount].time - first) / span, SWEEP_MS);
  const lineBegin = drawDelay("netWorth");
  const netWorth = (ahead: boolean, glow: boolean) => (
    <Line
      key={`netWorth-${ahead ? "ahead" : "past"}${glow ? "-glow" : ""}`}
      dataKey={ahead ? "netWorthAhead" : "netWorthPast"}
      type="monotone"
      stroke={dashboardSeries("netWorth").color}
      // A wide, faint copy under the line: the highlight that makes net
      // worth the series the eye lands on.
      strokeWidth={glow ? 8 : 2.5}
      strokeOpacity={glow ? 0.18 : 1}
      strokeLinecap="round"
      strokeDasharray={ahead && !glow ? PROJECTED_DASH : undefined}
      dot={false}
      activeDot={glow ? false : { r: 3 }}
      isAnimationActive={!reducedMotion}
      animationEasing={asEasing(ahead ? stroke.second.easing : stroke.first.easing)}
      animationBegin={lineBegin + (ahead ? stroke.second.delay : 0)}
      animationDuration={ahead ? stroke.second.duration : stroke.first.duration}
    />
  );
  return (
    <ChartContainer config={chartConfig} className={cn("aspect-auto h-48 w-full", className)}>
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
        {netWorth(false, true)}
        {netWorth(true, true)}
        {netWorth(false, false)}
        {netWorth(true, false)}
      </ComposedChart>
    </ChartContainer>
  );
}
