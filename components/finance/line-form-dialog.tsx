"use client";

import { useId, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eyebrow, Text } from "@/components/ui/typography";

export type LineKind = "recurring" | "one_time";
export type LineVariant = "income" | "expense";
export type RecurrenceType =
  | "monthly_day"
  | "monthly_weekday"
  | "every_n_months";

export type LineFormValues = {
  name: string;
  monthlyAmount: string;
  kind: LineKind;
  dayOfMonth: number | null;
  date: string | null;
  startDate?: string | null;
  endDate?: string | null;
  // New recurrence model. Defaults to monthly_day so existing flows behave
  // identically; the UI for choosing other types ships with B5.
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
  // B1/B2 recurrence fields — the UI for these is the ScheduleSection's
  // Repeats selector. Default to monthly_day for new entries (identical to
  // the prior behaviour).
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
        // Recurrence fields pass through untouched; defaults to monthly_day.
        recurrenceType,
        weekOfMonth,
        dayOfWeek,
        intervalMonths,
        recurrenceStart,
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

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <Eyebrow as="div" className="tracking-wide">
        Schedule
      </Eyebrow>

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
  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <Label>Repeats</Label>
        <Select
          value={recurrenceType}
          onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}
        >
          <SelectTrigger>
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
      </div>

      {recurrenceType === "monthly_day" && (
        <div className="space-y-1.5">
          <Label htmlFor={domInputId}>Day of month</Label>
          <Input
            id={domInputId}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            inputMode="numeric"
            placeholder="1"
          />
          <Text variant="small">
            When in the month this {noun} hits (1–31). Day 31 clamps to the
            last day of months that don&apos;t have it.
          </Text>
        </div>
      )}

      {recurrenceType === "monthly_weekday" && (
        <div className="space-y-1.5">
          <Label>Occurs on the</Label>
          {/* Inline-sentence layout: "the [Last] [Friday] of every month" so
              the relationship between the two selects is obvious without
              separate labels. Wraps to two lines on narrow widths. */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Select
              value={weekOfMonth != null ? String(weekOfMonth) : ""}
              onValueChange={(v) => setWeekOfMonth(parseInt(v, 10))}
            >
              <SelectTrigger className="w-[110px]">
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
              <SelectTrigger className="w-[140px]">
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
          <Text variant="small">
            Pick <strong>Last</strong> to always use the last occurrence of the
            chosen weekday (handles months that have only four).
          </Text>
        </div>
      )}

      {recurrenceType === "every_n_months" && (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <Label>Occurs</Label>
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
                className="w-[64px] text-center"
                aria-label="Interval in months"
              />
              <Text variant="muted" as="span">months on day</Text>
              <Input
                id={domInputId}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                inputMode="numeric"
                placeholder="1"
                className="w-[64px] text-center"
                aria-label="Day of month"
              />
            </div>
            <Text variant="small">
              Interval is 1–12 months. Day clamps to the last day in shorter
              months.
            </Text>
          </div>
          <div className="space-y-1.5">
            <Label>First month</Label>
            <MonthPicker
              value={recurrenceStart}
              onChange={setRecurrenceStart}
              placeholder="Plan start"
              clearable
            />
            <Text variant="small">
              The month the cycle first lands on. Leave empty to anchor to the
              plan&apos;s start month.
            </Text>
          </div>
        </div>
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
  // The trigger is rendered inside a `relative` wrapper so the clear button
  // can be absolutely positioned on top of the trigger's right edge — this
  // keeps the whole control inside its column even when the parent is a
  // 2-col grid (otherwise `w-full` on the trigger plus a sibling X icon
  // overflows the column width).
  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-start font-normal ${
              clearable && value ? "pr-9" : ""
            }`}
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">
              {selected ? format(selected, "PPP") : placeholder}
            </span>
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
          className="absolute right-0 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            // Don't open the popover when the user only meant to clear.
            e.stopPropagation();
            onChange(null);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * Lightweight month/year picker for fields where the day is meaningless (e.g.
 * "First month" of a recurring cycle). Stores values as ISO "YYYY-MM-01" so it
 * stays compatible with the existing date columns and string-parsing helpers,
 * but UX-wise the user never sees or picks a day.
 *
 * UX: trigger renders "Month YYYY" (e.g. "January 2027"); popover has a year
 * stepper (◄ 2027 ►) and a 4×3 grid of month buttons. Selected month is
 * highlighted; the current real-world month is outlined for context.
 */
function MonthPicker({
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
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  // The popover-visible year defaults to the selected value's year, falling
  // back to today's year for new entries.
  const [viewYear, setViewYear] = useState<number>(
    selected ? selected.getFullYear() : todayYear
  );

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const selectedYear = selected?.getFullYear();
  const selectedMonth = selected?.getMonth();

  return (
    <div className="relative w-full">
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
            variant="outline"
            className={`w-full justify-start font-normal ${
              clearable && value ? "pr-9" : ""
            }`}
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">
              {selected ? format(selected, "MMMM yyyy") : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-3" align="start">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{viewYear}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {monthNames.map((name, idx) => {
              const isSelected =
                selectedYear === viewYear && selectedMonth === idx;
              const isCurrent = viewYear === todayYear && idx === todayMonth;
              return (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "ghost"}
                  className={`h-9 text-sm ${
                    !isSelected && isCurrent
                      ? "border border-border"
                      : ""
                  }`}
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
      {clearable && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear month"
          className="absolute right-0 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export { fromISODate, toISODate };
