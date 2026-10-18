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
import { Mono, Text } from "@/components/ui/typography";
import { StatCard, maskValue, statToneClass } from "@/components/ui/stat-card";
import { formatCurrency, formatPercent, formatSignedPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { InvestorBreakdown as InvestorBreakdownRow } from "@/types/margin";

const UNITS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

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
      {/* One person at a time; picking the active chip again clears it. */}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Investor"
        value={selected ?? ""}
        onValueChange={(v) => setSelected(v || null)}
      >
        {rows.map((r) => (
          <ToggleGroupItem key={r.investorId} value={r.investorId} className="gap-2">
            {r.name}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Contributed" value={money(active.contributed)} percent="100%" />
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

          <Card>
            <CardContent className="flex flex-col gap-4">
              <Text variant="small">
                {active.isOwn
                  ? "Your own money in your own method — capital, not debt. It is excluded from the margin, which measures only what is left after paying everyone else."
                  : `${active.name} is owed a fixed return whatever happens. This compares that promise against what their money actually bought.`}
              </Text>

              {active.positions.length > 0 && (
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
                    {active.positions.map((p) => {
                      const pl = p.value === null ? null : p.value - p.invested;
                      return (
                        <TableRow key={p.symbol}>
                          <TableCell>
                            <Mono className="text-xs font-medium">{p.symbol}</Mono>
                            <Text variant="small" className="text-2xs">
                              {p.name}
                            </Text>
                          </TableCell>
                          <TableCell className="text-right">
                            <Mono className="text-xs">{UNITS.format(p.quantity)}</Mono>
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
                            <Mono
                              className={cn(
                                "text-xs",
                                statToneClass(
                                  pl === null ? "neutral" : pl >= 0 ? "positive" : "negative"
                                )
                              )}
                            >
                              {money(pl)}
                            </Mono>
                            {pl !== null && p.invested > 0 && (
                              <Mono
                                className={cn(
                                  "block text-2xs",
                                  statToneClass(pl >= 0 ? "positive" : "negative")
                                )}
                              >
                                {formatSignedPercent((pl / p.invested) * 100, 1)}
                              </Mono>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
