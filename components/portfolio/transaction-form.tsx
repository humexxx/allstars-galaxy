"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { UserSelector } from "@/components/user-selector";
import { Mono, Text } from "@/components/ui/typography";
import { format } from "date-fns";
import { createTransactionSchema } from "@/schemas/transaction";
import type { InvestmentMethod } from "@/types/portfolio";

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
  const [activeTab, setActiveTab] = useState<"buy" | "withdrawal">("buy");
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
  const total = amount ? (parseFloat(amount) + parseFloat(fee)).toFixed(2) : "0";

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
      <div className="flex gap-2 rounded-lg bg-muted p-1">
        <Button
          type="button"
          variant={activeTab === "buy" ? "default" : "ghost"}
          className="flex-1"
          onClick={() => setActiveTab("buy")}
        >
          Buy
        </Button>
        <Button
          type="button"
          variant={activeTab === "withdrawal" ? "default" : "ghost"}
          className="flex-1"
          disabled
        >
          Withdrawal
        </Button>
      </div>

      <button
        type="button"
        onClick={onChangeMethod}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Change investment method (current: ${selectedMethod.name})`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <span className="text-sm font-semibold text-primary">
              {selectedMethod.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{selectedMethod.name}</span>
            <span className="text-xs text-muted-foreground">{selectedMethod.author}</span>
          </div>
        </div>
        <svg
          className="h-5 w-5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <FieldGroup>
        {isAdmin && (
          <Field>
            <FieldLabel htmlFor="user">User</FieldLabel>
            <UserSelector
              users={users}
              value={selectedUserId ?? ""}
              onValueChange={(value) => setValue("userId", value)}
              placeholder="Select a user"
            />
            <FieldError errors={[errors.userId]} />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="amount">Amount</FieldLabel>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              className="pl-10"
              {...register("amount")}
            />
          </div>
          <FieldError errors={[errors.amount]} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field className="col-span-2">
            <FieldLabel>Date</FieldLabel>
            {isAdmin ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setValue("date", d)}
                    autoFocus
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start text-left font-normal"
                disabled
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "MMM d, yyyy")}
              </Button>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="fee">Fee</FieldLabel>
            <Input
              id="fee"
              value={`$ ${fee}`}
              disabled
              className="bg-muted"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            placeholder="Optional notes"
            rows={3}
            {...register("notes")}
          />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>

      <div className="rounded-lg bg-muted p-4">
        <Text variant="muted">Total Spent</Text>
        <div className="text-3xl font-bold">$ <Mono>{total}</Mono></div>
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
          {isSubmitting ? "Adding…" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
