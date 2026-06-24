"use client";

import * as React from "react";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { Pie, PieChart, Label } from "recharts";
import type { ChartConfig } from "@/types/chart";

const chartConfig = {
  value: {
    label: "Value",
  },
} satisfies ChartConfig;

interface AllocationData {
  name: string;
  value: number;
}

export function AllocationChart({ data }: { data?: AllocationData[] }) {
  const chartData = (data || []).map((item, index) => ({
    ...item,
    fill: `var(--chart-${(index % 5) + 1})`,
  }));

  const dynamicConfig = chartData.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: `var(--chart-${(index % 5) + 1})`,
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  const totalValue = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  return (
    <section className="flex h-full flex-col space-y-3">
      <Heading level="h5" as="h2" className="text-muted-foreground">
        Allocation
      </Heading>

      <ChartContainer
        config={{ ...chartConfig, ...dynamicConfig }}
        className="mx-auto aspect-square max-h-[280px] w-full"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={85}
            strokeWidth={5}
          >
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground font-mono text-2xl font-semibold tabular-nums sm:text-3xl"
                      >
                        ${totalValue.toLocaleString()}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 24}
                        className="fill-muted-foreground text-xs uppercase tracking-wide"
                      >
                        Total
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      {chartData.length > 0 && (
        <ul className="space-y-1.5">
          {chartData.map((item) => (
            <li key={item.name} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <Text variant="small" className="min-w-0 flex-1 truncate">
                {item.name}
              </Text>
              <Mono className="tabular-nums text-muted-foreground">
                ${item.value.toLocaleString()}
              </Mono>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
