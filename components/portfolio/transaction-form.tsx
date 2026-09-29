"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { UserSelector } from "@/components/user-selector";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { formatCurrency } from "@/lib/utils/format";
import { toDay } from "@/lib/utils/date";
import { createTransactionSchema } from "@/schemas/transaction";
import type { InvestmentMethod } from "@/types/portfolio";
import type { TransactionType } from "@/types/transaction";

const transactionFormSchema = createTransactionSchema.omit({
  investmentMethodId: true,
});

type TransactionFormInput = z.input<typeof transactionFormSchema>;
type TransactionFormData = z.output<typeof transactionFormSchema>;

type User = {
  id: string;
  fullName: string | null;
  email: string | null;
};

type TransactionFormProps = {
  selectedMethod: InvestmentMethod;
  onChangeMethod: () => void;
  onSubmit: (data: {
    amount: string;
    date: Date;
    notes?: string;
    userId?: string;
  }) => void;
  onCancel: () => void;
  isAdmin: boolean;
  users?: User[];
  adminUserId?: string;
  /** Disables the submit and cancel buttons while the parent action is pending. */
  isSubmitting?: boolean;
};

export function TransactionForm({
  selectedMethod,
  onChangeMethod,
  onSubmit,
  onCancel,
  isAdmin,
  users = [],
  adminUserId,
  isSubmitting = false,
}: TransactionFormProps) {
  const [activeTab, setActiveTab] = useState<TransactionType>("buy");
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<TransactionFormInput, unknown, TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      amount: "",
      date: new Date(),
      notes: "",
      userId: adminUserId || undefined,
    },
  });

  const amount = useWatch({ control, name: "amount" });
  const date = useWatch({ control, name: "date" }) as Date;
  const selectedUserId = useWatch({ control, name: "userId" });

  const fee = "0";
  const total = amount ? parseFloat(amount) + parseFloat(fee) : 0;

  const submit = (data: TransactionFormData): void => {
    onSubmit({
      amount: data.amount,
      date: data.date,
      notes: data.notes || undefined,
      ...(isAdmin && data.userId ? { userId: data.userId } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-6">
      {/* Withdrawals are requested from a holding, not typed in here; the
          segment stays visible so the form reads as the buy half of a pair. */}
      <ToggleGroup
        type="single"
        value={activeTab}
        onValueChange={(v) => v && setActiveTab(v as TransactionType)}
        aria-label="Transaction type"
        className="w-full"
      >
        <ToggleGroupItem value="buy">Buy</ToggleGroupItem>
        <ToggleGroupItem value="withdrawal" disabled>
          Withdrawal
        </ToggleGroupItem>
      </ToggleGroup>

      <button
        type="button"
        onClick={onChangeMethod}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Change investment method (current: ${selectedMethod.name})`}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <span className="text-sm font-semibold text-primary">
              {selectedMethod.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="font-medium">{selectedMethod.name}</span>
        </div>
        <ChevronDown aria-hidden className="size-5 text-muted-foreground" />
      </button>

      <FieldGroup>
        {isAdmin && (
          <Field data-invalid={!!errors.userId}>
            <FieldLabel htmlFor="user">User</FieldLabel>
            <UserSelector
              id="user"
              users={users}
              value={selectedUserId ?? ""}
              onValueChange={(value) =>
                setValue("userId", value, { shouldValidate: true, shouldDirty: true })
              }
              placeholder="Select a user"
            />
            <FieldError errors={[errors.userId]} />
          </Field>
        )}

        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="amount">Amount</FieldLabel>
          <MoneyInput
            id="amount"
            currency="USD"
            placeholder="0.00"
            value={amount ?? ""}
            onChange={(value) =>
              setValue("amount", value, { shouldValidate: true, shouldDirty: true })
            }
            aria-invalid={!!errors.amount}
          />
          <FieldError errors={[errors.amount]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field className="sm:col-span-2" data-invalid={!!errors.date}>
            <FieldLabel htmlFor="date">Date</FieldLabel>
            {/* Only admins back-date; for everyone else the server stamps
                "now" regardless, so the picker is shown but locked. */}
            <DateField
              id="date"
              value={format(date, "yyyy-MM-dd")}
              onChange={(day) =>
                day && setValue("date", toDay(day), { shouldValidate: true, shouldDirty: true })
              }
              disabled={!isAdmin}
              aria-invalid={!!errors.date}
            />
            <FieldError errors={[errors.date]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="fee">Fee</FieldLabel>
            <Input id="fee" value={formatCurrency(fee)} disabled />
          </Field>
        </div>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            placeholder="Optional notes"
            rows={3}
            aria-invalid={!!errors.notes}
            {...register("notes")}
          />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
        <Eyebrow as="div">Total spent</Eyebrow>
        <Mono as="div" className="text-xl font-semibold tabular-nums sm:text-2xl">
          {formatCurrency(total)}
        </Mono>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={
            isSubmitting ||
            !amount ||
            parseFloat(amount) <= 0 ||
            (isAdmin && !selectedUserId)
          }
        >
          {isSubmitting && <Spinner />}
          {isSubmitting ? "Adding…" : "Add transaction"}
        </Button>
      </div>
    </form>
  );
}
