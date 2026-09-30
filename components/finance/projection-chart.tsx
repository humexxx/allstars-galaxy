"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildCompareRows,
  milestoneCrossings,
  type PlanTimeline,
} from "@/lib/finance/chart-series";
import { DEFAULT_FINANCE_MILESTONES } from "@/lib/finance/milestones";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/format";
import type { ChartConfig } from "@/types/chart";
import type { FinancePlan } from "@/types/finance";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

// Format projection dates in UTC — the projection generates months at UTC
// midnight, so any local timezone with a negative offset would shift the
// formatted month back a day and show e.g. "Apr" for a "May 2026" bucket.
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});


// Stable chart config — the line stroke is overridden per-plan inside the
// component so this only needs the label.
const config = {
  netWorth: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Axis ticks and milestone labels: "$350k", "$1.5M".
const formatMoneyTick = formatCurrencyCompact;

// Friendly distance-from-today string for milestone tooltips. Whole months
// only — fractional months feel awkward in a casual hover tip.
function formatTimeGap(monthsFromToday: number): string {
  const rounded = Math.round(monthsFromToday);
  if (rounded === 0) return "around today";
  if (rounded > 0) {
    return rounded === 1 ? "in about 1 month" : `in about ${rounded} months`;
  }
  const abs = Math.abs(rounded);
  return abs === 1 ? "1 month ago" : `${abs} months ago`;
}

// Custom Recharts label for the milestone ReferenceLines. We render the label
// inside a <foreignObject> so the trigger is an HTML <span>, not an SVG
// <text> — Radix Tooltip's asChild via Slot doesn't reliably forward pointer
// events onto SVG elements, so the hover never registered. With HTML inside
// the foreignObject, the shadcn Tooltip works natively and appears with the
// configured delayDuration (100 ms).
const LABEL_WIDTH = 80;
const LABEL_WIDTH_NARROW = 56;
const LABEL_HEIGHT = 18;
// Narrow-container threshold for the responsive chart bits (px). 640 tracks
// Tailwind's `sm` breakpoint, applied to the CHART's width, not the viewport —
// the chart also narrows inside the desktop 3/4-column layout.
const NARROW_CONTAINER = 640;

function MilestoneLabel(props: {
  milestone: number;
  tooltip: string;
  widthPx: number;
  viewBox?: { x?: number; y?: number };
}) {
  // (viewBox.x, viewBox.y) is the top of the vertical reference line. Centre
  // the label horizontally on the line and nudge it just above the top. Every
  // label uses the same offset, so they all read along one line.
  const cx = props.viewBox?.x ?? 0;
  const top = (props.viewBox?.y ?? 0) - LABEL_HEIGHT - 2;
  return (
    <foreignObject
      x={cx - props.widthPx / 2}
      y={top}
      width={props.widthPx}
      height={LABEL_HEIGHT}
      style={{ overflow: "visible" }}
    >
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          {/* Focusable so the time-gap tip is reachable without a pointer. */}
          <span
            tabIndex={0}
            className="block cursor-help rounded-sm text-center text-2xs font-medium leading-none text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {formatMoneyTick(props.milestone)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {props.tooltip}
        </TooltipContent>
      </Tooltip>
    </foreignObject>
  );
}

// Full-precision money for the hover tooltip ("-$52,102.02"), the same form
// the sidebar beside the chart uses. The axis ticks use the compact formatter.
const formatMoneyFull = formatCurrency;

// One labelled line inside the custom tooltip: colour swatch + label on the
// left, right-aligned mono value.
function TooltipRow({
  swatch,
  label,
  value,
  valueClass,
}: {
  swatch: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-xs"
          style={{ backgroundColor: swatch }}
        />
        {label}
      </span>
      <span className={cn("font-mono tabular-nums text-foreground", valueClass)}>
        {value}
      </span>
    </div>
  );
}

type ChartRow = {
  idx: number;
  monthLabel: string;
  pastValue: number | null;
  futureValue: number | null;
  rawValue: number;
  totalDebt?: number;
  investments?: number;
  /** Base plan's net worth at this period (scenario ghost line). */
  ghostValue: number | null;
  /** Portfolio series, split past/future like the net-worth line. */
  portfolioPast: number | null;
  portfolioFuture: number | null;
  portfolioRaw: number | null;
};

// Custom tooltip. The past (solid) and future (dashed) series OVERLAP at the
// boundary index (today) to keep the line continuous, so that point would show
// "Net worth" twice with the default content. We instead read the underlying
// data row ONCE and render: Net worth always, Debt only when > 0, Investments
// only when > 0. Debt/investments ride along on the row but are NOT plotted.
function PointTooltip(props: {
  active?: boolean;
  payload?: Array<{ value: number | null; payload: ChartRow }>;
  lineColor: string;
  ghostLabel?: string;
}) {
  const { active, payload, lineColor, ghostLabel } = props;
  if (!active || !payload?.length) return null;
  const row = payload.find((p) => p?.value != null)?.payload;
  if (!row) return null;

  const debt = row.totalDebt ?? 0;
  const investments = row.investments ?? 0;
  const portfolio = row.portfolioRaw;
  const ghost = row.ghostValue;
  const delta = ghost != null ? row.rawValue - ghost : null;

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{row.monthLabel}</div>
      <div className="grid gap-1">
        <TooltipRow
          swatch={lineColor}
          label="Net worth"
          value={formatMoneyFull(row.rawValue)}
          valueClass={row.rawValue < 0 ? "text-destructive" : "text-success"}
        />
        {debt > 0 && (
          <TooltipRow
            swatch="var(--destructive)"
            label="Debt"
            value={formatMoneyFull(debt)}
            valueClass="text-destructive"
          />
        )}
        {investments > 0 && (
          <TooltipRow
            swatch="var(--success)"
            label="Investments"
            value={formatMoneyFull(investments)}
            valueClass="text-success"
          />
        )}
        {portfolio != null && portfolio > 0 && (
          <TooltipRow
            swatch="var(--chart-4)"
            label="Portfolio"
            value={formatMoneyFull(portfolio)}
          />
        )}
        {ghost != null && delta != null && (
          <TooltipRow
            swatch="var(--muted-foreground)"
            label={ghostLabel ?? "Base plan"}
            value={`${formatMoneyFull(ghost)} (${delta >= 0 ? "+" : "−"}${formatMoneyFull(Math.abs(delta))})`}
            valueClass={delta >= 0 ? "text-success" : "text-destructive"}
          />
        )}
      </div>
    </div>
  );
}

