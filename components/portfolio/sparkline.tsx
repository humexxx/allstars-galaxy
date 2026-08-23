"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

type ChartDataPoint = { date: string; value: number };

/**
 * Bare trend line for a stat card: no axes, no grid, no labels.
 *
 * Decorative by design — it answers "which way is this going?", not "what was
 * it in March?". The domain is scaled to the data rather than zero-based so
 * small real movements stay visible; that is the accepted trade-off for a
 * sparkline, and the reason it must never be the only place a figure appears.
 */
export function Sparkline({ data }: { data: ChartDataPoint[] }) {
  if (data.length < 2) return null;

  const first = data[0].value;
  const last = data[data.length - 1].value;
  const colour = last >= first ? "var(--chart-3)" : "var(--chart-2)";

  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            dataKey="value"
            type="monotone"
            stroke={colour}
            strokeWidth={1.5}
            fill={colour}
            fillOpacity={0.12}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
