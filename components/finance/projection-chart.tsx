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
  10_000, 20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000,
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
  // The boundary point belongs to both series so the two Line components join
  // visually at the same y-value.
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
        month: MONTH_FORMATTER.format(m.date),
        // pastValue and futureValue overlap at the boundary to keep the line
        // visually continuous when one rendered series ends and the other
        // begins.
        pastValue: isPast || isBoundary ? value : null,
        futureValue: isFuture || isBoundary ? value : null,
        rawValue: value,
      };
    });

    // For each milestone, find the first month where the trajectory crosses it
    // (either direction). We render a dashed vertical line + label at that
    // point instead of labelling every data point.
    const cross: { month: string; milestone: number }[] = [];
    for (const m of MILESTONES) {
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1].rawValue;
        const curr = rows[i].rawValue;
        if ((prev < m && curr >= m) || (prev > m && curr <= m)) {
          cross.push({ month: rows[i].month, milestone: m });
          break;
        }
      }
    }

    return { data: rows, crossings: cross };
  }, [projection.months, monthsToShow, startIndex, pastCount]);

  return (
    <ChartContainer config={config} className="h-80 w-full">
      <LineChart
        data={data}
        margin={{ left: 10, right: 20, top: 30, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="month"
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
        {/* Milestone crossings — full-height vertical line at the month the
            net worth first crosses 10k / 100k / 1M etc., with a label on top. */}
        {crossings.map((c) => (
          <ReferenceLine
            key={`${c.milestone}-${c.month}`}
            x={c.month}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="4 4"
            label={{
              value: formatMoneyTick(c.milestone),
              position: "top",
              fill: "currentColor",
              fontSize: 11,
              fontWeight: 500,
            }}
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