// Minimal shape of the props Recharts hands a custom `dot` renderer.
type DotRenderProps = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { idx?: number };
};

// Pulsing "you are here" marker for today's point: a solid dot with an
// expanding, fading ring (SMIL — self-contained, no global CSS needed). SMIL
// ignores `prefers-reduced-motion`, so the ring is left out when it is set.
function TodayPulseDot({
  cx,
  cy,
  color,
}: {
  cx: number;
  cy: number;
  color: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <g>
      {!reducedMotion && (
        <circle cx={cx} cy={cy} r={5} fill={color} opacity={0.35}>
          <animate
            attributeName="r"
            values="5;16"
            dur="1.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.4;0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle cx={cx} cy={cy} r={5} fill={color} />
    </g>
  );
}

type ChartPoint = {
  date: Date;
  netWorth: number;
  /** Carried for the hover tooltip only — NOT plotted as lines. */
  totalDebt?: number;
  investments?: number;
};

type ProjectionChartProps = {
  /** Net-worth points to plot, left→right. The caller merges real snapshots
   *  (past) with the projection (future); this component just renders them. */
  points: ChartPoint[];
  /** Index marking the past/future split. Indexes before this go solid (real
   *  / historical), this index and after go dashed (forecast). */
  pastCount?: number;
  /** Plan colour token for the line; falls back to chart-1. */
  color?: string;
  /** Tailwind height class(es) for the chart container. Defaults to `h-80`;
   *  the detail page passes a taller class so the chart reads as the hero. */
  heightClass?: string;
  /** Fires with the hovered point's index (into `points`) while the pointer
   *  moves over the chart, and `null` when it leaves. Lets the page preview
   *  that period's figures elsewhere (e.g. the sidebar cards). */
  onHoverIndex?: (idx: number | null) => void;
  /** Fires with the clicked point's index. Hover previews a period; this is the
   *  commit — the page opens a dialog for it. Omit to leave the chart
   *  read-only (no pointer cursor). */
  onSelectIndex?: (idx: number) => void;
  /** Base plan's net worth aligned per point (scenario ghost line). Nulls skip
   *  the point. Omit to render no ghost. */
  ghostValues?: (number | null)[];
  /** Tooltip label for the ghost series (the base plan's name). */
  ghostLabel?: string;
  /** Portfolio value aligned per point (own series in var(--chart-4)). Nulls
   *  skip the point. Omit to render no portfolio series. */
  portfolioValues?: (number | null)[];
  /** Net-worth milestones to annotate, from the user's global preference.
   *  Every one that the trajectory crosses gets a labelled reference line. */
  milestones?: readonly number[];
};

/**
 * Memoised: the plan editor re-renders on every hovered point (the sidebar
 * previews that period), and the chart's props are stable across those
 * renders, so recharts is spared a full re-render per mouse move.
 */
export const ProjectionChart = memo(function ProjectionChart({
  points,
  pastCount = 0,
  color,
  heightClass = "h-80",
  onHoverIndex,
  onSelectIndex,
  ghostValues,
  ghostLabel,
  portfolioValues,
  milestones = DEFAULT_FINANCE_MILESTONES,
}: ProjectionChartProps) {
  // Only notify the parent when the hovered index actually changes — recharts
  // fires onMouseMove continuously, and re-setting parent state every frame
  // would re-render the whole sidebar per mouse move.
  const lastHoverRef = useRef<number | null>(null);
  const emitHover = (idx: number | null) => {
    if (lastHoverRef.current === idx) return;
    lastHoverRef.current = idx;
    onHoverIndex?.(idx);
  };
  // Line color follows the plan's chosen colour token so users can tell their
  // plans apart at a glance. Falls back to the chart-1 token when the plan
  // doesn't have one set yet.
  const lineColor = color || "var(--chart-1)";

  // Build the per-point split between past (solid) and future (dashed). We use
  // a numeric x-axis (each row's `idx` is its x coordinate) so milestone
  // markers can land at the EXACT fractional crossing point between months
  // instead of snapping to the nearest data point. That avoids two milestones
  // collapsing onto the same month when both cross between the same pair of
  // points.
  const { data, crossings } = useMemo(() => {
    const rows: ChartRow[] = points.map((p, i) => {
      const value = Number(p.netWorth.toFixed(2));
      const isPast = i < pastCount;
      const isFuture = i > pastCount;
      const isBoundary = i === pastCount;
      // Portfolio rides its own line, split past/future like net worth, with
      // the same boundary overlap so the series stays continuous.
      const portfolio = portfolioValues?.[i] ?? null;
      return {
        idx: i,
        monthLabel: MONTH_FORMATTER.format(p.date),
        // pastValue and futureValue overlap at the boundary to keep the line
        // visually continuous when one rendered series ends and the other
        // begins.
        pastValue: isPast || isBoundary ? value : null,
        futureValue: isFuture || isBoundary ? value : null,
        rawValue: value,
        // Tooltip-only extras (never plotted).
        totalDebt: p.totalDebt,
        investments: p.investments,
        ghostValue: ghostValues?.[i] ?? null,
        portfolioPast: portfolio != null && (isPast || isBoundary) ? portfolio : null,
        portfolioFuture:
          portfolio != null && (isFuture || isBoundary) ? portfolio : null,
        portfolioRaw: portfolio,
      };
    });

    // Where the trajectory crosses each milestone (first crossing), with
    // the distance from today counted in CALENDAR months between the points'
    // dates — the x position alone miscounts when the recorded past has gaps.
    const cross = milestoneCrossings(
      points.map((p, i) => ({ date: p.date, value: rows[i].rawValue })),
      pastCount,
      milestones
    ).map((c) => ({
      x: c.x,
      milestone: c.milestone,
      tooltip: `${formatMoneyTick(c.milestone)} — ${formatTimeGap(c.monthsFromToday)}`,
    }));

    return { data: rows, crossings: cross };
  }, [points, pastCount, ghostValues, portfolioValues, milestones]);

  const xMax = Math.max(0, data.length - 1);

  // Measure the rendered container so the milestone-label layout can reason in
  // real pixels (labels have a fixed px width; crossings are in axis units).
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isNarrow = containerWidth !== null && containerWidth < NARROW_CONTAINER;
  const labelWidthPx = isNarrow ? LABEL_WIDTH_NARROW : LABEL_WIDTH;
  const yAxisWidth = isNarrow ? 40 : 48;

  // Every crossing gets a label, all on one row at the same height. There is
  // deliberately no stagger and no drop: the milestone list is user-configured
  // now (Settings → Finance), so how many labels share the axis is the user's
  // call, not something the chart should silently override.
  // Today = the boundary index (pastCount): solid past meets dashed future.
  // Render the pulse there on the PAST series only; the future series skips
  // that index so we don't stack two markers on the same point.
  const renderDot = (isFutureSeries: boolean) => {
    const Dot = (props: DotRenderProps) => {
      const { cx, cy, payload, index } = props;
      const key = `dot-${isFutureSeries ? "f" : "p"}-${index ?? "x"}`;
      if (cx == null || cy == null) return <g key={key} />;
      const isToday = payload?.idx === pastCount;
      if (isToday) {
        return isFutureSeries ? (
          <g key={key} />
        ) : (
          <TodayPulseDot key={key} cx={cx} cy={cy} color={lineColor} />
        );
      }
      return <circle key={key} cx={cx} cy={cy} r={4} fill={lineColor} />;
    };
    return Dot;
  };

  const first = data[0];
  const last = data.at(-1);
  const today = data[pastCount];

  return (
    <div ref={containerRef} className="min-w-0">
      {/* The line in words, for anyone who can't see it. */}
      {first && last && (
        <p className="sr-only">
          Net worth {formatMoneyFull(first.rawValue)} in {first.monthLabel}
          {today && today !== first && today !== last
            ? `, ${formatMoneyFull(today.rawValue)} today (${today.monthLabel})`
            : ""}
          , projected {formatMoneyFull(last.rawValue)} by {last.monthLabel}.
        </p>
      )}
      <ChartContainer config={config} className={cn(heightClass, "w-full")}>
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ left: 10, right: 20, top: 30, bottom: 0 }}
          className={onSelectIndex ? "cursor-pointer" : undefined}
          onMouseMove={(state) => {
            const raw = state?.activeTooltipIndex;
            const idx =
              typeof raw === "number" && raw >= 0 && raw < data.length
                ? raw
                : null;
            emitHover(idx);
          }}
          onMouseLeave={() => emitHover(null)}
          onClick={(state) => {
            if (!onSelectIndex) return;
            // Same index source as the hover handler — recharts resolves the
            // nearest point for us, so a click anywhere in its column counts
            // (the 4px dots would be a brutal target otherwise).
            const raw = (state as { activeTooltipIndex?: number } | undefined)
              ?.activeTooltipIndex;
            if (typeof raw === "number" && raw >= 0 && raw < data.length) {
              onSelectIndex(raw);
            }
          }}
        >
          {/* Horizontal-only grid (vertical={false}) matches the shadcn
              Line-Label example — the vertical milestone markers below carry
              the x-axis storytelling, so we don't double up. */}
          <CartesianGrid vertical={false} strokeOpacity={0.25} />
          <XAxis
            dataKey="idx"
            type="number"
            domain={[0, xMax]}
            ticks={data.map((_, i) => i)}
            tickFormatter={(v: number) => data[Math.round(v)]?.monthLabel ?? ""}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={isNarrow ? 40 : 20}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={yAxisWidth}
            tickFormatter={formatMoneyTick}
          />
          <ReferenceLine
            y={0}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeDasharray="2 2"
          />
          {/* Milestone crossings — vertical dashed line at the EXACT fractional
              x where the trajectory hits the milestone. The numeric x-axis lets
              the line land between months so distinct milestones don't collide.
              Every crossing gets its label, all at the same height — the list
              is user-configured, so the count is their call. Hovering a label
              surfaces the time-gap tooltip ("in about 5 months"). */}
          {crossings.map((c) => (
            <ReferenceLine
              key={c.milestone}
              x={c.x}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeDasharray="4 4"
              label={
                <MilestoneLabel
                  milestone={c.milestone}
                  tooltip={c.tooltip}
                  widthPx={labelWidthPx}
                />
              }
            />
          ))}
          <ChartTooltip
            content={<PointTooltip lineColor={lineColor} ghostLabel={ghostLabel} />}
          />

          {/* Base plan ghost (scenario comparison) — subdued and underneath the
              plan's own lines so it reads as reference, not data. */}
          {ghostValues && (
            <Line
              dataKey="ghostValue"
              name={ghostLabel ?? "Base plan"}
              type="monotone"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              isAnimationActive={false}
              connectNulls
              dot={false}
              activeDot={false}
            />
          )}

          {/* Portfolio — its own series so the user can read how much of the
              net worth is the (growing) portfolio. Solid past, dashed future,
              same convention as the net-worth line. */}
          {portfolioValues && (
            <Line
              dataKey="portfolioPast"
              name="Portfolio"
              type="monotone"
              stroke="var(--chart-4)"
              strokeWidth={1.5}
              isAnimationActive={false}
              connectNulls
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
          {portfolioValues && (
            <Line
              dataKey="portfolioFuture"
              name="Portfolio"
              type="monotone"
              stroke="var(--chart-4)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              isAnimationActive={false}
              connectNulls
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}

          {/* Past — solid line + filled dots. The boundary point (today) renders
              a pulsing marker. Labels are reserved for milestone crossings above,
              so the dots stay clean. */}
          <Line
            dataKey="pastValue"
            name="Net worth"
            type="monotone"
            stroke={lineColor}
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls={false}
            dot={renderDot(false)}
            activeDot={{ r: 6 }}
          />

          {/* Future — dashed, same colour so the line still reads as one trend.
              Skips a dot at the boundary so the past series' pulse stands alone. */}
          <Line
            dataKey="futureValue"
            name="Net worth"
            type="monotone"
            stroke={lineColor}
            strokeWidth={2}
            strokeDasharray="6 4"
            isAnimationActive={false}
            connectNulls={false}
            dot={renderDot(true)}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
});

/**
 * Dot renderer for the comparison chart: nothing anywhere except today's row,
 * where it drops the shared `TodayPulseDot`. Plotting a dot per period would
 * bury the lines once more than one plan is on the chart.
 *
 * `boundary < 0` means no window is applied, so there is no "today" to mark.
 */
function renderTodayDot(color: string, boundary: number, dimmed: boolean) {
  const Dot = (props: {
    cx?: number;
    cy?: number;
    index?: number;
    payload?: { idx?: number };
  }) => {
    const { cx, cy, index, payload } = props;
    const key = `today-${index ?? "x"}`;
    if (cx == null || cy == null || boundary < 0 || payload?.idx !== boundary) {
      return <g key={key} />;
    }
    return (
      <g key={key} opacity={dimmed ? 0.22 : 1}>
        <TodayPulseDot cx={cx} cy={cy} color={color} />
      </g>
    );
  };
  return Dot;
}

/**
 * Tooltip for the comparison chart. Reads the hovered row directly rather than
 * the Recharts payload, because every plan contributes two series (solid past +
 * dashed future) that both carry a value on the boundary row — the default
 * content would list that plan twice there.
 */
function ComparePlansTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, string | number | null> }>;
  seriesByPlan: Array<{ plan: ComparePlan; key: string }>;
}) {
  const { active, payload, seriesByPlan } = props;
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{String(row.month ?? "")}</div>
      <div className="grid gap-1">
        {seriesByPlan.map(({ plan, key }) => {
          const value = row[`${key}Past`] ?? row[`${key}Future`];
          if (value == null) return null;
          return (
            <TooltipRow
              key={key}
              swatch={plan.color}
              label={plan.name}
              value={formatMoneyFull(Number(value))}
              valueClass={Number(value) < 0 ? "text-destructive" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

/** What the comparison chart needs to know about a plan. */
type ComparePlan = Pick<FinancePlan, "id" | "name" | "color">;

/** One plan's line: its timeline (real past + calibrated future). */
export type CompareChartSeries = {
  plan: ComparePlan;
  timeline: PlanTimeline;
};

type CompareChartProps = {
  series: CompareChartSeries[];
  metric: "netWorth" | "totalDebt";
  /** The reader's calendar day — marks the solid/dashed boundary. */
  today: Date;
  /** Tailwind height class(es) for the chart container. Defaults to `h-96`. */
  heightClass?: string;
  /** Tailwind class(es) applied to the legend wrapper — pass e.g.
   *  "hidden sm:flex" when another surface (the workspace rail) already
   *  names and colours each series, so small screens skip the redundancy. */
  legendClassName?: string;
  /** Plan to emphasize: its line thickens while every other one fades back.
   *  Null (the default) draws all lines equally. */
  focusedPlanId?: string | null;
  /** How many months to plot. Omit to draw every month any plan covers. */
  months?: number;
  /** How many of those months sit before today. Ignored without `months`. */
  pastMonths?: number;
};

export function ComparePlansChart({
  series,
  metric,
  today,
  heightClass = "h-96",
  legendClassName,
  focusedPlanId = null,
  months,
  pastMonths = 3,
}: CompareChartProps) {
  // Every derived table below is O(periods × plans) and the parents re-render
  // on each focus change and metric switch, so it is computed once per input.
  const { seriesByPlan, boundary, data, compareConfig, yAxisWidth } = useMemo(() => {
    if (series.length === 0) {
      return { seriesByPlan: [], boundary: -1, data: [], compareConfig: {}, yAxisWidth: 32 };
    }
    // Stable, CSS-safe series keys (series0, series1, …) rather than raw UUIDs.
    const seriesByPlan = series.map((s, i) => ({ plan: s.plan, key: `series${i}` }));

    // Rows are CALENDAR MONTHS and every plan contributes the point whose
    // period starts in that month (see `buildCompareRows`). They used to be
    // joined by array index, which drew a plan that started five months later
    // five months early, and took the window and "today" from the first plan.
    const { rows, boundary } = buildCompareRows(
      series.map((s, i) => ({ key: `series${i}`, timeline: s.timeline })),
      metric,
      today,
      months,
      pastMonths
    );

    const data = rows.map((r, i) => {
      const row: Record<string, string | number | null> = {
        month: MONTH_FORMATTER.format(r.month),
        // Carried so the dot renderer can spot today's row from the payload.
        idx: i,
      };
      for (const { key } of seriesByPlan) {
        // Null where a plan has no point (before it starts, after it ends):
        // the line stops instead of dropping to $0.
        const value = r.values[key] ?? null;
        // The boundary row carries BOTH keys so solid and dashed meet.
        row[`${key}Past`] = boundary < 0 || i <= boundary ? value : null;
        row[`${key}Future`] = boundary >= 0 && i >= boundary ? value : null;
      }
      return row;
    });

    // Keyed by the real dataKeys: ChartLegendContent resolves labels through
    // `item.dataKey`, so a bare `series0` entry would leave the legend swatches
    // unlabelled now that each plan draws `series0Past` + `series0Future`.
    const compareConfig: ChartConfig = seriesByPlan.reduce((acc, { plan, key }) => {
      const entry = { label: plan.name, color: plan.color };
      acc[`${key}Past`] = entry;
      acc[`${key}Future`] = entry;
      return acc;
    }, {} as ChartConfig);

    // A fixed axis width reserved room for labels that are rarely that wide — on
    // a 375px card that cost ~14% of the plot area. Size it to the widest tick we
    // actually render instead. 8px/glyph is an upper bound for Geist digits at
    // text-xs (measured: "350k" needs 40px including the 4px tick margin — at
    // 7px/glyph it clipped by 4px), and the +10 keeps a little headroom.
    const widestTick = data.reduce((widest, row) => {
      for (const { key } of seriesByPlan) {
        const v = row[`${key}Past`] ?? row[`${key}Future`];
        const label = formatMoneyTick(Number(v) || 0);
        if (label.length > widest.length) widest = label;
      }
      return widest;
    }, "0");
    const yAxisWidth = Math.max(32, widestTick.length * 8 + 10);

    return { seriesByPlan, boundary, data, compareConfig, yAxisWidth };
  }, [series, metric, today, months, pastMonths]);

  if (series.length === 0) return null;

  return (
    <ChartContainer config={compareConfig} className={cn(heightClass, "w-full")}>
      {/* No left margin: the YAxis already reserves its own label gutter, so a
          margin on top of it is pure dead space. */}
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ left: 0, right: 4, top: 10, bottom: 0 }}
      >
        {/* Full grid here (unlike the single-plan chart above, which stays
            horizontal-only because its milestone markers already carry the x
            axis). Kept recessive — dashed and low opacity — so it reads as
            background, never competing with the series. */}
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          width={yAxisWidth}
          tickFormatter={formatMoneyTick}
        />
        {/* Each plan is two series (solid past, dashed future) that overlap at
            today, so the stock tooltip would list every plan twice on that row.
            This one reads the row once instead. */}
        <ChartTooltip
          content={<ComparePlansTooltip seriesByPlan={seriesByPlan} />}
        />
        {/* Explicit payload in plan order. Without it the legend mirrors the
            render order, which we re-sort so the focused line paints on top —
            so the legend would reshuffle every time the pointer moved. */}
        <ChartLegend
          payload={seriesByPlan.map(({ plan, key }) => ({
            dataKey: `${key}Past`,
            value: plan.name,
            type: "line" as const,
            color: plan.color,
          }))}
          content={<ChartLegendContent className={legendClassName} />}
        />
        {/* Recharts paints children in order, so the focused series has to go
            last or the dimmed lines draw over the one we're highlighting. */}
        {[...seriesByPlan]
          .sort(
            (a, b) =>
              Number(a.plan.id === focusedPlanId) -
              Number(b.plan.id === focusedPlanId)
          )
          .flatMap(({ plan, key }) => {
            const dimmed =
              focusedPlanId !== null && plan.id !== focusedPlanId;
            const shared = {
              type: "monotone" as const,
              strokeWidth: dimmed ? 1.5 : focusedPlanId ? 3 : 2,
              strokeOpacity: dimmed ? 0.22 : 1,
              dot: false as const,
              // Recharts animates on every prop change; re-running the 300ms
              // draw-in each time the focus moves makes the rail feel laggy.
              isAnimationActive: false,
              connectNulls: false,
            };
            return [
              <Line
                key={`${key}Past`}
                dataKey={`${key}Past`}
                stroke={`var(--color-${key}Past)`}
                {...shared}
                // "You are here" pulse where solid meets dashed — the same
                // marker the single-plan chart uses. Only on the past series;
                // the future one shares that row and would stack a second one.
                dot={renderTodayDot(
                  `var(--color-${key}Past)`,
                  boundary,
                  dimmed
                )}
              />,
              // Dashed = projected. Kept out of the legend so each plan is
              // named once.
              <Line
                key={`${key}Future`}
                dataKey={`${key}Future`}
                stroke={`var(--color-${key}Future)`}
                legendType="none"
                strokeDasharray="6 4"
                {...shared}
              />,
            ];
          })}
      </LineChart>
    </ChartContainer>
  );
}
