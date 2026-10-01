"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { StatCard, maskValue, statToneClass } from "@/components/ui/stat-card";
import { formatCurrency, formatPercent, formatSignedPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { formatUnits } from "@/components/portfolio/figures";
import type { InvestorBreakdown as InvestorBreakdownRow } from "@/types/margin";

/**
 * Per-person drill-down: what each investor put in, what their money actually
 * bought, and what it costs to keep the promise made to them.
 *
 * `profitLoss` here is the OWNER's number, not the investor's. The investor's
 * return is fixed and never varies; what varies is whether their money earned
 * enough to cover it. Selecting a person answers exactly that.
 */
export function InvestorBreakdown({
  rows,
  hideValues = false,
}: {
  rows: InvestorBreakdownRow[];
  hideValues?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (rows.length === 0) {
    return <EmptyState icon={Users} title="Nobody has invested yet" />;
  }

  const money = (v: number | null): string => {
    if (v === null) return "—";
    const formatted = formatCurrency(v);
    return hideValues ? maskValue(formatted) : formatted;
  };

  const active = rows.find((r) => r.investorId === selected) ?? null;
  // Each chip shows the person's share of the pool, so masked mode still says
  // who carries most of the money.
  const totalContributed = rows.reduce((sum, r) => sum + r.contributed, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* One person at a time; picking the active chip again clears it.
          Chips size to their content and wrap: the group's items are
          `flex-1 min-w-0` by default, which squeezed three long names onto one
          phone-width row until they overlapped. */}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Investor"
        className="w-full"
        value={selected ?? ""}
        onValueChange={(v) => setSelected(v || null)}
      >
        {rows.map((r) => (
          <ToggleGroupItem
            key={r.investorId}
            value={r.investorId}
            className="max-w-full flex-none gap-2"
          >
            <span className="min-w-0 truncate">{r.name}</span>
            {r.isOwn && <Badge variant="secondary">you</Badge>}
            <Mono
              className={cn(
                "text-2xs tabular-nums",
                r.isOwn ? "" : statToneClass(r.profitLoss >= 0 ? "positive" : "negative")
              )}
            >
              {money(r.contributed)}
              {totalContributed > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  {formatPercent((r.contributed / totalContributed) * 100, 0)}
                </span>
              )}
            </Mono>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {active ? (
        <>
          <div className="@container">
            {/* Columns follow the width the grid actually has, not the viewport: at
               1024px the sidebar leaves ~670px, and four cards there clipped every
               figure mid-number. */}
            <div className="grid gap-4 @md:grid-cols-2 @4xl:grid-cols-4">
              <StatCard
                label="Contributed"
                value={money(active.contributed)}
                percent={active.contributed > 0 ? "100%" : undefined}
                sublabel={
                  active.withdrawn > 0
                    ? `Net of ${money(active.withdrawn)} withdrawn`
                    : "Cash put in"
                }
              />
              <StatCard
                label={active.isOwn ? "Your balance" : "You owe them"}
                value={money(active.owed)}
                percent={
                  active.contributed > 0
                    ? formatSignedPercent(
                        ((active.owed - active.contributed) / active.contributed) * 100,
                        1
                      )
                    : undefined
                }
              />
              <StatCard
                label="Their money is worth"
                value={money(active.positionValue)}
                percent={
                  active.contributed > 0
                    ? formatSignedPercent(
                        ((active.positionValue - active.contributed) / active.contributed) *
                          100,
                        1
                      )
                    : undefined
                }
                tone={active.positionValue >= active.contributed ? "positive" : "negative"}
              />
              <StatCard
                label={active.isOwn ? "Gain on your own" : "Your margin on them"}
                value={money(active.profitLoss)}
                percent={
                  active.owed > 0
                    ? formatSignedPercent((active.profitLoss / active.owed) * 100, 1)
                    : undefined
                }
                tone={active.profitLoss >= 0 ? "positive" : "negative"}
              />
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <Text variant="small">
                {active.isOwn
                  ? "Your own money in your own method — capital, not debt. It is excluded from the margin, which measures only what is left after paying everyone else."
                  : `${active.name} is owed a fixed return whatever happens. This compares that promise against what their money actually bought.`}
              </Text>

              {active.positions.length > 0 && (
                <Positions positions={active.positions} money={money} hideValues={hideValues} />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Text variant="small">
          Pick someone to see what their money bought and what it costs you.
        </Text>
      )}
    </div>
  );
}

function Positions({
  positions,
  money,
  hideValues,
}: {
  positions: InvestorBreakdownRow["positions"];
  money: (v: number | null) => string;
  hideValues: boolean;
}) {
  // Units times the (public) price is the amount, so masked mode masks units.
  const units = (q: number): string =>
    hideValues ? maskValue(formatUnits(q)) : formatUnits(q);
  const rows = positions.map((p) => {
    const pl = p.value === null ? null : p.value - p.invested;
    const tone = statToneClass(pl === null ? "neutral" : pl >= 0 ? "positive" : "negative");
    const share =
      pl !== null && p.invested > 0 ? formatSignedPercent((pl / p.invested) * 100, 1) : null;
    return { p, pl, tone, share };
  });

  // Sized by the card, not the viewport: six columns do not fit a phone, and
  // a table scrolled sideways inside a card hides the figure that matters.
  return (
    <div className="@container">
      <ul className="flex flex-col divide-y @xl:hidden">
        {rows.map(({ p, pl, tone, share }) => (
          <li key={p.symbol} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <Mono className="text-xs font-medium">{p.symbol}</Mono>
                <Text as="span" variant="small" className="truncate text-2xs">
                  {p.name}
                </Text>
              </div>
              <Mono className="shrink-0 text-xs">
                {units(p.quantity)} @ {p.price === null ? "—" : formatCurrency(p.price)}
              </Mono>
            </div>
            <dl className="grid grid-cols-3 gap-x-3">
              <div className="flex flex-col gap-1">
                <dt>
                  <Eyebrow as="span" size="sm">
                    Invested
                  </Eyebrow>
                </dt>
                <dd>
                  <Mono className="text-xs">{money(p.invested)}</Mono>
                </dd>
              </div>
              <div className="flex flex-col gap-1 text-center">
                <dt>
                  <Eyebrow as="span" size="sm">
                    Value
                  </Eyebrow>
                </dt>
                <dd>
                  <Mono className="text-xs">{money(p.value)}</Mono>
                </dd>
              </div>
              <div className="flex flex-col gap-1 text-right">
                <dt>
                  <Eyebrow as="span" size="sm">
                    P/L
                  </Eyebrow>
                </dt>
                <dd>
                  <Mono className={cn("text-xs", tone)}>{money(pl)}</Mono>
                  {share && <Mono className={cn("block text-2xs", tone)}>{share}</Mono>}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden @xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Invested</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">P/L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ p, pl, tone, share }) => (
              <TableRow key={p.symbol}>
                <TableCell>
                  <Mono className="text-xs font-medium">{p.symbol}</Mono>
                  <Text variant="small" className="text-2xs">
                    {p.name}
                  </Text>
                </TableCell>
                <TableCell className="text-right">
                  <Mono className="text-xs">{units(p.quantity)}</Mono>
                </TableCell>
                <TableCell className="text-right">
                  <Mono className="text-xs">{money(p.invested)}</Mono>
                </TableCell>
                <TableCell className="text-right">
                  <Mono className="text-xs">
                    {p.price === null ? "—" : formatCurrency(p.price)}
                  </Mono>
                </TableCell>
                <TableCell className="text-right">
                  <Mono className="text-xs">{money(p.value)}</Mono>
                </TableCell>
                <TableCell className="text-right">
                  <Mono className={cn("text-xs", tone)}>{money(pl)}</Mono>
                  {share && <Mono className={cn("block text-2xs", tone)}>{share}</Mono>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
