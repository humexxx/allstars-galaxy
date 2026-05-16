"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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

const config = {
  netWorth: { label: "Net worth", color: "var(--chart-1)" },
  savings: { label: "Savings", color: "var(--chart-2)" },
  totalDebt: { label: "Total debt", color: "var(--chart-3)" },
} satisfies ChartConfig;

type ProjectionChartProps = {
  projection: Projection;
};

export function ProjectionChart({ projection }: ProjectionChartProps) {
  const data = projection.months.map((m) => ({
    month: MONTH_FORMATTER.format(m.date),
    netWorth: Number(m.netWorth.toFixed(2)),
    savings: Number(m.savings.toFixed(2)),
    totalDebt: Number(m.totalDebt.toFixed(2)),
  }));

  return (
    <ChartContainer config={config} className="h-80 w-full">
      <AreaChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
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
        <Area
          dataKey="netWorth"
          type="monotone"
          fill="var(--color-netWorth)"
          fillOpacity={0.3}
          stroke="var(--color-netWorth)"
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
