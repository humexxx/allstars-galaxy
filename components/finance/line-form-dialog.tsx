"use client";

import { useId, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DateField } from "@/components/ui/date-field";
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Eyebrow, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { RecurrenceType } from "@/types/finance";

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
  // Recurrence model. Defaults to monthly_day so existing flows behave
  // identically.
  recurrenceType: RecurrenceType;
  weekOfMonth: number | null;
  dayOfWeek: number | null;
  intervalMonths: number | null;
  recurrenceStart: string | null;
};

type LineFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: LineVariant;
  initial?: Partial<LineFormValues> & { id?: string };
  // Pre-fill the date for one-time entries when opened from the calendar.
  defaultDate?: string;
  /** Rejects when the save failed; the caller has already said so, and the
   *  dialog stays open with the input intact. */
  onSubmit: (values: LineFormValues) => Promise<void>;
};

/** Same rule as the server's `moneySchema`: non-negative, up to 2 decimals. */
const MONEY = /^\d+(\.\d{1,2})?$/;

function toISODate(d: Date): string {
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
  const amountErrorId = useId();
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
  // Default to monthly_day for new entries (identical to the prior behaviour).
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

  // The server rejects anything else as "Invalid input" with no hint of which
  // field; saying so here, next to the field, is the useful version.
  const amountInvalid = amount.trim().length > 0 && !MONEY.test(amount.trim());

  const canSubmit =
    name.trim().length > 0 &&
    amount.trim().length > 0 &&
    !amountInvalid &&
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
        <DialogTitle>
          {isEdit ? `Edit ${noun}` : `Add ${noun}`}
        </DialogTitle>
        <DialogDescription>
          {variant === "income"
            ? "Money coming in. Recurring incomes can have a start/end window."
            : "Money going out. Recurring or a one-time payment."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Field className="gap-2">
          <FieldLabel htmlFor={nameInputId}>Name</FieldLabel>
          <Input
            id={nameInputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={variant === "income" ? "Trabajo principal" : "Renta"}
          />
        </Field>

        <Field className="gap-2" data-invalid={amountInvalid || undefined}>
          <FieldLabel htmlFor={amountInputId}>Amount</FieldLabel>
          <Input
            id={amountInputId}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={amountInvalid || undefined}
            aria-describedby={amountInvalid ? amountErrorId : undefined}
          />
          {amountInvalid && (
            <FieldError id={amountErrorId}>
              Use a positive number with up to 2 decimals.
            </FieldError>
          )}
        </Field>

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
          recurrenceType={recurrenceType}
          setRecurrenceType={setRecurrenceType}
          weekOfMonth={weekOfMonth}
          setWeekOfMonth={setWeekOfMonth}
          dayOfWeek={dayOfWeek}
          setDayOfWeek={setDayOfWeek}
          intervalMonths={intervalMonths}
          setIntervalMonths={setIntervalMonths}
          recurrenceStart={recurrenceStart}
          setRecurrenceStart={setRecurrenceStart}
          domInputId={domInputId}
          noun={noun}
          showWindow={variant === "income"}
        />
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
  recurrenceType: RecurrenceType;
  setRecurrenceType: (v: RecurrenceType) => void;
  weekOfMonth: number | null;
  setWeekOfMonth: (v: number | null) => void;
  dayOfWeek: number | null;
  setDayOfWeek: (v: number | null) => void;
  intervalMonths: number | null;
  setIntervalMonths: (v: number | null) => void;
  recurrenceStart: string | null;
  setRecurrenceStart: (v: string | null) => void;
  domInputId: string;
  noun: string;
  showWindow: boolean; // only incomes expose start/end window
};

const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

// "Last" maps to DB value 5 — the projection / calendar logic treats 5 as
// "Nth if it exists, otherwise the last occurrence", which is exactly what
// "last Friday of the month" means. Labelled plainly here so users don't have
// to puzzle out the "5th / last" alias.
const WEEK_OF_MONTH: Array<{ value: number; label: string }> = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "Last" },
];

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
  recurrenceType,
  setRecurrenceType,
  weekOfMonth,
  setWeekOfMonth,
  dayOfWeek,
  setDayOfWeek,
  intervalMonths,
  setIntervalMonths,
  recurrenceStart,
  setRecurrenceStart,
  domInputId,
  noun,
  showWindow,
}: ScheduleSectionProps) {
  const [advancedOpen, setAdvancedOpen] = useState(
    // Auto-expand if there's already data in there so users see what they have.
    Boolean(startDate || endDate)
  );
  const dateId = useId();
  const startId = useId();
  const endId = useId();

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
      <Eyebrow as="div">Schedule</Eyebrow>

      <FieldSet>
        <FieldLegend variant="label" className="mb-2">
          Type
        </FieldLegend>
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
      </FieldSet>

      {kind === "recurring" ? (
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
          noun={noun}
        />
      ) : (
        <Field className="gap-2">
          <FieldLabel htmlFor={dateId}>Date</FieldLabel>
          <DateField
            id={dateId}
            value={date ?? ""}
            onChange={(d) => setDate(d || null)}
            placeholder="Pick a date"
          />
        </Field>
      )}

      {showWindow && kind === "recurring" && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span>Advanced</span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  advancedOpen && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field className="gap-2">
                <FieldLabel htmlFor={startId}>Start date</FieldLabel>
                <DateField
                  id={startId}
                  value={startDate ?? ""}
                  onChange={(d) => setStartDate(d || null)}
                  placeholder="Plan start"
                  clearable
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor={endId}>End date</FieldLabel>
                <DateField
                  id={endId}
                  value={endDate ?? ""}
                  onChange={(d) => setEndDate(d || null)}
                  placeholder="No end"
                  clearable
                />
              </Field>
            </div>
            <Text variant="small" className="pt-1.5">
              Limit when this income is active. Leave both empty to run from
              plan start to end.
            </Text>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

type RecurrenceFieldsProps = {
  recurrenceType: RecurrenceType;
  setRecurrenceType: (v: RecurrenceType) => void;
  dayOfMonth: string;
  setDayOfMonth: (v: string) => void;
  weekOfMonth: number | null;
  setWeekOfMonth: (v: number | null) => void;
  dayOfWeek: number | null;
  setDayOfWeek: (v: number | null) => void;
  intervalMonths: number | null;
  setIntervalMonths: (v: number | null) => void;
  recurrenceStart: string | null;
  setRecurrenceStart: (v: string | null) => void;
  domInputId: string;
  /** Word used in helper copy — "income", "expense", or "debt payment". */
  noun: string;
};

// Recurrence selector + the type-specific fields underneath. Exported because
// the debt-form dialog uses the same set of fields (debts are always
// recurring, so they skip the kind radio and embed this directly).
export function RecurrenceFields({
  recurrenceType,
  setRecurrenceType,
  dayOfMonth,
  setDayOfMonth,
  weekOfMonth,
  setWeekOfMonth,
  dayOfWeek,
  setDayOfWeek,
  intervalMonths,
  setIntervalMonths,
  recurrenceStart,
  setRecurrenceStart,
  domInputId,
  noun,
}: RecurrenceFieldsProps) {
  const repeatsId = useId();
  const firstMonthId = useId();

  return (
    <div className="flex flex-col gap-3">
      <Field className="gap-2">
        <FieldLabel htmlFor={repeatsId}>Repeats</FieldLabel>
        <Select
          value={recurrenceType}
          onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}
        >
          <SelectTrigger id={repeatsId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly_day">Every month on a day</SelectItem>
            <SelectItem value="monthly_weekday">
              Every month on the Nth weekday
            </SelectItem>
            <SelectItem value="every_n_months">Every N months</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {recurrenceType === "monthly_day" && (
        <Field className="gap-2">
          <FieldLabel htmlFor={domInputId}>Day of month</FieldLabel>
          <Input
            id={domInputId}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            inputMode="numeric"
            placeholder="1"
          />
          <FieldDescription>
            {/* One string: the JSX transform dropped the space after {noun}
                when the sentence ran onto a second line ("incomehits"). */}
            {`When in the month this ${noun} hits (1–31). Day 31 clamps to the last day of months that don't have it.`}
          </FieldDescription>
        </Field>
      )}

      {recurrenceType === "monthly_weekday" && (
        <FieldSet className="gap-2">
          <FieldLegend variant="label" className="mb-2">
            Occurs on the
          </FieldLegend>
          {/* Inline-sentence layout: "the [Last] [Friday] of every month" so
              the relationship between the two selects is obvious without
              separate labels. Wraps to two lines on narrow widths. */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Select
              value={weekOfMonth != null ? String(weekOfMonth) : ""}
              onValueChange={(v) => setWeekOfMonth(parseInt(v, 10))}
            >
              <SelectTrigger className="w-28" aria-label="Week of the month">
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                {WEEK_OF_MONTH.map((w) => (
                  <SelectItem key={w.value} value={String(w.value)}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={dayOfWeek != null ? String(dayOfWeek) : ""}
              onValueChange={(v) => setDayOfWeek(parseInt(v, 10))}
            >
              <SelectTrigger className="w-36" aria-label="Weekday">
                <SelectValue placeholder="Pick day" />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Text variant="muted" as="span">of every month</Text>
          </div>
          <FieldDescription>
            Pick <strong>Last</strong> to always use the last occurrence of the
            chosen weekday (handles months that have only four).
          </FieldDescription>
        </FieldSet>
      )}

      {recurrenceType === "every_n_months" && (
        <div className="flex flex-col gap-3">
          <FieldSet className="gap-2">
            <FieldLegend variant="label" className="mb-2">
              Occurs
            </FieldLegend>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Text variant="muted" as="span">Every</Text>
              <Input
                value={intervalMonths != null ? String(intervalMonths) : ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setIntervalMonths(
                    Number.isFinite(n) && n >= 1 && n <= 12 ? n : null
                  );
                }}
                inputMode="numeric"
                placeholder="3"
                className="w-16 text-center"
                aria-label="Interval in months"
              />
              <Text variant="muted" as="span">months on day</Text>
              <Input
                id={domInputId}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                inputMode="numeric"
                placeholder="1"
                className="w-16 text-center"
                aria-label="Day of month"
              />
            </div>
            <FieldDescription>
              Interval is 1–12 months. Day clamps to the last day in shorter
              months.
            </FieldDescription>
          </FieldSet>
          <Field className="gap-2">
            <FieldLabel htmlFor={firstMonthId}>First month</FieldLabel>
            <MonthPicker
              id={firstMonthId}
              value={recurrenceStart}
              onChange={setRecurrenceStart}
              placeholder="Plan start"
              clearable
            />
            <FieldDescription>
              The month the cycle first lands on. Leave empty to anchor to the
              plan&apos;s start month.
            </FieldDescription>
          </Field>
        </div>
      )}
    </div>
  );
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

/**
 * Lightweight month/year picker for fields where the day is meaningless (e.g.
 * "First month" of a recurring cycle). Stores values as ISO "YYYY-MM-01" so it
 * stays compatible with the existing date columns and string-parsing helpers,
 * but UX-wise the user never sees or picks a day.
 *
 * UX: trigger renders "Month YYYY" (e.g. "January 2027"); popover has a year
 * stepper (◄ 2027 ►) and a 4×3 grid of month buttons. Selected month is
 * highlighted; the current real-world month is outlined for context. The clear
 * button sits inside the control, the same way `DateField` does it.
 */
function MonthPicker({
  id,
  value,
  onChange,
  placeholder,
  clearable,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromISODate(value);
  // Only rendered after a click opens the dialog, so reading the clock here
  // never runs during the server render.
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  // The popover-visible year defaults to the selected value's year, falling
  // back to today's year for new entries.
  const [viewYear, setViewYear] = useState<number>(
    selected ? selected.getFullYear() : todayYear
  );

  const selectedYear = selected?.getFullYear();
  const selectedMonth = selected?.getMonth();
  const showClear = Boolean(clearable && value);

  const trigger = (
    <Popover
      open={open}
      onOpenChange={(o) => {
        // Reset the year-stepper to follow the saved value each time the
        // popover opens, so reopening doesn't strand the user on a year
        // they navigated away from last time.
        if (o) setViewYear(selected ? selected.getFullYear() : todayYear);
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant={showClear ? "ghost" : "outline"}
          className={cn(
            "min-w-0 flex-1 justify-start font-normal",
            showClear && "shadow-none hover:bg-transparent",
            !selected && "text-muted-foreground"
          )}
          type="button"
        >
          <CalendarIcon className="shrink-0" />
          <span className="truncate">
            {selected ? MONTH_LABEL.format(selected) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium">{viewYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewYear((y) => y + 1)}
            aria-label="Next year"
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {MONTH_NAMES.map((name, idx) => {
            const isSelected =
              selectedYear === viewYear && selectedMonth === idx;
            const isCurrent = viewYear === todayYear && idx === todayMonth;
            return (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "ghost"}
                aria-pressed={isSelected}
                aria-current={isCurrent ? "date" : undefined}
                className={cn("h-9", !isSelected && isCurrent && "border border-border")}
                onClick={() => {
                  // ISO "YYYY-MM-01" — day is meaningless for this control
                  // but the DB column is a date, so we pin to day 1.
                  const mm = String(idx + 1).padStart(2, "0");
                  onChange(`${viewYear}-${mm}-01`);
                  setOpen(false);
                }}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (!showClear) {
    return <div className="flex min-w-0 items-center">{trigger}</div>;
  }

  return (
    <InputGroup className="min-w-0">
      {trigger}
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          onClick={() => onChange(null)}
          aria-label="Clear month"
        >
          <X />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export { fromISODate, toISODate };
