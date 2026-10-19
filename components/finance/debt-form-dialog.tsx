"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Eyebrow } from "@/components/ui/typography";

import {
  FIXED_DEBT_NEEDS_PAYMENT,
  MONTHLY_RATE_TOO_HIGH,
  SHARE_TOO_HIGH,
} from "@/schemas/finance";
import type { DebtPaymentType, RecurrenceType } from "@/types/finance";

import { RecurrenceFields } from "./line-form-dialog";

// The server's rules (`moneySchema` / the rate regex), checked here so the
// field that is wrong says so instead of the whole save failing as "Invalid
// input".
const MONEY = /^\d+(\.\d{1,2})?$/;
const RATE = /^\d+(\.\d{1,6})?$/;
const MONEY_ERROR = "Use a positive number with up to 2 decimals.";

export type DebtFormValues = {
  name: string;
  initialBalance: string;
  monthlyInterestRate: string;
  monthlyPayment: string;
  paymentType: DebtPaymentType;
  minPaymentPercent: string;
  minPaymentFloor: string;
  dayOfMonth: number | null;
  // Default monthly_day preserves prior behaviour.
  recurrenceType: RecurrenceType;
  weekOfMonth: number | null;
  dayOfWeek: number | null;
  intervalMonths: number | null;
  recurrenceStart: string | null;
};

type DebtFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<DebtFormValues> & { id?: string };
  /** Rejects when the save failed; the caller has already said so, and the
   *  dialog stays open with the input intact. */
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
  // B1/B2 recurrence model — exposed via RecurrenceFields below.
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    initial?.recurrenceType ?? "monthly_day"
  );
  const [weekOfMonth, setWeekOfMonth] = useState<number | null>(
    initial?.weekOfMonth ?? null
  );
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(
    initial?.dayOfWeek ?? null
  );
  const [intervalMonths, setIntervalMonths] = useState<number | null>(
    initial?.intervalMonths ?? null
  );
  const [recurrenceStart, setRecurrenceStart] = useState<string | null>(
    initial?.recurrenceStart ?? null
  );
  const [submitting, setSubmitting] = useState(false);

  const isPercent = paymentType === "percent_of_balance";
  const invalid = (value: string, rule: RegExp): boolean =>
    value.trim().length > 0 && !rule.test(value.trim());
  const errors = {
    balance: invalid(balance, MONEY) ? MONEY_ERROR : null,
    rate: invalid(rate, RATE)
      ? "Use a positive decimal, e.g. 0.02."
      : parseFloat(rate) > 1
        ? MONTHLY_RATE_TOO_HIGH
        : null,
    payment: invalid(payment, MONEY)
      ? MONEY_ERROR
      : // A fixed payment of zero on a debt that accrues interest never pays
        // it off; the server refuses it with this same message.
        !isPercent && !(parseFloat(payment) > 0) && parseFloat(rate) > 0
        ? FIXED_DEBT_NEEDS_PAYMENT
        : null,
    minPercent: invalid(minPercent, RATE)
      ? "Use a positive decimal, e.g. 0.02."
      : parseFloat(minPercent) > 1
        ? SHARE_TOO_HIGH
        : null,
    minFloor: invalid(minFloor, MONEY) ? MONEY_ERROR : null,
  };
  const relevantErrors = isPercent
    ? [errors.balance, errors.rate, errors.minPercent, errors.minFloor]
    : [errors.balance, errors.rate, errors.payment];
  const canSubmit =
    name.trim().length > 0 && relevantErrors.every((e) => e === null);

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
        recurrenceType,
        weekOfMonth,
        dayOfWeek,
        intervalMonths,
        recurrenceStart,
      });
      onCancel();
    } catch {
      // Already reported by the caller; stay open so nothing typed is lost.
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

      <div className="flex flex-col gap-4">
        <Field className="gap-2">
          <FieldLabel htmlFor={nameInputId}>Name</FieldLabel>
          <Input
            id={nameInputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Credit card"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyField
            id={balanceInputId}
            label="Balance"
            value={balance}
            onChange={setBalance}
            placeholder="0.00"
            error={errors.balance}
          />
          <MoneyField
            id={rateInputId}
            label="Monthly interest rate"
            value={rate}
            onChange={setRate}
            placeholder="0.02"
            error={errors.rate}
            description="Decimal (0.02 = 2% per month)."
          />
        </div>

        <FieldSet>
          <FieldLegend variant="label" className="mb-2">
            Payment type
          </FieldLegend>
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
        </FieldSet>

        {isPercent ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField
              id={percentInputId}
              label="Min % of balance"
              value={minPercent}
              onChange={setMinPercent}
              placeholder="0.02"
              error={errors.minPercent}
            />
            <MoneyField
              id={floorInputId}
              label="Minimum floor"
              value={minFloor}
              onChange={setMinFloor}
              placeholder="25.00"
              error={errors.minFloor}
            />
          </div>
        ) : (
          <MoneyField
            id={paymentInputId}
            label="Monthly payment"
            value={payment}
            onChange={setPayment}
            placeholder="0.00"
            error={errors.payment}
          />
        )}

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
          <Eyebrow as="div">Schedule</Eyebrow>
          <RecurrenceFields
            recurrenceType={recurrenceType}
            setRecurrenceType={setRecurrenceType}
            dayOfMonth={dayOfMonth}
            setDayOfMonth={setDayOfMonth}
            weekOfMonth={weekOfMonth}
            setWeekOfMonth={setWeekOfMonth}
            dayOfWeek={dayOfWeek}
            setDayOfWeek={setDayOfWeek}
            intervalMonths={intervalMonths}
            setIntervalMonths={setIntervalMonths}
            recurrenceStart={recurrenceStart}
            setRecurrenceStart={setRecurrenceStart}
            domInputId={domInputId}
            noun="debt payment"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting && <Spinner />}
          {submitting ? "Saving…" : isEdit ? "Save" : "Add"}
        </Button>
      </DialogFooter>
    </>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  description,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error: string | null;
  description?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <Field className="gap-2" data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
