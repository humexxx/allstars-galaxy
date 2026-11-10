"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartLine, SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { buildMarginHistory, type MarginPoint } from "@/lib/finance/margin-history";
import { cn } from "@/lib/utils";
import { foldForSearch } from "@/lib/utils/text";
import type { MarginHistoryInput } from "@/types/margin";

/** Range options, months back from today; "all" keeps the whole history. */
const RANGES = [
  ["3", "3M"],
  ["6", "6M"],
  ["12", "1Y"],
  ["60", "5Y"],
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
  status,
}: {
  input: MarginHistoryInput;
  hideValues?: boolean;
  /** Rendered in the chart's bottom-right corner — the price freshness. */
  status?: ReactNode;
}) {
  // Empty means everybody / every method.
  const [investorIds, setInvestorIds] = useState<string[]>([]);
  const [methodIds, setMethodIds] = useState<string[]>([]);
  // Months back from today, or null for everything. Trimming the range is a
  // different question from filtering who is in it, so it gets its own control
  // rather than hiding inside the popover.
  const [range, setRange] = useState<RangeValue>("all");
  const months = range === "all" ? null : Number(range);

  const data = useMemo(() => {
    const keep = <T extends { investorId: string; methodId: string }>(rows: T[]) =>
      rows.filter(
        (r) =>
          (investorIds.length === 0 || investorIds.includes(r.investorId)) &&
          (methodIds.length === 0 || methodIds.includes(r.methodId))
      );

    const series = buildMarginHistory({
      contributions: keep(input.contributions),
      liabilities: keep(input.liabilities),
      cashFlows: keep(input.cashFlows),
      prices: new Map(input.prices),
      today: input.today,
    });

    // Trim AFTER building: the series has to be derived from every
    // contribution, or a window that starts mid-history would forget the units
    // bought before it and draw a position that never existed.
    return months === null ? series : series.slice(-months);
  }, [input, investorIds, methodIds, months]);

  const filterCount = investorIds.length + methodIds.length;
  const filtered = filterCount > 0;
  const clearFilters = (): void => {
    setInvestorIds([]);
    setMethodIds([]);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
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
              <ToggleGroupItem key={value} value={value} className="font-mono tabular-nums max-sm:px-3">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal />
                Filters
                {filtered && (
                  <Badge variant="secondary" className="font-mono tabular-nums">
                    {filterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-72 flex-col gap-4">
            <MultiSelectFilter
              label="Investors"
              noun="investor"
              options={input.investors.map((i) => ({
                id: i.id,
                label: i.isOwn ? `${i.name} (you)` : i.name,
              }))}
              value={investorIds}
              onChange={setInvestorIds}
            />
            <MultiSelectFilter
              label="Methods"
              noun="method"
              options={input.methods.map((m) => ({ id: m.id, label: m.name }))}
              value={methodIds}
              onChange={setMethodIds}
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
                formatter={(value, name, item) => (
                  <>
                    <span className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">
                        {CONFIG[name as keyof typeof CONFIG]?.label ?? name}
                      </span>
                      <Mono className="tabular-nums">{money(value as number)}</Mono>
                    </span>
                    {/* The gap between the two lines is the whole point of the
                        chart — say it rather than make the reader subtract. */}
                    {name === "deployed" && (
                      <span className="flex w-full justify-between gap-4 border-t pt-1">
                        <span className="font-medium">Margin</span>
                        <Mono
                          className={cn(
                            "font-medium tabular-nums",
                            (item.payload as MarginPoint).margin >= 0
                              ? "text-success"
                              : "text-destructive"
                          )}
                        >
                          {money((item.payload as MarginPoint).margin)}
                        </Mono>
                      </span>
                    )}
                  </>
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

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Text variant="small" className="text-2xs">
          Where Allocations sits below Owed, the promised return is being covered out
          of pocket.
        </Text>
        {status}
      </div>
    </section>
  );
}

/**
 * Pick any number of options by typing; each pick becomes a chip with its own
 * remove button. Nothing picked means no filter.
 */
function MultiSelectFilter({
  label,
  noun,
  options,
  value,
  onChange,
}: {
  label: string;
  /** Singular, for the input and the empty message ("investor"). */
  noun: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const selected = options.filter((o) => value.includes(o.id));
  const remaining = options.filter((o) => !value.includes(o.id));

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow as="div" size="sm">
        {label}
      </Eyebrow>

      {selected.length === 0 ? (
        <Text variant="small">All {label.toLowerCase()}</Text>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Selected ${label.toLowerCase()}`}>
          {selected.map((o) => (
            <li key={o.id} className="max-w-full">
              <Badge variant="secondary" className="max-w-full gap-1 pr-0.5">
                <span className="truncate">{o.label}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-4 rounded-full"
                  aria-label={`Remove ${o.label}`}
                  onClick={() => onChange(value.filter((id) => id !== o.id))}
                >
                  <X />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {remaining.length > 0 && (
        <Command
          // cmdk names its input after this label (aria-labelledby), which
          // wins over an aria-label on the input itself.
          label={`Add ${noun}`}
          className="rounded-lg! border p-0"
          // By label, ignoring case and accents; cmdk's default scores the
          // item's value, which is an id here.
          filter={(_value, search, keywords) =>
            foldForSearch(keywords?.join(" ") ?? "").includes(foldForSearch(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder={`Add ${noun}…`} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-40">
            <CommandEmpty className="py-3 text-xs">No {noun} matches</CommandEmpty>
            <CommandGroup>
              {remaining.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  keywords={[o.label]}
                  onSelect={() => {
                    onChange([...value, o.id]);
                    // Ready for the next name.
                    setSearch("");
                  }}
                >
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  );
}
