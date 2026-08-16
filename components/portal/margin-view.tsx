"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard, maskValue, statToneClass } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mono, Text } from "@/components/ui/typography";
import { repriceContributionsAction } from "@/app/actions/allocations";
import type { MethodMargin } from "@/lib/finance/margin";
import { formatCurrency } from "@/lib/utils/format";
import { AllocationDialog, type AssetOption } from "./allocation-dialog";

export type MethodAllocationSummary = {
  methodId: string;
  allocations: { assetId: string; symbol: string; percent: number }[];
};

export type MarginViewProps = {
  methods: MethodMargin[];
  totals: { liability: number; assets: number; margin: number; incomplete: boolean };
  unconfigured: boolean;
  assets: AssetOption[];
  allocations: MethodAllocationSummary[];
  hideValues?: boolean;
};

function show(value: number, hidden: boolean): string {
  const formatted = formatCurrency(value);
  return hidden ? maskValue(formatted) : formatted;
}

/**
 * The owner's side of the deal: what the pooled capital is really worth
 * against what was promised to the people who put it in.
 *
 * Positions here are derived — each contribution bought units at that day's
 * price — so nothing in this table is hand-editable. What IS editable is the
 * allocation: the rule deciding where the next contribution goes.
 */
export function MarginView({
  methods,
  totals,
  unconfigured,
  assets,
  allocations,
  hideValues = false,
}: MarginViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ methodId: string; methodName: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const allocationFor = (methodId: string) =>
    allocations.find((a) => a.methodId === methodId)?.allocations ?? [];

  const reprice = () => {
    startTransition(async () => {
      const result = await repriceContributionsAction();
      if (!result?.success) {
        toast.error(result?.error ?? "Could not reprice");
        return;
      }
      const { priced, skipped, errors } = result.data ?? {
        priced: 0,
        skipped: 0,
        errors: [] as string[],
      };
      if (priced > 0) toast.success(`Priced ${priced} contribution split(s)`);
      else if (errors.length > 0) toast.error(errors[0]);
      else toast.info(`Nothing new to price (${skipped} already done)`);
      router.refresh();
    });
  };

  if (methods.length === 0) {
    return (
      <EmptyState
        title="No investment methods yet"
        description="Margin appears once you own a method that other people invest in."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Deployed value"
          value={show(totals.assets, hideValues)}
          sublabel="What the holdings are worth today"
        />
        <StatCard
          label="Owed to investors"
          value={show(totals.liability, hideValues)}
          sublabel="Their promised return, compounded"
        />
        <StatCard
          label="Margin"
          value={show(totals.margin, hideValues)}
          tone={totals.margin >= 0 ? "positive" : "negative"}
          sublabel={
            totals.margin >= 0
              ? "Yours after paying everyone"
              : "You are covering the promise out of pocket"
          }
        />
      </div>

      {totals.incomplete && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <Text className="text-sm">
            Some holdings have no price yet, so the deployed value is understated and the
            margin reads worse than it is. Prices refresh once a day.
          </Text>
        </div>
      )}

      {unconfigured && (
        <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
          <Text className="text-sm text-muted-foreground">
            No contribution has been priced yet. Set each method&apos;s allocation, then
            reprice — every past contribution gets valued at the price on the day it
            landed.
          </Text>
          <Button size="sm" variant="outline" onClick={reprice} disabled={isPending}>
            <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
            Reprice contributions
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {methods.map((method) => {
          const policy = allocationFor(method.methodId);
          return (
            <Card key={method.methodId}>
              <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{method.methodName}</CardTitle>
                  <Text className="text-xs text-muted-foreground">
                    Owes {show(method.liability, hideValues)}
                    {method.ownPosition > 0 && (
                      <> · your own {show(method.ownPosition, hideValues)} is capital, not debt</>
                    )}
                  </Text>
                  {policy.length > 0 && (
                    <Text className="text-2xs text-muted-foreground">
                      New money →{" "}
                      {policy.map((p) => `${p.percent}% ${p.symbol}`).join(" · ")}
                    </Text>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Mono
                      className={`text-lg font-semibold tabular-nums ${statToneClass(
                        method.margin >= 0 ? "positive" : "negative"
                      )}`}
                    >
                      {show(method.margin, hideValues)}
                    </Mono>
                    <Text className="text-2xs text-muted-foreground">
                      {method.liability > 0
                        ? `${method.marginPercent >= 0 ? "+" : ""}${method.marginPercent.toFixed(1)}% vs owed`
                        : "nothing owed"}
                    </Text>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        methodId: method.methodId,
                        methodName: method.methodName,
                      })
                    }
                  >
                    <SlidersHorizontal className="size-4" />
                    Allocation
                  </Button>
                </div>
              </CardHeader>

              {method.holdings.length > 0 && (
                <CardContent>
                  <div className="relative overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Asset</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                          <TableHead className="text-right">Invested</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">P/L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {method.holdings.map((h) => {
                          const value = h.price === null ? null : h.quantity * h.price;
                          const pl = value === null ? null : value - h.costBasis;
                          return (
                            <TableRow key={h.id}>
                              <TableCell>
                                <Mono className="text-xs font-medium">{h.symbol}</Mono>
                                <Text className="text-2xs text-muted-foreground">
                                  {h.name}
                                </Text>
                              </TableCell>
                              <TableCell className="text-right">
                                <Mono className="text-xs tabular-nums">
                                  {h.quantity.toLocaleString(undefined, {
                                    maximumFractionDigits: 4,
                                  })}
                                </Mono>
                              </TableCell>
                              <TableCell className="text-right">
                                <Mono className="text-xs tabular-nums">
                                  {show(h.costBasis, hideValues)}
                                </Mono>
                              </TableCell>
                              <TableCell className="text-right">
                                {h.price === null ? (
                                  <Badge variant="outline" className="text-2xs">
                                    no price
                                  </Badge>
                                ) : (
                                  <Mono className="text-xs tabular-nums">
                                    {formatCurrency(h.price)}
                                  </Mono>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Mono className="text-xs tabular-nums">
                                  {value === null ? "—" : show(value, hideValues)}
                                </Mono>
                              </TableCell>
                              <TableCell className="text-right">
                                <Mono
                                  className={`text-xs tabular-nums ${statToneClass(
                                    pl === null ? "neutral" : pl >= 0 ? "positive" : "negative"
                                  )}`}
                                >
                                  {pl === null ? "—" : show(pl, hideValues)}
                                </Mono>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {!unconfigured && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={reprice} disabled={isPending}>
            <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
            Reprice new contributions
          </Button>
        </div>
      )}

      {editing && (
        <AllocationDialog
          open
          methodId={editing.methodId}
          methodName={editing.methodName}
          assets={assets}
          initial={allocationFor(editing.methodId)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
