"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
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

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

const NW_POSITIVE = "#16a34a"; // tailwind green-600
const NW_NEGATIVE = "#dc2626"; // tailwind red-600

const config = {
  netWorth: { label: "Net worth", color: NW_POSITIVE },
  savings: { label: "Savings", color: "var(--chart-2)" },
  investments: { label: "Investments", color: "var(--chart-4)" },
  totalDebt: { label: "Total debt", color: "var(--chart-3)" },
} satisfies ChartConfig;

type ProjectionChartProps = {
  projection: Projection;
  /** How many months of the projection to plot (controlled by the slider above). */
  monthsToShow?: number;
};

// Sensible default when the caller doesn't pass a value.
const DEFAULT_MONTHS_TO_SHOW = 12;

export function ProjectionChart({
  projection,
  monthsToShow = DEFAULT_MONTHS_TO_SHOW,
}: ProjectionChartProps) {
  // Memoize so hover/tooltip rerenders don't redo this work.
  const { data, hasInvestments, zeroOffset } = useMemo(() => {
    const count = Math.max(1, Math.min(monthsToShow, projection.months.length));
    const rows = projection.months.slice(0, count).map((m) => ({
      month: MONTH_FORMATTER.format(m.date),
      netWorth: Number(m.netWorth.toFixed(2)),
      savings: Number(m.savings.toFixed(2)),
      investments: Number(m.investments.toFixed(2)),
      totalDebt: Number(m.totalDebt.toFixed(2)),
    }));

    const hasInv = rows.some((m) => m.investments > 0.01);

    const all = rows.flatMap((d) => [d.netWorth, d.savings, d.investments, d.totalDebt]);
    const yMax = Math.max(...all, 0);
    const yMin = Math.min(...all, 0);
    const yRange = yMax - yMin;
    const offset = yRange > 0 ? yMax / yRange : yMax > 0 ? 1 : 0;

    return { data: rows, hasInvestments: hasInv, zeroOffset: offset };
  }, [projection.months, monthsToShow]);

  return (
    <ChartContainer config={config} className="h-80 w-full">
      <AreaChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
        <defs>
          {/* Split fill: positive area uses green, negative uses red. Two stops
              at the same offset create a hard color break at y=0. */}
          <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor={NW_POSITIVE} stopOpacity={0.45} />
            <stop offset={zeroOffset} stopColor={NW_POSITIVE} stopOpacity={0.08} />
            <stop offset={zeroOffset} stopColor={NW_NEGATIVE} stopOpacity={0.08} />
            <stop offset={1} stopColor={NW_NEGATIVE} stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id="nwStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset={zeroOffset} stopColor={NW_POSITIVE} stopOpacity={1} />
            <stop offset={zeroOffset} stopColor={NW_NEGATIVE} stopOpacity={1} />
          </linearGradient>
        </defs>
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
        {/* Subtle zero baseline so the green/red split is grounded visually. */}
        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 2" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="netWorth"
          type="monotone"
          fill="url(#nwFill)"
          stroke="url(#nwStroke)"
          strokeWidth={2}
        />
        <Area
          dataKey="savings"
          type="monotone"
          fill="var(--color-savings)"
          fillOpacity={0.15}
          stroke="var(--color-savings)"
          strokeWidth={2}
        />
        {hasInvestments && (
          <Area
            dataKey="investments"
            type="monotone"
            fill="var(--color-investments)"
            fillOpacity={0.15}
            stroke="var(--color-investments)"
            strokeWidth={2}
          />
        )}
        <Area
          dataKey="totalDebt"
          type="monotone"
          fill="var(--color-totalDebt)"
          fillOpacity={0.15}
          stroke="var(--color-totalDebt)"
          strokeWidth={2}
        />
      </AreaChart>
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
