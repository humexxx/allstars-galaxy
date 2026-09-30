"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartLine, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { maskValue } from "@/components/ui/stat-card";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/format";
import { formatMonthLong } from "@/lib/utils/date";
import { buildMarginHistory } from "@/lib/finance/margin-history";
import { cn } from "@/lib/utils";
import type { MarginHistoryInput } from "@/types/margin";

/** Range options, months back from today; "all" keeps the whole history. */
const RANGES = [
  ["3", "3M"],
  ["6", "6M"],
  ["12", "1Y"],
  ["all", "All"],
] as const;
type RangeValue = (typeof RANGES)[number][0];

const CONFIG = {
  deployed: { label: "Allocations", color: "var(--chart-1)" },
  liability: { label: "Owed to investors", color: "var(--chart-2)" },
} as const;

/**
 * The one chart an owner gets: what the deployed capital is really worth
 * against what is owed, month by month.
 *
 * Both series on one axis on purpose — the gap between them IS the margin, and
 * the whole point is to see it directly rather than infer it from two charts.
 * When Allocations sits below Owed, the promise is being paid out of pocket.
 *
 * Filtering re-derives the series in the browser from the raw contributions,
 * which is why no round trip happens when the filter changes.
 */
export function MarginChart({
  input,
  hideValues = false,
}: {
  input: MarginHistoryInput;
  hideValues?: boolean;
}) {
  const [investorId, setInvestorId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  // Months back from today, or null for everything. Trimming the range is a
  // different question from filtering who is in it, so it gets its own control
  // rather than hiding inside the popover.
  const [range, setRange] = useState<RangeValue>("all");
  const months = range === "all" ? null : Number(range);

  const data = useMemo(() => {
    const keep = <T extends { investorId: string; methodId: string }>(rows: T[]) =>
      rows.filter(
        (r) =>
          (investorId === null || r.investorId === investorId) &&
          (methodId === null || r.methodId === methodId)
      );

    const series = buildMarginHistory({
      contributions: keep(input.contributions),
      liabilities: keep(input.liabilities),
      prices: new Map(input.prices),
      today: input.today,
    });

    // Trim AFTER building: the series has to be derived from every
    // contribution, or a window that starts mid-history would forget the units
    // bought before it and draw a position that never existed.
    return months === null ? series : series.slice(-months);
  }, [input, investorId, methodId, months]);

  const filtered = investorId !== null || methodId !== null;
  const clearFilters = (): void => {
    setInvestorId(null);
    setMethodId(null);
  };

  if (data.length < 2) {
    return filtered ? (
      <EmptyState
        icon={ChartLine}
        title="Nothing to plot for this filter"
        action={
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={ChartLine}
        title="Not enough history yet"
        description="The chart needs at least two months of contributions."
      />
    );
  }

  const latest = data[data.length - 1];
  const money = (v: number): string =>
    hideValues ? maskValue(formatCurrency(v)) : formatCurrency(v);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Eyebrow as="div">
            Margin {filtered && <span className="normal-case tracking-normal">(filtered)</span>}
          </Eyebrow>
          <Mono
            className={cn(
              "text-xl font-semibold tabular-nums sm:text-2xl",
              latest.margin >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {money(latest.margin)}
          </Mono>
          <Text variant="small">
            {money(latest.deployed)} deployed against {money(latest.liability)} owed
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            aria-label="Date range"
            value={range}
            onValueChange={(v) => v && setRange(v as RangeValue)}
          >
            {RANGES.map(([value, label]) => (
              <ToggleGroupItem key={value} value={value} className="font-mono tabular-nums">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal />
                Filters
                {filtered && <span className="text-2xs">on</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-64 flex-col gap-4">
            <FilterGroup
              label="Investor"
              options={input.investors.map((i) => ({
                id: i.id,
                label: i.isOwn ? `${i.name} (you)` : i.name,
              }))}
              value={investorId}
              onChange={setInvestorId}
            />
            <FilterGroup
              label="Method"
              options={input.methods.map((m) => ({ id: m.id, label: m.name }))}
              value={methodId}
              onChange={setMethodId}
            />
            {filtered && (
              <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <ChartContainer config={CONFIG} className="h-64 w-full sm:h-80">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.4} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(m: string) => {
              const [y, mo] = m.split("-");
              return new Date(Number(y), Number(mo) - 1).toLocaleDateString("en-US", {
                month: "short",
              });
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={hideValues ? 8 : 56}
            tickFormatter={(v: number) => (hideValues ? "" : formatCurrencyCompact(v))}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {CONFIG[name as keyof typeof CONFIG]?.label ?? name}
                    </span>
                    <Mono className="tabular-nums">{money(value as number)}</Mono>
                  </span>
                )}
                labelFormatter={(m: string) => formatMonthLong(`${m}-01`)}
              />
            }
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="plainline"
            formatter={(v) => (
              <span className="text-xs text-muted-foreground">
                {CONFIG[v as keyof typeof CONFIG]?.label ?? v}
              </span>
            )}
          />
          <Area
            dataKey="liability"
            type="monotone"
            stroke="var(--color-liability)"
            fill="var(--color-liability)"
            fillOpacity={0.12}
            strokeWidth={2}
          />
          <Area
            dataKey="deployed"
            type="monotone"
            stroke="var(--color-deployed)"
            fill="var(--color-deployed)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>

      <Text variant="small" className="text-2xs">
        Where Allocations sits below Owed, the promised return is being covered out
        of pocket.
      </Text>
    </section>
  );
}

const ALL = "__all__";

/** One-of-many chip row with an "All" chip; picking the active chip again
 *  falls back to All, which is how the filter is cleared from the row. */
function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow as="div" size="sm">
        {label}
      </Eyebrow>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={label}
        value={value ?? ALL}
        onValueChange={(v) => onChange(!v || v === ALL ? null : v)}
      >
        <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
        {options.map((o) => (
          <ToggleGroupItem key={o.id} value={o.id}>
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
