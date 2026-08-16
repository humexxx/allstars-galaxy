"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mono, Text } from "@/components/ui/typography";
import { maskValue, statToneClass } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type InvestorBreakdownRow = {
  investorId: string;
  name: string;
  isOwn: boolean;
  contributed: number;
  owed: number;
  positionValue: number;
  profitLoss: number;
  positions: {
    symbol: string;
    name: string;
    quantity: number;
    invested: number;
    price: number | null;
    value: number | null;
  }[];
};

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
    return (
      <Text variant="small" className="text-muted-foreground">
        Nobody has invested yet.
      </Text>
    );
  }

  const money = (v: number | null) => {
    if (v === null) return "—";
    const formatted = formatCurrency(v);
    return hideValues ? maskValue(formatted) : formatted;
  };

  const active = rows.find((r) => r.investorId === selected) ?? null;
  // Each chip shows the person's share of the pool, so masked mode still says
  // who carries most of the money.
  const totalContributed = rows.reduce((sum, r) => sum + r.contributed, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <Button
            key={r.investorId}
            variant="outline"
            size="sm"
            data-active={selected === r.investorId}
            className="h-auto rounded-full py-1.5 data-[active=true]:border-foreground/30 data-[active=true]:bg-foreground/5"
            onClick={() =>
              setSelected((cur) => (cur === r.investorId ? null : r.investorId))
            }
          >
            <span className="flex items-center gap-2">
              {r.name}
              {r.isOwn && (
                <Badge variant="secondary" className="text-2xs">
                  you
                </Badge>
              )}
              <Mono
                className={cn(
                  "text-2xs tabular-nums",
                  r.isOwn ? "" : statToneClass(r.profitLoss >= 0 ? "positive" : "negative")
                )}
              >
                {money(r.contributed)}
                {totalContributed > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    {((r.contributed / totalContributed) * 100).toFixed(0)}%
                  </span>
                )}
              </Mono>
            </span>
          </Button>
        ))}
      </div>

      {active ? (
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 sm:grid-cols-4">
              <Figure label="Contributed" value={money(active.contributed)} percent="100%" />
              <Figure
                label={active.isOwn ? "Your balance" : "You owe them"}
                value={money(active.owed)}
                percent={
                  active.contributed > 0
                    ? `+${(
                        ((active.owed - active.contributed) / active.contributed) *
                        100
                      ).toFixed(1)}%`
                    : undefined
                }
              />
              <Figure
                label="Their money is worth"
                value={money(active.positionValue)}
                percent={
                  active.contributed > 0
                    ? `${(
                        ((active.positionValue - active.contributed) / active.contributed) *
                        100
                      ).toFixed(1)}%`
                    : undefined
                }
                tone={
                  active.positionValue >= active.contributed ? "positive" : "negative"
                }
              />
              <Figure
                label={active.isOwn ? "Gain on your own" : "Your margin on them"}
                value={money(active.profitLoss)}
                percent={
                  active.owed > 0
                    ? `${active.profitLoss >= 0 ? "+" : ""}${(
                        (active.profitLoss / active.owed) *
                        100
                      ).toFixed(1)}%`
                    : undefined
                }
                tone={active.profitLoss >= 0 ? "positive" : "negative"}
              />
            </div>

            {active.isOwn ? (
              <Text className="text-xs text-muted-foreground">
                Your own money in your own method — capital, not debt. It is excluded
                from the margin, which measures only what is left after paying
                everyone else.
              </Text>
            ) : (
              <Text className="text-xs text-muted-foreground">
                {active.name} is owed a fixed return whatever happens. This compares
                that promise against what their money actually bought.
              </Text>
            )}

            {active.positions.length > 0 && (
              <div className="relative overflow-x-auto">
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
                            <Text className="text-2xs text-muted-foreground">{p.name}</Text>
                          </TableCell>
                          <TableCell className="text-right">
                            <Mono className="text-xs tabular-nums">
                              {p.quantity.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}
                            </Mono>
                          </TableCell>
                          <TableCell className="text-right">
                            <Mono className="text-xs tabular-nums">{money(p.invested)}</Mono>
                          </TableCell>
                          <TableCell className="text-right">
                            <Mono className="text-xs tabular-nums">
                              {p.price === null ? "—" : formatCurrency(p.price)}
                            </Mono>
                          </TableCell>
                          <TableCell className="text-right">
                            <Mono className="text-xs tabular-nums">{money(p.value)}</Mono>
                          </TableCell>
                          <TableCell className="text-right">
                            <Mono
                              className={cn(
                                "text-xs tabular-nums",
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
                                  "block text-2xs tabular-nums",
                                  statToneClass(pl >= 0 ? "positive" : "negative")
                                )}
                              >
                                {pl >= 0 ? "+" : ""}
                                {((pl / p.invested) * 100).toFixed(1)}%
                              </Mono>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Text variant="small" className="text-muted-foreground">
          Pick someone to see what their money bought and what it costs you.
        </Text>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: string;
  /** Never masked — it is what remains readable once the amount is hidden. */
  percent?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="space-y-1">
      <Text className="text-2xs text-muted-foreground">{label}</Text>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <Mono className={cn("text-lg font-semibold tabular-nums", statToneClass(tone))}>
          {value}
        </Mono>
        {percent && (
          <Mono className={cn("text-xs tabular-nums", statToneClass(tone))}>{percent}</Mono>
        )}
      </div>
    </div>
  );
}
