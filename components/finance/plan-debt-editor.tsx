"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils/format";
import { describeRecurrence } from "@/lib/finance/recurrence-label";

import type { FinancePlanDebt } from "@/types/finance";

import { DebtFormDialog, type DebtFormValues } from "./debt-form-dialog";

type DebtInput = DebtFormValues;

type PlanDebtEditorProps = {
  debts: FinancePlanDebt[];
  /** These reject on failure, having already reported it. */
  onAdd: (input: DebtInput) => Promise<void>;
  onUpdate: (id: string, input: DebtInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

/** "1.99%" from the stored monthly decimal "0.0199". */
function percent(decimal: string): string {
  const n = parseFloat(decimal);
  if (!Number.isFinite(n)) return "—";
  return `${Number((n * 100).toFixed(3))}%`;
}

/** What one debt pays per period, in words. */
function paymentLabel(debt: FinancePlanDebt): string {
  if (debt.paymentType === "percent_of_balance") {
    const floor = parseFloat(debt.minPaymentFloor);
    return floor > 0
      ? `${percent(debt.minPaymentPercent)} of balance, min ${formatCurrency(floor)}`
      : `${percent(debt.minPaymentPercent)} of balance`;
  }
  return formatCurrency(debt.monthlyPayment);
}

/**
 * The plan's debts, listed like its incomes and expenses: a read-only table
 * with Edit (the same dialog the calendar opens) and Delete. It used to be a
 * grid of inline inputs, which on a phone squeezed each field to two
 * characters ("C", "780"), had no payment day at all (a new debt always paid
 * on the 1st), and said nothing when a value was refused.
 */
export function PlanDebtEditor({ debts, onAdd, onUpdate, onDelete }: PlanDebtEditorProps) {
  const [dialogState, setDialogState] = useState<
    { open: false } | { open: true; mode: "add" } | { open: true; mode: "edit"; debt: FinancePlanDebt }
  >({ open: false });
  // A deleted row takes its focused button with it; focus lands here instead
  // of on <body>.
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Failures propagate so the dialog stays open; the caller already toasted.
  const handleSubmit = async (values: DebtFormValues): Promise<void> => {
    if (!dialogState.open) return;
    if (dialogState.mode === "add") await onAdd(values);
    else await onUpdate(dialogState.debt.id, values);
  };

  const editing = dialogState.open && dialogState.mode === "edit" ? dialogState.debt : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose">
          <Heading level="h5" as="h2">Debts</Heading>
          <Text variant="small">
            Use <strong>Fixed</strong> for loans with a constant monthly payment, and{" "}
            <strong>% of balance</strong> for credit cards (the minimum shrinks as the
            balance drops, which produces a naturally curving payoff line).
          </Text>
        </div>
        <Button
          ref={addButtonRef}
          size="sm"
          onClick={() => setDialogState({ open: true, mode: "add" })}
        >
          <Plus />
          Add debt
        </Button>
      </div>

      {debts.length === 0 ? (
        <EmptyState title="No debts tracked yet" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {/* The figure the plan was stated with; confirmations since
                    then are what the projection starts from. */}
                <TableHead className="text-right sm:text-left">
                  Opening<span className="hidden sm:inline"> balance</span>
                </TableHead>
                <TableHead className="hidden sm:table-cell">Rate / mo</TableHead>
                <TableHead className="hidden md:table-cell">Payment</TableHead>
                <TableHead className="hidden lg:table-cell">Schedule</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  onEdit={() => setDialogState({ open: true, mode: "edit", debt })}
                  onDelete={onDelete}
                  onDeleted={() => addButtonRef.current?.focus()}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DebtFormDialog
        open={dialogState.open}
        onOpenChange={(o) => (o ? null : setDialogState({ open: false }))}
        initial={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                initialBalance: editing.initialBalance,
                monthlyInterestRate: editing.monthlyInterestRate,
                monthlyPayment: editing.monthlyPayment,
                paymentType: editing.paymentType,
                minPaymentPercent: editing.minPaymentPercent,
                minPaymentFloor: editing.minPaymentFloor,
                dayOfMonth: editing.dayOfMonth,
                recurrenceType: editing.recurrenceType,
                weekOfMonth: editing.weekOfMonth,
                dayOfWeek: editing.dayOfWeek,
                intervalMonths: editing.intervalMonths,
                recurrenceStart: editing.recurrenceStart,
              }
            : undefined
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function DebtRow({
  debt,
  onEdit,
  onDelete,
  onDeleted,
}: {
  debt: FinancePlanDebt;
  onEdit: () => void;
  onDelete: PlanDebtEditorProps["onDelete"];
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const schedule = describeRecurrence(debt);
  const payment = paymentLabel(debt);

  return (
    <TableRow>
      <TableCell className="max-w-48 font-medium whitespace-normal sm:max-w-none">
        <span className="block break-words">{debt.name}</span>
        {/* What the hidden columns hold, under the name on narrow screens. */}
        <span className="block text-xs font-normal text-muted-foreground md:hidden">
          <span className="sm:hidden">{percent(debt.monthlyInterestRate)}/mo · </span>
          {payment}
          <span className="lg:hidden"> · {schedule}</span>
        </span>
        <span className="hidden text-xs font-normal text-muted-foreground md:block lg:hidden">
          {schedule}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums sm:text-left">
        {formatCurrency(debt.initialBalance)}
      </TableCell>
      <TableCell className="hidden font-mono tabular-nums sm:table-cell">
        {percent(debt.monthlyInterestRate)}
      </TableCell>
      <TableCell className="hidden font-mono tabular-nums md:table-cell">{payment}</TableCell>
      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
        {schedule}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${debt.name}`}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={() =>
              startTransition(async () => {
                try {
                  await onDelete(debt.id);
                  onDeleted();
                } catch {
                  // Already reported by the caller.
                }
              })
            }
            disabled={isPending}
            aria-label={`Delete ${debt.name}`}
          >
            {isPending ? <Spinner /> : <Trash2 />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
