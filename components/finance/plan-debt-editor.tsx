"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

import type {
  DebtPaymentType,
  FinancePlanDebt,
  RecurrenceType,
} from "@/types/finance";

type DebtInput = {
  name: string;
  initialBalance: string;
  monthlyInterestRate: string;
  monthlyPayment: string;
  paymentType: DebtPaymentType;
  minPaymentPercent: string;
  minPaymentFloor: string;
  // B1/B2 — pass through. The inline debt editor doesn't expose these yet;
  // they survive round-trips via the parent that supplies them.
  recurrenceType: RecurrenceType;
  dayOfMonth: number | null;
  weekOfMonth: number | null;
  dayOfWeek: number | null;
  intervalMonths: number | null;
  recurrenceStart: string | null;
};

type PlanDebtEditorProps = {
  debts: FinancePlanDebt[];
  /** These reject on failure, having already reported it. */
  onAdd: (input: DebtInput) => Promise<void>;
  onUpdate: (id: string, input: DebtInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const EMPTY_DRAFT: DebtInput = {
  name: "",
  initialBalance: "",
  monthlyInterestRate: "",
  monthlyPayment: "",
  paymentType: "fixed",
  minPaymentPercent: "",
  minPaymentFloor: "",
  recurrenceType: "monthly_day",
  dayOfMonth: null,
  weekOfMonth: null,
  dayOfWeek: null,
  intervalMonths: null,
  recurrenceStart: null,
};

export function PlanDebtEditor({ debts, onAdd, onUpdate, onDelete }: PlanDebtEditorProps) {
  const [draft, setDraft] = useState<DebtInput>(EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();
  // A deleted row takes its focused button with it; focus lands on the new
  // debt's name instead of on <body>.
  const draftNameRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    startTransition(async () => {
      try {
        await onAdd({
          name: draft.name.trim(),
          initialBalance: draft.initialBalance || "0",
          monthlyInterestRate: draft.monthlyInterestRate || "0",
          monthlyPayment: draft.monthlyPayment || "0",
          paymentType: draft.paymentType,
          minPaymentPercent: draft.minPaymentPercent || "0",
          minPaymentFloor: draft.minPaymentFloor || "0",
          recurrenceType: draft.recurrenceType,
          dayOfMonth: draft.dayOfMonth,
          weekOfMonth: draft.weekOfMonth,
          dayOfWeek: draft.dayOfWeek,
          intervalMonths: draft.intervalMonths,
          recurrenceStart: draft.recurrenceStart,
        });
        setDraft(EMPTY_DRAFT);
      } catch {
        // Already reported by the caller; the draft stays for another try.
      }
    });
  };

  const isPercent = draft.paymentType === "percent_of_balance";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Heading level="h5" as="h2">Debts</Heading>
        <Text variant="small">
          Use <strong>Fixed</strong> for loans with a constant monthly payment, and{" "}
          <strong>% of balance</strong> for credit cards (the minimum shrinks as the
          balance drops, which produces a naturally curving payoff line).
        </Text>
      </div>

      {debts.length === 0 ? (
        <EmptyState title="No debts tracked yet" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-36">Balance</TableHead>
                <TableHead className="w-32">Rate (mo.)</TableHead>
                <TableHead className="w-38">Payment</TableHead>
                <TableHead className="w-50">Type</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onDeleted={() => draftNameRef.current?.focus()}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-3">
        <div className="flex w-full flex-wrap items-end gap-2">
          <Input
            ref={draftNameRef}
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
            className="max-w-36"
            aria-label="New debt balance"
          />
          <Input
            placeholder="Rate (0.02)"
            inputMode="decimal"
            value={draft.monthlyInterestRate}
            onChange={(e) => setDraft({ ...draft, monthlyInterestRate: e.target.value })}
            className="max-w-32"
            aria-label="New debt monthly rate"
          />
          <Select
            value={draft.paymentType}
            onValueChange={(v) =>
              setDraft({ ...draft, paymentType: v as DebtPaymentType })
            }
          >
            <SelectTrigger className="max-w-50" aria-label="New debt payment type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed payment</SelectItem>
              <SelectItem value="percent_of_balance">% of balance (cards)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isPercent ? (
          <div className="flex w-full flex-wrap items-end gap-2">
            <Input
              placeholder="% (0.02 = 2%)"
              inputMode="decimal"
              value={draft.minPaymentPercent}
              onChange={(e) => setDraft({ ...draft, minPaymentPercent: e.target.value })}
              className="max-w-40"
              aria-label="Minimum payment percent"
            />
            <Input
              placeholder="Floor ($25)"
              inputMode="decimal"
              value={draft.minPaymentFloor}
              onChange={(e) => setDraft({ ...draft, minPaymentFloor: e.target.value })}
              className="max-w-40"
              aria-label="Minimum payment floor"
            />
            <Text variant="small" as="span">
              Each month: <strong>max(balance × %, floor)</strong>
            </Text>
          </div>
        ) : (
          <div className="flex w-full flex-wrap items-end gap-2">
            <Input
              placeholder="Fixed monthly payment"
              inputMode="decimal"
              value={draft.monthlyPayment}
              onChange={(e) => setDraft({ ...draft, monthlyPayment: e.target.value })}
              className="max-w-50"
              aria-label="New debt monthly payment"
            />
          </div>
        )}

        <Button
          onClick={handleAdd}
          disabled={isPending || draft.name.trim().length === 0}
          size="sm"
        >
          {isPending ? <Spinner /> : <Plus />}
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
  onDeleted,
}: {
  debt: FinancePlanDebt;
  onUpdate: PlanDebtEditorProps["onUpdate"];
  onDelete: PlanDebtEditorProps["onDelete"];
  onDeleted: () => void;
}) {
  const [name, setName] = useState(debt.name);
  const [balance, setBalance] = useState(debt.initialBalance);
  const [rate, setRate] = useState(debt.monthlyInterestRate);
  const [payment, setPayment] = useState(debt.monthlyPayment);
  const [paymentType, setPaymentType] = useState<DebtPaymentType>(debt.paymentType);
  const [minPercent, setMinPercent] = useState(debt.minPaymentPercent);
  const [minFloor, setMinFloor] = useState(debt.minPaymentFloor);
  const [isPending, startTransition] = useTransition();

  // The same debt can be edited from the calendar's dialog. Without this the
  // fields kept their mount-time values and the next blur here wrote them
  // back over that edit. Only fields the server actually changed are reset,
  // so a revalidation landing mid-edit leaves the one being typed in alone.
  const [synced, setSynced] = useState(debt);
  if (synced !== debt) {
    setSynced(debt);
    if (debt.name !== synced.name) setName(debt.name);
    if (debt.initialBalance !== synced.initialBalance) setBalance(debt.initialBalance);
    if (debt.monthlyInterestRate !== synced.monthlyInterestRate) setRate(debt.monthlyInterestRate);
    if (debt.monthlyPayment !== synced.monthlyPayment) setPayment(debt.monthlyPayment);
    if (debt.paymentType !== synced.paymentType) setPaymentType(debt.paymentType);
    if (debt.minPaymentPercent !== synced.minPaymentPercent) setMinPercent(debt.minPaymentPercent);
    if (debt.minPaymentFloor !== synced.minPaymentFloor) setMinFloor(debt.minPaymentFloor);
  }

  const commit = (overrides: Partial<DebtInput> = {}) => {
    const next: DebtInput = {
      name: overrides.name ?? name.trim(),
      initialBalance: overrides.initialBalance ?? (balance.trim() || "0"),
      monthlyInterestRate: overrides.monthlyInterestRate ?? (rate.trim() || "0"),
      monthlyPayment: overrides.monthlyPayment ?? (payment.trim() || "0"),
      paymentType: overrides.paymentType ?? paymentType,
      minPaymentPercent: overrides.minPaymentPercent ?? (minPercent.trim() || "0"),
      minPaymentFloor: overrides.minPaymentFloor ?? (minFloor.trim() || "0"),
      // Preserve the recurrence-model fields the row was loaded with — this
      // editor doesn't surface them, but inline edits should not blow them
      // away. The service writes `dayOfMonth ?? null`, so leaving it out of
      // the payload reset every payment day to the 1st on a blur.
      dayOfMonth: debt.dayOfMonth,
      recurrenceType: debt.recurrenceType,
      weekOfMonth: debt.weekOfMonth,
      dayOfWeek: debt.dayOfWeek,
      intervalMonths: debt.intervalMonths,
      recurrenceStart: debt.recurrenceStart,
    };
    // Every field commits on blur, so tabbing across a row would otherwise
    // write it five times without changing anything.
    const unchanged =
      next.name === debt.name &&
      next.initialBalance === debt.initialBalance &&
      next.monthlyInterestRate === debt.monthlyInterestRate &&
      next.monthlyPayment === debt.monthlyPayment &&
      next.paymentType === debt.paymentType &&
      next.minPaymentPercent === debt.minPaymentPercent &&
      next.minPaymentFloor === debt.minPaymentFloor;
    if (unchanged) return;
    startTransition(async () => {
      try {
        await onUpdate(debt.id, next);
      } catch {
        // Already reported by the caller.
      }
    });
  };

  const isPercent = paymentType === "percent_of_balance";
  // readOnly rather than disabled while saving: the blur that starts a save
  // has just moved focus to the next field, and disabling it would drop focus
  // to <body>.
  const busy = { readOnly: isPending, "aria-busy": isPending } as const;

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => commit()}
          {...busy}
          className="h-8"
          aria-label={`${debt.name} name`}
        />
      </TableCell>
      <TableCell>
        <Input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          onBlur={() => commit()}
          inputMode="decimal"
          {...busy}
          className="h-8"
          aria-label={`${debt.name} balance`}
        />
      </TableCell>
      <TableCell>
        <Input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onBlur={() => commit()}
          inputMode="decimal"
          {...busy}
          className="h-8"
          aria-label={`${debt.name} monthly rate`}
        />
      </TableCell>
      <TableCell>
        {isPercent ? (
          <div className="flex gap-1">
            <Input
              value={minPercent}
              onChange={(e) => setMinPercent(e.target.value)}
              onBlur={() => commit()}
              inputMode="decimal"
              {...busy}
              className="h-8"
              placeholder="%"
              aria-label={`${debt.name} minimum % of balance`}
            />
            <Input
              value={minFloor}
              onChange={(e) => setMinFloor(e.target.value)}
              onBlur={() => commit()}
              inputMode="decimal"
              {...busy}
              className="h-8"
              placeholder="floor"
              aria-label={`${debt.name} minimum dollar amount`}
            />
          </div>
        ) : (
          <Input
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            onBlur={() => commit()}
            inputMode="decimal"
            {...busy}
            className="h-8"
            aria-label={`${debt.name} monthly payment`}
          />
        )}
      </TableCell>
      <TableCell>
        <Select
          value={paymentType}
          onValueChange={(v) => {
            if (isPending) return;
            const t = v as DebtPaymentType;
            setPaymentType(t);
            commit({ paymentType: t });
          }}
        >
          <SelectTrigger size="sm" aria-label={`${debt.name} payment type`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="percent_of_balance">% of balance</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
  );
}
