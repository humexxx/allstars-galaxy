"use client";

import { useMemo } from "react";
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

// Custom Recharts label for the milestone ReferenceLines. Wires the SVG
// <text> through shadcn's Tooltip (Radix-based) so hovering shows the
// "how far away" tip almost instantly — the native SVG <title> element
// has a fixed browser delay (~500 ms+) that can't be tuned.
function MilestoneLabel(props: {
  milestone: number;
  tooltip: string;
  viewBox?: { x?: number; y?: number };
}) {
  const x = props.viewBox?.x ?? 0;
  const y = (props.viewBox?.y ?? 0) - 4;
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <text
          x={x}
          y={y}
          textAnchor="middle"
          fill="currentColor"
          fontSize={11}
          fontWeight={500}
          style={{ cursor: "help" }}
        >
          {formatMoneyTick(props.milestone)}
        </text>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {props.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

type ProjectionChartProps = {
  projection: Projection;
  /** How many months of the projection to plot (controlled by the slider above). */
  monthsToShow?: number;
  /** Index inside the rendered slice marking the past/future split. Indexes
   *  before this go solid; this index and after go dashed. */
  pastCount?: number;
  /** Where in the projection to start the slice. Lets the caller surface a
   *  windowed view (e.g. 3 past + 9 future) instead of always projection[0..N]. */
  startIndex?: number;
};

// Sensible default when the caller doesn't pass a value.
const DEFAULT_MONTHS_TO_SHOW = 12;

export function ProjectionChart({
  projection,
  monthsToShow = DEFAULT_MONTHS_TO_SHOW,
  pastCount = 0,
  startIndex = 0,
}: ProjectionChartProps) {
  // Line color follows the plan's chosen colour token so users can tell their
  // plans apart at a glance. Falls back to the chart-1 token when the plan
  // doesn't have one set yet.
  const lineColor = projection.plan.color || "var(--chart-1)";

  // Build the slice + per-point split between past (solid) and future (dashed).
  // We use a numeric x-axis (each row's `idx` is its x coordinate) so milestone
  // markers can land at the EXACT fractional crossing point between months
  // instead of snapping to the nearest data point. That avoids two milestones
  // collapsing onto the same month when both cross between the same pair of
  // points.
  const { data, crossings } = useMemo(() => {
    const count = Math.max(
      1,
      Math.min(monthsToShow, projection.months.length - startIndex)
    );
    const slice = projection.months.slice(startIndex, startIndex + count);
    const rows = slice.map((m, i) => {
      const value = Number(m.netWorth.toFixed(2));
      const isPast = i < pastCount;
      const isFuture = i > pastCount;
      const isBoundary = i === pastCount;
      return {
        idx: i,
        monthLabel: MONTH_FORMATTER.format(m.date),
        // pastValue and futureValue overlap at the boundary to keep the line
        // visually continuous when one rendered series ends and the other
        // begins.
        pastValue: isPast || isBoundary ? value : null,
        futureValue: isFuture || isBoundary ? value : null,
        rawValue: value,
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
  }, [projection.months, monthsToShow, startIndex, pastCount]);

  const xMax = Math.max(0, data.length - 1);

  return (
    <ChartContainer config={config} className="h-80 w-full">
      <LineChart
        data={data}
        margin={{ left: 10, right: 20, top: 30, bottom: 0 }}
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
        <ChartTooltip content={<ChartTooltipContent />} />

        {/* Past — solid line + filled dots. Labels are reserved for milestone
            crossings rendered above, so the dots stay clean. */}
        <Line
          dataKey="pastValue"
          name="Net worth"
          type="monotone"
          stroke={lineColor}
          strokeWidth={2}
          isAnimationActive={false}
          connectNulls={false}
          dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />

        {/* Future — dashed, same colour so the line still reads as one trend. */}
        <Line
          dataKey="futureValue"
          name="Net worth"
          type="monotone"
          stroke={lineColor}
          strokeWidth={2}
          strokeDasharray="6 4"
          isAnimationActive={false}
          connectNulls={false}
          dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

type CompareChartProps = {
  projections: Projection[];
  metric: "netWorth" | "totalDebt" | "savings";
};

export function ComparePlansChart({ projections, metric }: CompareChartProps) {
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
    <ChartContainer config={compareConfig} className="h-96 w-full">
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
