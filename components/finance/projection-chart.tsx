"use client";

import { useMemo, useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChartConfig } from "@/types/chart";
import type { Projection } from "@/types/finance";

// Format projection dates in UTC — the projection generates months at UTC
// midnight, so any local timezone with a negative offset would shift the
// formatted month back a day and show e.g. "Apr" for a "May 2026" bucket.
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

// Net-worth milestones we annotate on the chart. Picked so they land on the
// values users most often care about; intermediate ticks come from the y-axis.
const MILESTONES = [
  0, 10_000, 20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000,
  5_000_000, 10_000_000,
] as const;

// Stable chart config — the line stroke is overridden per-plan inside the
// component so this only needs the label.
const config = {
  netWorth: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Compact, human-readable money formatter for axis ticks AND on-point labels.
// Examples: 0, 750, 10k, 250k, 1M, 1.5M, 12M.
function formatMoneyTick(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m % 1 < 0.05 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}${k % 1 < 0.05 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

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
const LABEL_HEIGHT = 18;

function MilestoneLabel(props: {
  milestone: number;
  tooltip: string;
  viewBox?: { x?: number; y?: number };
}) {
  // (viewBox.x, viewBox.y) is the top of the vertical reference line. Centre
  // the label horizontally on the line, then nudge it just above the top.
  const cx = props.viewBox?.x ?? 0;
  const top = (props.viewBox?.y ?? 0) - LABEL_HEIGHT - 2;
  return (
    <foreignObject
      x={cx - LABEL_WIDTH / 2}
      y={top}
      width={LABEL_WIDTH}
      height={LABEL_HEIGHT}
      style={{ overflow: "visible" }}
    >
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <span className="block cursor-help text-center text-2xs font-medium leading-none text-foreground">
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

// Full-precision money for the hover tooltip (e.g. -52,102.02). The axis ticks
// use the compact formatter; the tooltip wants the exact figure.
function formatMoneyFull(v: number): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
          className="h-2 w-2 shrink-0 rounded-[2px]"
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
}) {
  const { active, payload, lineColor } = props;
  if (!active || !payload?.length) return null;
  const row = payload.find((p) => p?.value != null)?.payload;
  if (!row) return null;

  const debt = row.totalDebt ?? 0;
  const investments = row.investments ?? 0;

  return (
    <div className="grid min-w-[10rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{row.monthLabel}</div>
      <div className="grid gap-1">
        <TooltipRow
          swatch={lineColor}
          label="Net worth"
          value={formatMoneyFull(row.rawValue)}
          valueClass={row.rawValue < 0 ? "text-rose-600" : "text-emerald-600"}
        />
        {debt > 0 && (
          <TooltipRow
            swatch="#f43f5e"
            label="Debt"
            value={formatMoneyFull(debt)}
            valueClass="text-rose-600"
          />
        )}
        {investments > 0 && (
          <TooltipRow
            swatch="#10b981"
            label="Investments"
            value={formatMoneyFull(investments)}
            valueClass="text-emerald-600"
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
// expanding, fading ring (SMIL — self-contained, no global CSS needed).
function TodayPulseDot({
  cx,
  cy,
  color,
}: {
  cx: number;
  cy: number;
  color: string;
}) {
  return (
    <g>
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
};

export function ProjectionChart({
  points,
  pastCount = 0,
  color,
  heightClass = "h-80",
  onHoverIndex,
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
    const rows = points.map((p, i) => {
      const value = Number(p.netWorth.toFixed(2));
      const isPast = i < pastCount;
      const isFuture = i > pastCount;
      const isBoundary = i === pastCount;
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
      };
    });

    // Linear-interpolate the exact x where the trajectory hits each milestone.
    // Lets us place the marker between two months when the cross happens
    // mid-segment, so distinct milestones don't pile up on the same month.
    // The tooltip captures "how far from today" so users can read the
    // distance to (or since) the milestone without doing the math.
    const cross: { x: number; milestone: number; tooltip: string }[] = [];
    for (const m of MILESTONES) {
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1].rawValue;
        const curr = rows[i].rawValue;
        if ((prev < m && curr >= m) || (prev > m && curr <= m)) {
          const span = curr - prev;
          const t = span === 0 ? 0 : (m - prev) / span;
          const x = i - 1 + Math.max(0, Math.min(1, t));
          const monthsFromToday = x - pastCount;
          cross.push({
            x,
            milestone: m,
            tooltip: `${formatMoneyTick(m)} — ${formatTimeGap(monthsFromToday)}`,
          });
          break;
        }
      }
    }

    return { data: rows, crossings: cross };
  }, [points, pastCount]);

  const xMax = Math.max(0, data.length - 1);

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

  return (
    <ChartContainer config={config} className={`${heightClass} w-full`}>
      <LineChart
        data={data}
        margin={{ left: 10, right: 20, top: 30, bottom: 0 }}
        onMouseMove={(state) => {
          const raw = state?.activeTooltipIndex;
          const idx =
            typeof raw === "number" && raw >= 0 && raw < data.length
              ? raw
              : null;
          emitHover(idx);
        }}
        onMouseLeave={() => emitHover(null)}
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
          minTickGap={20}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
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
            Label is a custom component so hovering surfaces the time-gap
            tooltip ("in about 5 months", "3 months ago"). */}
        {crossings.map((c) => (
          <ReferenceLine
            key={c.milestone}
            x={c.x}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="4 4"
            label={
              <MilestoneLabel milestone={c.milestone} tooltip={c.tooltip} />
            }
          />
        ))}
        <ChartTooltip content={<PointTooltip lineColor={lineColor} />} />

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
  );
}

type CompareChartProps = {
  projections: Projection[];
  metric: "netWorth" | "totalDebt" | "savings";
  /** Tailwind height class(es) for the chart container. Defaults to `h-96`. */
  heightClass?: string;
};

export function ComparePlansChart({
  projections,
  metric,
  heightClass = "h-96",
}: CompareChartProps) {
  if (projections.length === 0) return null;

  // Map each plan to a stable, CSS-safe series key (series0, series1, …) to avoid
  // building CSS custom properties from raw UUIDs.
  const seriesByPlan = projections.map((proj, i) => ({
    proj,
    key: `series${i}`,
  }));

  const maxMonths = Math.max(...projections.map((p) => p.months.length));
  const data = Array.from({ length: maxMonths }, (_, i) => {
    const row: Record<string, string | number> = {
      month: projections[0].months[i]
        ? MONTH_FORMATTER.format(projections[0].months[i].date)
        : `M+${i + 1}`,
    };
    for (const { proj, key } of seriesByPlan) {
      const m = proj.months[i];
      row[key] = m ? Number(m[metric].toFixed(2)) : 0;
    }
    return row;
  });

  const compareConfig: ChartConfig = seriesByPlan.reduce((acc, { proj, key }) => {
    acc[key] = { label: proj.plan.name, color: proj.plan.color };
    return acc;
  }, {} as ChartConfig);

  return (
    <ChartContainer config={compareConfig} className={`${heightClass} w-full`}>
      <LineChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.4} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={70}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()
          }
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {seriesByPlan.map(({ key }) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
