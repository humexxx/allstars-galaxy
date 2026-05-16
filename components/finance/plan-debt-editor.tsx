"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

import type { FinancePlanDebt } from "@/types/finance";

type DebtInput = {
  name: string;
  initialBalance: string;
  monthlyInterestRate: string;
  monthlyPayment: string;
};

type PlanDebtEditorProps = {
  debts: FinancePlanDebt[];
  onAdd: (input: DebtInput) => Promise<void>;
  onUpdate: (id: string, input: DebtInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function PlanDebtEditor({
  debts,
  onAdd,
  onUpdate,
  onDelete,
}: PlanDebtEditorProps) {
  const [draft, setDraft] = useState<DebtInput>({
    name: "",
    initialBalance: "",
    monthlyInterestRate: "",
    monthlyPayment: "",
  });
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    startTransition(async () => {
      try {
        await onAdd({
          name: draft.name.trim(),
          initialBalance: draft.initialBalance || "0",
          monthlyInterestRate: draft.monthlyInterestRate || "0",
          monthlyPayment: draft.monthlyPayment || "0",
        });
        setDraft({
          name: "",
          initialBalance: "",
          monthlyInterestRate: "",
          monthlyPayment: "",
        });
      } catch {
        toast.error("Failed to add debt");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Debts</h3>
        <p className="text-xs text-muted-foreground">
          Balance, monthly interest rate (decimal — 0.02 = 2%) and the payment you make each month.
        </p>
      </div>

      {debts.length === 0 ? (
        <EmptyState title="No debts tracked yet" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[160px]">Balance</TableHead>
                <TableHead className="w-[140px]">Rate (mo.)</TableHead>
                <TableHead className="w-[140px]">Payment</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
        <Input
          placeholder="Name (e.g. BAC card)"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="max-w-xs"
          aria-label="New debt name"
        />
        <Input
          placeholder="Balance"
          inputMode="decimal"
          value={draft.initialBalance}
          onChange={(e) => setDraft({ ...draft, initialBalance: e.target.value })}
          className="max-w-[140px]"
          aria-label="New debt balance"
        />
        <Input
          placeholder="Rate (0.02)"
          inputMode="decimal"
          value={draft.monthlyInterestRate}
          onChange={(e) =>
            setDraft({ ...draft, monthlyInterestRate: e.target.value })
          }
          className="max-w-[140px]"
          aria-label="New debt monthly rate"
        />
        <Input
          placeholder="Payment"
          inputMode="decimal"
          value={draft.monthlyPayment}
          onChange={(e) => setDraft({ ...draft, monthlyPayment: e.target.value })}
          className="max-w-[140px]"
          aria-label="New debt monthly payment"
        />
        <Button
          onClick={handleAdd}
          disabled={isPending || draft.name.trim().length === 0}
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add debt
        </Button>
      </div>
    </div>
  );
}

function DebtRow({
  debt,
  onUpdate,
  onDelete,
}: {
  debt: FinancePlanDebt;
  onUpdate: PlanDebtEditorProps["onUpdate"];
  onDelete: PlanDebtEditorProps["onDelete"];
}) {
  const [name, setName] = useState(debt.name);
  const [balance, setBalance] = useState(debt.initialBalance);
  const [rate, setRate] = useState(debt.monthlyInterestRate);
  const [payment, setPayment] = useState(debt.monthlyPayment);
  const [isPending, startTransition] = useTransition();

  const commit = () => {
    if (
      name === debt.name &&
      balance === debt.initialBalance &&
      rate === debt.monthlyInterestRate &&
      payment === debt.monthlyPayment
    )
      return;
    startTransition(async () => {
      try {
        await onUpdate(debt.id, {
          name: name.trim(),
          initialBalance: balance.trim() || "0",
          monthlyInterestRate: rate.trim() || "0",
          monthlyPayment: payment.trim() || "0",
        });
      } catch {
        toast.error("Failed to save");
        setName(debt.name);
        setBalance(debt.initialBalance);
        setRate(debt.monthlyInterestRate);
        setPayment(debt.monthlyPayment);
      }
    });
  };

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          onBlur={commit}
          inputMode="decimal"
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onBlur={commit}
          inputMode="decimal"
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          onBlur={commit}
          inputMode="decimal"
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() =>
            startTransition(async () => {
              try {
                await onDelete(debt.id);
              } catch {
                toast.error("Failed to delete");
              }
            })
          }
          disabled={isPending}
          aria-label={`Delete ${debt.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
