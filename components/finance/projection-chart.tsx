"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  LabelList,
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

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

const NW_COLOR = "#16a34a"; // tailwind green-600

const config = {
  netWorth: { label: "Net worth", color: NW_COLOR },
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
  // Build the slice + per-point split between past (solid) and future (dashed).
  // The boundary point belongs to both series so the two Line components join
  // visually at the same y-value.
  const data = useMemo(() => {
    const count = Math.max(
      1,
      Math.min(monthsToShow, projection.months.length - startIndex)
    );
    return projection.months.slice(startIndex, startIndex + count).map((m, i) => {
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
      };
    });
  }, [projection.months, monthsToShow, startIndex, pastCount]);

  return (
    <ChartContainer config={config} className="h-80 w-full">
      <LineChart data={data} margin={{ left: 10, right: 20, top: 30, bottom: 0 }}>
        {/* Vertical guide lines only — the user explicitly asked for no
            horizontal grid so the chart reads cleaner. */}
        <CartesianGrid
          horizontal={false}
          vertical
          strokeDasharray="3 3"
          strokeOpacity={0.25}
        />
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
        <ChartTooltip content={<ChartTooltipContent />} />

        {/* Past — solid line + filled dots + value labels above each point. */}
        <Line
          dataKey="pastValue"
          name="Net worth"
          type="monotone"
          stroke="var(--color-netWorth)"
          strokeWidth={2}
          isAnimationActive={false}
          connectNulls={false}
          dot={{
            r: 4,
            fill: "var(--color-netWorth)",
            strokeWidth: 0,
          }}
          activeDot={{ r: 6 }}
        >
          <LabelList
            dataKey="pastValue"
            position="top"
            offset={10}
            formatter={(v: unknown) =>
              typeof v === "number" ? formatMoneyTick(v) : ""
            }
            className="fill-foreground text-[11px] font-medium"
          />
        </Line>

        {/* Future — dashed, same color so the line still reads as one trend. */}
        <Line
          dataKey="futureValue"
          name="Net worth"
          type="monotone"
          stroke="var(--color-netWorth)"
          strokeWidth={2}
          strokeDasharray="6 4"
          isAnimationActive={false}
          connectNulls={false}
          dot={{
            r: 4,
            fill: "var(--color-netWorth)",
            strokeWidth: 0,
          }}
          activeDot={{ r: 6 }}
        >
          <LabelList
            dataKey="futureValue"
            position="top"
            offset={10}
            formatter={(v: unknown) =>
              typeof v === "number" ? formatMoneyTick(v) : ""
            }
            className="fill-foreground text-[11px] font-medium"
          />
        </Line>
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
