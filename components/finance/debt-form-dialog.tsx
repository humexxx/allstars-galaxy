"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

import type { DebtPaymentType } from "@/types/finance";

export type DebtFormValues = {
  name: string;
  initialBalance: string;
  monthlyInterestRate: string;
  monthlyPayment: string;
  paymentType: DebtPaymentType;
  minPaymentPercent: string;
  minPaymentFloor: string;
  dayOfMonth: number | null;
};

type DebtFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<DebtFormValues> & { id?: string };
  onSubmit: (values: DebtFormValues) => Promise<void>;
};

export function DebtFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: DebtFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <DebtForm
            initial={initial}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type DebtFormProps = {
  initial?: Partial<DebtFormValues> & { id?: string };
  onSubmit: (values: DebtFormValues) => Promise<void>;
  onCancel: () => void;
};

function DebtForm({ initial, onSubmit, onCancel }: DebtFormProps) {
  const isEdit = Boolean(initial?.id);
  const nameInputId = useId();
  const balanceInputId = useId();
  const rateInputId = useId();
  const paymentInputId = useId();
  const percentInputId = useId();
  const floorInputId = useId();
  const domInputId = useId();

  const [name, setName] = useState(initial?.name ?? "");
  const [balance, setBalance] = useState(initial?.initialBalance ?? "");
  const [rate, setRate] = useState(initial?.monthlyInterestRate ?? "");
  const [paymentType, setPaymentType] = useState<DebtPaymentType>(
    initial?.paymentType ?? "fixed"
  );
  const [payment, setPayment] = useState(initial?.monthlyPayment ?? "");
  const [minPercent, setMinPercent] = useState(initial?.minPaymentPercent ?? "");
  const [minFloor, setMinFloor] = useState(initial?.minPaymentFloor ?? "");
  const [dayOfMonth, setDayOfMonth] = useState<string>(
    initial?.dayOfMonth != null ? String(initial.dayOfMonth) : "1"
  );
  const [submitting, setSubmitting] = useState(false);

  const isPercent = paymentType === "percent_of_balance";
  const canSubmit = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const dom = parseInt(dayOfMonth, 10);
      await onSubmit({
        name: name.trim(),
        initialBalance: balance.trim() || "0",
        monthlyInterestRate: rate.trim() || "0",
        monthlyPayment: payment.trim() || "0",
        paymentType,
        minPaymentPercent: minPercent.trim() || "0",
        minPaymentFloor: minFloor.trim() || "0",
        dayOfMonth:
          Number.isFinite(dom) && dom >= 1 && dom <= 31 ? dom : null,
      });
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit debt" : "Add debt"}</DialogTitle>
        <DialogDescription>
          Use <strong>Fixed</strong> for loans with a constant monthly payment,
          and <strong>% of balance</strong> for credit cards.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={nameInputId}>Name</Label>
          <Input
            id={nameInputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tarjeta de crédito"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={balanceInputId}>Balance</Label>
            <Input
              id={balanceInputId}
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={rateInputId}>Monthly interest rate</Label>
            <Input
              id={rateInputId}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              placeholder="0.02"
            />
            <p className="text-xs text-muted-foreground">
              Decimal (0.02 = 2% per month).
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Payment type</Label>
          <RadioGroup
            value={paymentType}
            onValueChange={(v) => setPaymentType(v as DebtPaymentType)}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="fixed" />
              Fixed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="percent_of_balance" />
              % of balance
            </label>
          </RadioGroup>
        </div>

        {isPercent ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={percentInputId}>Min % of balance</Label>
              <Input
                id={percentInputId}
                value={minPercent}
                onChange={(e) => setMinPercent(e.target.value)}
                inputMode="decimal"
                placeholder="0.02"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={floorInputId}>Minimum floor</Label>
              <Input
                id={floorInputId}
                value={minFloor}
                onChange={(e) => setMinFloor(e.target.value)}
                inputMode="decimal"
                placeholder="25.00"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={paymentInputId}>Monthly payment</Label>
            <Input
              id={paymentInputId}
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={domInputId}>Day of month</Label>
          <Input
            id={domInputId}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            inputMode="numeric"
            placeholder="1"
          />
          <p className="text-xs text-muted-foreground">
            When in the month the minimum payment is due (1–31).
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {isEdit ? "Save" : "Add"}
        </Button>
      </DialogFooter>
    </>
  );
}
