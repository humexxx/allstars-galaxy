"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Mono, Text } from "@/components/ui/typography";

import { saveConfirmationAction } from "@/app/actions/finance-confirmations";
import { runAction } from "@/lib/actions/run";
import { formatCurrency } from "@/lib/utils/format";
import type { FinancePlanDebt } from "@/types/finance";

type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  monthLabel: string;
  projected: {
    savings: number;
    investments: number;
    debts: Array<{ debtId: string; name: string; balance: number }>;
  };
  debts: FinancePlanDebt[];
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  planId,
  planName,
  monthLabel,
  projected,
  debts,
}: ConfirmationDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [savings, setSavings] = useState<string>(projected.savings.toFixed(2));
  const [investments, setInvestments] = useState<string>(
    projected.investments.toFixed(2)
  );
  const [notes, setNotes] = useState<string>("");
  const [debtBalances, setDebtBalances] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const d of debts) {
      const projectedDebt = projected.debts.find((p) => p.debtId === d.id);
      map[d.id] = projectedDebt ? projectedDebt.balance.toFixed(2) : d.initialBalance;
    }
    return map;
  });

  const handleSubmit = () => {
    startTransition(async () => {
      // The action revalidates the plan and the dashboard, so the recalibrated
      // projection arrives with its response.
      const result = await runAction(
        saveConfirmationAction({
          planId,
          confirmedSavings: savings || "0",
          confirmedInvestments: investments || "0",
          notes: notes.trim() || null,
          debtBalances: debts.map((d) => ({
            debtId: d.id,
            confirmedBalance: debtBalances[d.id] || "0",
          })),
        }),
        {
          success: "Confirmation saved — the projection will recalibrate from here.",
          failure: "Failed to save the confirmation",
        }
      );
      if (result.ok) onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 shrink-0" aria-hidden="true" />
            Confirm your {monthLabel} balances
          </DialogTitle>
          <DialogDescription>
            Plan <strong>{planName}</strong> — check your real account balances and
            adjust the numbers below. The projection will use these as the new
            baseline going forward.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="conf-savings">Savings</FieldLabel>
              <Input
                id="conf-savings"
                inputMode="decimal"
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
              />
              <FieldDescription>
                Projected: <Mono>{formatCurrency(projected.savings)}</Mono>
              </FieldDescription>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="conf-investments">Investments</FieldLabel>
              <Input
                id="conf-investments"
                inputMode="decimal"
                value={investments}
                onChange={(e) => setInvestments(e.target.value)}
              />
              <FieldDescription>
                Projected: <Mono>{formatCurrency(projected.investments)}</Mono>
              </FieldDescription>
            </Field>
          </div>

          {debts.length > 0 && (
            <FieldSet className="gap-2">
              <FieldLegend variant="label" className="mb-2">
                Debt balances
              </FieldLegend>
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                {debts.map((d) => {
                  const projectedDebt = projected.debts.find((p) => p.debtId === d.id);
                  return (
                    <div key={d.id} className="grid items-center gap-2 sm:grid-cols-2 sm:gap-3">
                      <div>
                        <Text variant="body" weight="medium">{d.name}</Text>
                        <Text variant="small">
                          Projected: <Mono>{formatCurrency(projectedDebt?.balance ?? 0)}</Mono>
                        </Text>
                      </div>
                      <Input
                        inputMode="decimal"
                        value={debtBalances[d.id] ?? ""}
                        onChange={(e) =>
                          setDebtBalances({ ...debtBalances, [d.id]: e.target.value })
                        }
                        aria-label={`Confirmed balance for ${d.name}`}
                      />
                    </div>
                  );
                })}
              </div>
            </FieldSet>
          )}

          <Field className="gap-2">
            <FieldLabel htmlFor="conf-notes">Notes (optional)</FieldLabel>
            <Textarea
              id="conf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything unusual this month?"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Skip for now
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Spinner />}
            {isPending ? "Saving…" : "Save confirmation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
