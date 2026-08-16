"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
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
import { deleteHoldingAction } from "@/app/actions/holdings";
import type { MethodMargin } from "@/lib/finance/margin";
import { formatCurrency } from "@/lib/utils/format";
import { HoldingDialog, type AssetOption } from "./holding-dialog";

export type MarginViewProps = {
  methods: MethodMargin[];
  totals: { liability: number; assets: number; margin: number; incomplete: boolean };
  unconfigured: boolean;
  assets: AssetOption[];
  hideValues?: boolean;
};

type EditTarget = {
  methodId: string;
  methodName: string;
  holding?: { id: string; assetId: string; quantity: number; costBasis: number; note: string | null };
};

function show(value: number, hidden: boolean): string {
  const formatted = formatCurrency(value);
  return hidden ? maskValue(formatted) : formatted;
}

/**
 * The owner's side of the deal: what the pooled capital is really worth
 * against what was promised to the people who put it in.
 *
 * Investors never see this. They see the fixed return they were sold — that is
 * the whole point of a fixed return. What varies, and what this screen is for,
 * is whether the real deployment is beating that promise or subsidising it.
 */
export function MarginView({
  methods,
  totals,
  unconfigured,
  assets,
  hideValues = false,
}: MarginViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    setPendingDelete(id);
    startTransition(async () => {
      const result = await deleteHoldingAction({ id });
      if (result?.success) {
        toast.success("Holding removed");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Could not remove the holding");
      }
      setPendingDelete(null);
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

  const marginTone = totals.margin >= 0 ? "positive" : "negative";

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
          tone={marginTone}
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
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Text className="text-sm text-muted-foreground">
            No capital has been assigned yet. Add what each method actually holds and the
            margin computes itself from live prices.
          </Text>
        </div>
      )}

      <div className="space-y-4">
        {methods.map((method) => (
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
                    setEditing({ methodId: method.methodId, methodName: method.methodName })
                  }
                >
                  <Plus className="size-4" />
                  Holding
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
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {method.holdings.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>
                            <Mono className="text-xs font-medium">{h.symbol}</Mono>
                            <Text className="text-2xs text-muted-foreground">{h.name}</Text>
                          </TableCell>
                          <TableCell className="text-right">
                            <Mono className="text-xs tabular-nums">
                              {h.quantity.toLocaleString(undefined, {
                                maximumFractionDigits: 8,
                              })}
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
                              {h.price === null
                                ? "—"
                                : show(h.quantity * h.price, hideValues)}
                            </Mono>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Edit ${h.symbol}`}
                                onClick={() =>
                                  setEditing({
                                    methodId: method.methodId,
                                    methodName: method.methodName,
                                    holding: {
                                      id: h.id,
                                      assetId: h.assetId,
                                      quantity: h.quantity,
                                      costBasis: h.costBasis,
                                      note: null,
                                    },
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-destructive"
                                aria-label={`Remove ${h.symbol}`}
                                disabled={pendingDelete !== null}
                                onClick={() => handleDelete(h.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {editing && (
        <HoldingDialog
          open
          methodId={editing.methodId}
          methodName={editing.methodName}
          assets={assets}
          initial={editing.holding}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
