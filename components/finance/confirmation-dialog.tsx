"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mono, Text } from "@/components/ui/typography";

import { saveConfirmationAction } from "@/app/actions/finance-confirmations";
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
  const router = useRouter();
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
      const result = await saveConfirmationAction({
        planId,
        confirmedSavings: savings || "0",
        confirmedInvestments: investments || "0",
        notes: notes.trim() || null,
        debtBalances: debts.map((d) => ({
          debtId: d.id,
          confirmedBalance: debtBalances[d.id] || "0",
        })),
      });
      if (result.success) {
        toast.success("Confirmation saved — the projection will recalibrate from here.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Confirm your {monthLabel} balances
          </DialogTitle>
          <DialogDescription>
            Plan <strong>{planName}</strong> — check your real account balances and
            adjust the numbers below. The projection will use these as the new
            baseline going forward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="conf-savings">Savings</Label>
              <Input
                id="conf-savings"
                inputMode="decimal"
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
              />
              <Text variant="small">
                Projected: <Mono>{formatCurrency(projected.savings)}</Mono>
              </Text>
            </div>
            <div className="space-y-1">
              <Label htmlFor="conf-investments">Investments</Label>
              <Input
                id="conf-investments"
                inputMode="decimal"
                value={investments}
                onChange={(e) => setInvestments(e.target.value)}
              />
              <Text variant="small">
                Projected: <Mono>{formatCurrency(projected.investments)}</Mono>
              </Text>
            </div>
          </div>

          {debts.length > 0 && (
            <div className="space-y-2">
              <Label>Debt balances</Label>
              <div className="space-y-2 rounded-md border p-3">
                {debts.map((d) => {
                  const projectedDebt = projected.debts.find((p) => p.debtId === d.id);
                  return (
                    <div key={d.id} className="grid grid-cols-2 items-center gap-3">
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
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="conf-notes">Notes (optional)</Label>
            <Textarea
              id="conf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything unusual this month?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Skip for now
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save confirmation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
