"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Filter, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  aggregateManagedCapital,
  filterContributions,
  NO_FILTERS,
  type ManagedCapitalFilters,
  type ManagedContribution,
} from "@/lib/finance/managed-capital";

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
export function ManagedCapitalCard({
  contributions,
  performance,
}: {
  contributions: ManagedContribution[];
  /** The standard portfolio value history, folded into this card so owners
   *  get ONE chart card rather than two stacked ones. Kept as a separate view
   *  rather than a second axis: value and contributed capital are different
   *  measures, and sharing an axis would distort both. */
  performance: React.ReactNode;
}) {
  const [view, setView] = useState<"performance" | "split">("performance");
  // View-only, like the plan chart's third-party toggle: nothing is persisted,
  // and a reload comes back to "everything".
  const [filters, setFilters] = useState<ManagedCapitalFilters>(NO_FILTERS);

  const methods = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contributions) m.set(c.methodId, c.methodName);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [contributions]);

  const investors = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contributions) m.set(c.investorId, c.investorName);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [contributions]);

  const data = useMemo(
    () => aggregateManagedCapital(filterContributions(contributions, filters)),
    [contributions, filters]
  );

  const activeCount = filters.methodIds.length + filters.investorIds.length;
  const toggle = (key: "methodIds" | "investorIds", id: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(id)
        ? f[key].filter((x) => x !== id)
        : [...f[key], id],
    }));

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

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Chart view"
              className="inline-flex items-center gap-1 rounded-md border bg-muted/30 p-1"
            >
              {(["performance", "split"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                    view === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v === "performance" ? "Performance" : "Capital split"}
                </button>
              ))}
            </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-1 size-3.5" />
                Filters
                {activeCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-2xs">
                    {activeCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
              <FilterGroup
                title="Method"
                options={methods}
                selected={filters.methodIds}
                onToggle={(id) => toggle("methodIds", id)}
              />
              <FilterGroup
                title="Investor"
                options={investors}
                selected={filters.investorIds}
                onToggle={(id) => toggle("investorIds", id)}
              />
              {activeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setFilters(NO_FILTERS)}
                >
                  <X className="mr-1 size-3.5" />
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
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

        {view === "performance" ? (
          performance
        ) : (
          <>
        {rows.length === 0 && (
          <Text variant="small" className="text-muted-foreground">
            Nothing matches these filters.
          </Text>
        )}

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
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** One labelled group of checkboxes inside the filter popover. */
function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      <Text variant="small" className="font-medium text-foreground">
        {title}
      </Text>
      <div className="space-y-1.5">
        {options.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={selected.includes(o.id)}
              onCheckedChange={() => onToggle(o.id)}
            />
            <span className="truncate">{o.name}</span>
          </label>
        ))}
      </div>
      {selected.length === 0 && (
        <Text variant="small" className="text-muted-foreground">
          All included.
        </Text>
      )}
    </div>
  );
}
