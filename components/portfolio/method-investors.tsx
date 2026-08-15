"use client";

import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { formatCurrency } from "@/lib/utils/format";
import type { MethodInvestors } from "@/types/portfolio";

/**
 * Who holds money in the methods this admin runs.
 *
 * Deliberately read-only, and deliberately separate from the KPI grid: these
 * are OTHER people's balances. Folding them into the portfolio totals would
 * inflate the owner's patrimony with capital that isn't theirs — the same
 * reason the plan chart keeps third-party money on its own series.
 */
export function MethodInvestorsView({ methods }: { methods: MethodInvestors[] }) {
  const grandTotal = methods.reduce((s, m) => s + m.totalHolding, 0);
  const people = new Set(
    methods.flatMap((m) => m.investors.map((i) => i.userId))
  ).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Heading level="h5" as="h2">
            Invested in your methods
          </Heading>
          <Text variant="muted">
            Capital other people hold through the methods you run. Not part of
            your own portfolio totals.
          </Text>
        </div>
        <div className="text-right">
          <Mono className="text-lg font-semibold tabular-nums">
            {formatCurrency(grandTotal)}
          </Mono>
          <Text variant="small" className="text-muted-foreground">
            {people} {people === 1 ? "investor" : "investors"}
          </Text>
        </div>
      </div>

      {methods.map((m) => (
        <Card key={m.methodId}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Text variant="small" className="font-medium text-foreground">
                  {m.methodName}
                </Text>
                {!m.enabled && (
                  <Badge variant="secondary" className="text-2xs">
                    Disabled
                  </Badge>
                )}
              </span>
              <Mono className="text-sm font-semibold tabular-nums">
                {formatCurrency(m.totalHolding)}
              </Mono>
            </div>

            {m.investors.length === 0 ? (
              <Text variant="small" className="text-muted-foreground">
                <Users className="mr-1 inline size-3.5" />
                Nobody has invested in this one yet.
              </Text>
            ) : (
              <div className="grid gap-1">
                {m.investors.map((i) => {
                  // Share of THIS method, so a small holder in a big method
                  // doesn't read as insignificant overall.
                  const share =
                    m.totalHolding > 0 ? (i.holding / m.totalHolding) * 100 : 0;
                  return (
                    <div
                      key={i.userId}
                      className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0"
                    >
                      <span className="min-w-0">
                        <Text variant="small" className="truncate text-foreground">
                          {i.fullName || i.email || "Unknown user"}
                        </Text>
                        {i.withdrawn > 0 && (
                          <Text variant="small" className="text-muted-foreground">
                            {formatCurrency(i.withdrawn)} withdrawn
                          </Text>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <Mono className="text-sm tabular-nums">
                          {formatCurrency(i.holding)}
                        </Mono>
                        <Text variant="small" className="text-muted-foreground">
                          {share.toFixed(1)}% · {formatCurrency(i.invested)} in
                        </Text>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
