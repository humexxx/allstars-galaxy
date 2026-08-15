"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Mono, Text } from "@/components/ui/typography";
import { formatCurrency } from "@/lib/utils/format";
import type { ChartConfig } from "@/types/chart";

export type ManagedCapital = {
  points: { date: string; own: number; thirdParty: number }[];
  ownContributed: number;
  thirdPartyContributed: number;
  ownHolding: number;
  thirdPartyHolding: number;
};

const config = {
  own: { label: "Yours", color: "var(--chart-1)" },
  thirdParty: { label: "Managed for others", color: "var(--chart-2)" },
} satisfies ChartConfig;

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/**
 * Own vs third-party capital across the methods this admin runs.
 *
 * The chart plots CONTRIBUTED capital accumulating by transaction date, not
 * valuation over time — there is no per-investor historical valuation in the
 * schema, so a value curve would be invented. Present-day holdings sit in the
 * figures above it instead, where they can be labelled honestly.
 *
 * Two distinct hues, never one blended total: the whole point is that the
 * second half is not the owner's money.
 */
export function ManagedCapitalCard({ data }: { data: ManagedCapital }) {
  const totalHolding = data.ownHolding + data.thirdPartyHolding;
  const share =
    totalHolding > 0 ? (data.ownHolding / totalHolding) * 100 : 100;

  const rows = data.points.map((p) => ({
    ...p,
    label: DATE.format(new Date(`${p.date}T00:00:00Z`)),
  }));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <Text variant="small" className="font-medium text-foreground">
              Capital under management
            </Text>
            <Text variant="small" className="text-muted-foreground">
              Present value. Only the first figure is your patrimony.
            </Text>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <Text variant="small" className="text-muted-foreground">
                Yours
              </Text>
              <Mono className="block text-lg font-semibold tabular-nums">
                {formatCurrency(data.ownHolding)}
              </Mono>
            </div>
            <div>
              <Text variant="small" className="text-muted-foreground">
                For others
              </Text>
              <Mono className="block text-lg font-semibold tabular-nums">
                {formatCurrency(data.thirdPartyHolding)}
              </Mono>
            </div>
            <div>
              <Text variant="small" className="text-muted-foreground">
                Total
              </Text>
              <Mono className="block text-lg font-semibold tabular-nums text-muted-foreground">
                {formatCurrency(totalHolding)}
              </Mono>
            </div>
          </div>
        </div>

        {/* Composition bar — the split at a glance, before any chart reading. */}
        <div className="space-y-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              style={{
                width: `${share}%`,
                backgroundColor: "var(--chart-1)",
              }}
            />
            <div
              style={{
                width: `${100 - share}%`,
                backgroundColor: "var(--chart-2)",
              }}
            />
          </div>
          <Text variant="small" className="text-muted-foreground">
            {share.toFixed(1)}% of what you manage is your own.
          </Text>
        </div>

        {rows.length > 1 && (
          <div className="space-y-1">
            <Text variant="small" className="text-muted-foreground">
              Contributed capital over time
            </Text>
            <ChartContainer config={config} className="h-56 w-full sm:h-64">
              <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  dataKey="own"
                  stackId="capital"
                  type="monotone"
                  stroke="var(--color-own)"
                  fill="var(--color-own)"
                  fillOpacity={0.25}
                  isAnimationActive={false}
                />
                <Area
                  dataKey="thirdParty"
                  stackId="capital"
                  type="monotone"
                  stroke="var(--color-thirdParty)"
                  fill="var(--color-thirdParty)"
                  fillOpacity={0.25}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
