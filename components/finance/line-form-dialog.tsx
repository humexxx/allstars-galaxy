"use client";

import { useId, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export type LineKind = "recurring" | "one_time";
export type LineVariant = "income" | "expense";

export type LineFormValues = {
  name: string;
  monthlyAmount: string;
  kind: LineKind;
  dayOfMonth: number | null;
  date: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type LineFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: LineVariant;
  initial?: Partial<LineFormValues> & { id?: string };
  // Pre-fill the date for one-time entries when opened from the calendar.
  defaultDate?: string;
  onSubmit: (values: LineFormValues) => Promise<void>;
};

function toISODate(d: Date): string {
  // Normalise to UTC midnight to keep day-precision stable across timezones.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fromISODate(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  return new Date(y, m - 1, d);
}

export function LineFormDialog({
  open,
  onOpenChange,
  variant,
  initial,
  defaultDate,
  onSubmit,
}: LineFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mount/unmount the form when the dialog opens so its state always
            starts fresh from `initial` — avoids the setState-in-effect pattern
            and keeps the form predictable across open/close cycles. */}
        {open && (
          <LineForm
            variant={variant}
            initial={initial}
            defaultDate={defaultDate}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type LineFormProps = {
  variant: LineVariant;
  initial?: Partial<LineFormValues> & { id?: string };
  defaultDate?: string;
  onSubmit: (values: LineFormValues) => Promise<void>;
  onCancel: () => void;
};

function LineForm({
  variant,
  initial,
  defaultDate,
  onSubmit,
  onCancel,
}: LineFormProps) {
  const isEdit = Boolean(initial?.id);
  const noun = variant === "income" ? "income" : "expense";
  const nameInputId = useId();
  const amountInputId = useId();
  const domInputId = useId();

  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.monthlyAmount ?? "");
  const [kind, setKind] = useState<LineKind>(
    initial?.kind ?? (defaultDate ? "one_time" : "recurring")
  );
  const [dayOfMonth, setDayOfMonth] = useState<string>(
    initial?.dayOfMonth != null ? String(initial.dayOfMonth) : "1"
  );
  const [date, setDate] = useState<string | null>(
    initial?.date ?? defaultDate ?? null
  );
  const [startDate, setStartDate] = useState<string | null>(
    initial?.startDate ?? null
  );
  const [endDate, setEndDate] = useState<string | null>(
    initial?.endDate ?? null
  );
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    amount.trim().length > 0 &&
    (kind === "recurring" || (kind === "one_time" && !!date));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const dom = parseInt(dayOfMonth, 10);
      await onSubmit({
        name: name.trim(),
        monthlyAmount: amount.trim() || "0",
        kind,
        dayOfMonth:
          kind === "recurring" && Number.isFinite(dom) && dom >= 1 && dom <= 31
            ? dom
            : null,
        date: kind === "one_time" ? date : null,
        // Only persist start/end for incomes — expenses ignore these.
        ...(variant === "income"
          ? {
              startDate: kind === "recurring" ? startDate : null,
              endDate: kind === "recurring" ? endDate : null,
            }
          : {}),
      });
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? `Edit ${noun}` : `Add ${noun}`}
        </DialogTitle>
        <DialogDescription>
          {variant === "income"
            ? "Money coming in. Recurring incomes can have a start/end window."
            : "Money going out. Recurring or a one-time payment."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={nameInputId}>Name</Label>
          <Input
            id={nameInputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={variant === "income" ? "Trabajo principal" : "Renta"}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={amountInputId}>Amount</Label>
          <Input
            id={amountInputId}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>

        <ScheduleSection
          kind={kind}
          setKind={setKind}
          dayOfMonth={dayOfMonth}
          setDayOfMonth={setDayOfMonth}
          date={date}
          setDate={setDate}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          domInputId={domInputId}
          noun={noun}
          showWindow={variant === "income"}
        />
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

type ScheduleSectionProps = {
  kind: LineKind;
  setKind: (k: LineKind) => void;
  dayOfMonth: string;
  setDayOfMonth: (v: string) => void;
  date: string | null;
  setDate: (v: string | null) => void;
  startDate: string | null;
  setStartDate: (v: string | null) => void;
  endDate: string | null;
  setEndDate: (v: string | null) => void;
  domInputId: string;
  noun: string;
  showWindow: boolean; // only incomes expose start/end window
};

// Groups every "when does this hit?" field into a single visual block so users
// don't have to scan the dialog to figure out the schedule. Start/end window
// lives behind an Advanced collapsible since most users won't touch it.
function ScheduleSection({
  kind,
  setKind,
  dayOfMonth,
  setDayOfMonth,
  date,
  setDate,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  domInputId,
  noun,
  showWindow,
}: ScheduleSectionProps) {
  const [advancedOpen, setAdvancedOpen] = useState(
    // Auto-expand if there's already data in there so users see what they have.
    Boolean(startDate || endDate)
  );

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Schedule
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <RadioGroup
          value={kind}
          onValueChange={(v) => setKind(v as LineKind)}
          className="flex gap-4"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="recurring" />
            Recurring
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="one_time" />
            One-time
          </label>
        </RadioGroup>
      </div>

      {kind === "recurring" ? (
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
            When in the month this {noun} usually hits (1–31).
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Date</Label>
          <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
        </div>
      )}

      {showWindow && kind === "recurring" && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              aria-label="Toggle advanced schedule options"
            >
              <span>Advanced</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  advancedOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Plan start"
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="No end"
                  clearable
                />
              </div>
            </div>
            <p className="pt-1.5 text-xs text-muted-foreground">
              Limit when this income is active. Leave both empty to run from
              plan start to end.
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function DatePicker({
  value,
  onChange,
  placeholder,
  clearable,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromISODate(value);
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start font-normal"
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, "PPP") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              onChange(d ? toISODate(d) : null);
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear date"
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export { fromISODate, toISODate };
