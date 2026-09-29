"use client";

import {
  memo,
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eyebrow, Heading, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatDay, formatDayRange, formatMonthLong } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/format";
import {
  periodRangeFor,
  type Period,
} from "@/lib/finance/period";
import type {
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
  FinancePlanWithLines,
  RecurrenceType,
} from "@/types/finance";

import { DebtFormDialog, type DebtFormValues } from "./debt-form-dialog";
import {
  LineFormDialog,
  toISODate,
  type LineFormValues,
} from "./line-form-dialog";

type EntrySide = "income" | "expense" | "debt";

/** The mutation callbacks reject on failure, having already reported it. */
type PlanCalendarProps = {
  plan: FinancePlanWithLines;
  onAddIncome: (input: LineFormValues) => Promise<void>;
  onAddExpense: (input: LineFormValues) => Promise<void>;
  onUpdateIncome: (id: string, input: LineFormValues) => Promise<void>;
  onUpdateExpense: (id: string, input: LineFormValues) => Promise<void>;
  onUpdateDebt: (id: string, input: DebtFormValues) => Promise<void>;
  onUpsertOverride: (input: {
    parentSide: "income" | "expense" | "debt";
    parentId: string;
    monthYear: string;
    action: "skip" | "reschedule" | "amount";
    date?: string | null;
    monthlyAmount?: string | null;
  }) => Promise<void>;
  onDeleteOverride: (input: {
    parentSide: "income" | "expense" | "debt";
    parentId: string;
    monthYear: string;
  }) => Promise<void>;
};

type DayEntry =
  | {
      id: string;
      side: "income";
      name: string;
      amount: number;
      kind: "recurring" | "one_time";
      source: FinancePlanIncome;
    }
  | {
      id: string;
      side: "expense";
      name: string;
      amount: number;
      kind: "recurring" | "one_time";
      source: FinancePlanExpense;
    }
  | {
      id: string;
      side: "debt";
      name: string;
      amount: number;
      kind: "recurring";
      source: FinancePlanDebt;
    };

function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

// Best-effort "what hits the bank this month" amount for display in the
// calendar. For fixed-payment debts that's monthlyPayment. For credit-card-style
// debts the real amount is dynamic (percent of current balance), so we show the
// monthlyPayment hint when present and fall back to the floor as a lower bound.
function debtCalendarAmount(d: FinancePlanDebt): number {
  const payment = Number(d.monthlyPayment);
  if (d.paymentType === "fixed") return payment;
  const floor = Number(d.minPaymentFloor);
  return payment > 0 ? payment : floor;
}

// Resolves the day-of-month an entry hits for a given (year, monthIdx). Returns
// null when the entry skips that month (every_n_months between hits).
type MonthHitResolver = (year: number, monthIdx: number) => number | null;

type RecurrenceShape = {
  recurrenceType: RecurrenceType;
  dayOfMonth: number | null;
  weekOfMonth: number | null;
  dayOfWeek: number | null;
  intervalMonths: number | null;
  recurrenceStart: string | null;
};

// Returns the Nth occurrence of dayOfWeek (0=Sun..6=Sat) inside (year, month).
// Per the product call: when the Nth doesn't exist (e.g. 5th Tuesday in Feb),
// fall back to the LAST occurrence in the month rather than skip.
function nthWeekdayOfMonth(
  year: number,
  monthIdx: number,
  weekOfMonth: number,
  dayOfWeek: number
): number {
  const firstDow = new Date(year, monthIdx, 1).getDay();
  // (target - first + 7) mod 7 gives the offset (0..6) from day 1 to the first
  // occurrence of `dayOfWeek`. Day numbers start at 1.
  const firstOccurrence = 1 + ((dayOfWeek - firstDow + 7) % 7);
  let target = firstOccurrence + (weekOfMonth - 1) * 7;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  if (target > lastDay) target -= 7;
  return target;
}

/** A UTC-midnight instant as the same calendar day at LOCAL midnight. */
function utcToLocalDay(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function recurrenceAnchorKey(
  shape: Pick<RecurrenceShape, "recurrenceType" | "recurrenceStart">,
  planStartMonth: Date
): number | null {
  if (shape.recurrenceType !== "every_n_months") return null;
  if (shape.recurrenceStart) {
    const d = parseISODate(shape.recurrenceStart);
    if (d) return d.getFullYear() * 12 + d.getMonth();
  }
  // startMonth is a UTC-midnight instant; read it in UTC like the projection
  // does, or a negative-offset zone lands the anchor a month early.
  return planStartMonth.getUTCFullYear() * 12 + planStartMonth.getUTCMonth();
}

function buildHitResolver(
  shape: RecurrenceShape,
  planStartMonth: Date
): MonthHitResolver {
  if (
    shape.recurrenceType === "monthly_weekday" &&
    shape.weekOfMonth != null &&
    shape.dayOfWeek != null
  ) {
    const w = shape.weekOfMonth;
    const d = shape.dayOfWeek;
    return (y, m) => nthWeekdayOfMonth(y, m, w, d);
  }
  if (shape.recurrenceType === "every_n_months" && shape.intervalMonths != null) {
    const interval = shape.intervalMonths;
    const anchor = recurrenceAnchorKey(shape, planStartMonth);
    const dom = shape.dayOfMonth ?? 1;
    return (y, m) => {
      if (anchor === null) return null;
      const mk = y * 12 + m;
      if (mk < anchor) return null;
      if ((mk - anchor) % interval !== 0) return null;
      return clampDayInMonth(dom, y, m);
    };
  }
  // monthly_day fallback (and any partially-configured row).
  const dom = shape.dayOfMonth ?? 1;
  return (y, m) => clampDayInMonth(dom, y, m);
}

// Index overrides by `${side}:${parentId}:${monthKey}` so the calendar's per-
// day and per-month loops can look them up in O(1). monthKey = year*12 + month.
function buildOverrideIndex(
  overrides: FinancePlanLineOverride[]
): Map<string, FinancePlanLineOverride> {
  const map = new Map<string, FinancePlanLineOverride>();
  for (const o of overrides) {
    const d = parseISODate(o.monthYear);
    if (!d) continue;
    const mk = d.getFullYear() * 12 + d.getMonth();
    map.set(`${o.parentSide}:${o.parentId}:${mk}`, o);
  }
  return map;
}

// True if a recurring row contributes at all to (year, monthIdx) regardless of
// which day inside. Used by the month-summary strip where day placement
// doesn't matter.
function recurringContributesToMonth(
  shape: Pick<
    RecurrenceShape,
    "recurrenceType" | "intervalMonths" | "recurrenceStart"
  >,
  year: number,
  monthIdx: number,
  planStartMonth: Date
): boolean {
  if (shape.recurrenceType !== "every_n_months") return true;
  if (!shape.intervalMonths || shape.intervalMonths < 1) return true;
  const anchor = recurrenceAnchorKey(shape, planStartMonth);
  if (anchor === null) return true;
  const mk = year * 12 + monthIdx;
  if (mk < anchor) return false;
  return (mk - anchor) % shape.intervalMonths === 0;
}

// Sum of every entry hitting (year, monthIdx). Used by the calendar's monthly
// summary strip. Recurring entries contribute their monthlyAmount once per
// month inside their start/end window AND on cycle months (for every_n_months).
// One-time entries contribute only if their date falls within the month.
function monthTotalsBySide(
  year: number,
  monthIdx: number,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  overrides: FinancePlanLineOverride[],
  planStartMonth: Date
): { income: number; expense: number; debt: number } {
  const monthKey = year * 12 + monthIdx;
  const isOneTimeHit = (iso: string | null): boolean => {
    if (!iso) return false;
    const d = parseISODate(iso);
    return !!d && d.getFullYear() === year && d.getMonth() === monthIdx;
  };
  // Day-precise window check: the resolved hit-day in (year, monthIdx) must
  // fall within [startDate, endDate]. Matches the projection's
  // `dateWithinWindow` so chip placement, month summary and table totals all
  // agree.
  const hitDayWithinWindow = (
    hitDay: number,
    start: string | null,
    end: string | null
  ): boolean => {
    const hitMs = new Date(year, monthIdx, hitDay).getTime();
    if (start) {
      const s = parseISODate(start);
      if (s && new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime() > hitMs) {
        return false;
      }
    }
    if (end) {
      const e = parseISODate(end);
      if (e && new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime() < hitMs) {
        return false;
      }
    }
    return true;
  };

  const overrideIndex = buildOverrideIndex(overrides);
  // Effective amount + skip flag for a recurring row + month, applying any
  // override on top of the row's natural monthlyAmount.
  const effective = (
    side: "income" | "expense" | "debt",
    parentId: string,
    natural: number
  ): { skip: boolean; amount: number } => {
    const ov = overrideIndex.get(`${side}:${parentId}:${monthKey}`);
    if (ov?.action === "skip") return { skip: true, amount: 0 };
    if (ov?.action === "amount" && ov.monthlyAmount !== null) {
      return { skip: false, amount: Number(ov.monthlyAmount) };
    }
    return { skip: false, amount: natural };
  };

  let income = 0;
  let expense = 0;
  let debt = 0;

  for (const inc of incomes) {
    const natural = Number(inc.monthlyAmount);
    if (inc.kind === "one_time") {
      if (isOneTimeHit(inc.date)) income += natural;
    } else if (recurringContributesToMonth(inc, year, monthIdx, planStartMonth)) {
      // Resolve the in-month hit-day via the same calendar helpers, then
      // require it to fall within the income's [startDate, endDate] window.
      const resolver = buildHitResolver(inc, planStartMonth);
      const hitDay = resolver(year, monthIdx);
      if (hitDay === null) continue;
      if (!hitDayWithinWindow(hitDay, inc.startDate, inc.endDate)) continue;
      const { skip, amount } = effective("income", inc.id, natural);
      if (!skip) income += amount;
    }
  }

  for (const exp of expenses) {
    const natural = Number(exp.monthlyAmount);
    if (exp.kind === "one_time") {
      if (isOneTimeHit(exp.date)) expense += natural;
    } else if (recurringContributesToMonth(exp, year, monthIdx, planStartMonth)) {
      const { skip, amount } = effective("expense", exp.id, natural);
      if (!skip) expense += amount;
    }
  }

  for (const d of debts) {
    if (recurringContributesToMonth(d, year, monthIdx, planStartMonth)) {
      const natural = debtCalendarAmount(d);
      const { skip, amount } = effective("debt", d.id, natural);
      if (!skip) debt += amount;
    }
  }

  return { income, expense, debt };
}

// Build the list of income/expense/debt entries that hit each visible day. We
// walk the grid once and bucket entries by their local YYYY-MM-DD key.
function buildDayMap(
  days: Date[],
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  overrides: FinancePlanLineOverride[],
  planStartMonth: Date
): Map<string, DayEntry[]> {
  const map = new Map<string, DayEntry[]>();
  const push = (key: string, entry: DayEntry) => {
    const arr = map.get(key);
    if (arr) arr.push(entry);
    else map.set(key, [entry]);
  };

  const dayMeta = days.map((d) => ({
    date: d,
    key: toISODate(d),
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
  }));

  const overrideIndex = buildOverrideIndex(overrides);

  // Generic recurring placer. The resolver tells us which day-of-month (if
  // any) the entry hits for a given (year, month). Then an override can:
  // skip the month, reschedule to a different date inside it, or swap the
  // amount.
  const pushRecurring = (
    entry: DayEntry,
    side: "income" | "expense" | "debt",
    parentId: string,
    resolver: MonthHitResolver,
    startDate: Date | null,
    endDate: Date | null
  ) => {
    // Compare hit-dates as midnight timestamps so the start/end window is
    // enforced at day precision. This mirrors the projection's
    // `dateWithinWindow` so the calendar chips match the table totals.
    const startMs = startDate
      ? new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate()
        ).getTime()
      : null;
    const endMs = endDate
      ? new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate()
        ).getTime()
      : null;

    for (const meta of dayMeta) {
      const mk = meta.year * 12 + meta.month;
      const ov = overrideIndex.get(`${side}:${parentId}:${mk}`);
      if (ov?.action === "skip") continue;

      // Decide which day inside (year, month) the entry actually lands on.
      let targetDay: number | null;
      if (ov?.action === "reschedule" && ov.date) {
        const od = parseISODate(ov.date);
        targetDay =
          od &&
          od.getFullYear() === meta.year &&
          od.getMonth() === meta.month
            ? od.getDate()
            : null;
      } else {
        targetDay = resolver(meta.year, meta.month);
      }
      if (targetDay === null) continue;
      if (meta.day !== targetDay) continue;

      // Day-precise window: the resolved hit-date itself must fall within
      // [startDate, endDate]. A mid-month start that lands AFTER the hit-day
      // for that month skips the chip (e.g. dayOfMonth=1 + startDate=Jun 15
      // → June is skipped, first chip lands on July 1).
      const hitMs = new Date(meta.year, meta.month, targetDay).getTime();
      if (startMs !== null && hitMs < startMs) continue;
      if (endMs !== null && hitMs > endMs) continue;

      // Swap the amount when the override is an amount override.
      if (ov?.action === "amount" && ov.monthlyAmount !== null) {
        push(meta.key, {
          ...entry,
          amount: Number(ov.monthlyAmount),
        } as DayEntry);
      } else {
        push(meta.key, entry);
      }
    }
  };

  const pushOneTime = (entry: DayEntry, isoDate: string) => {
    const parsed = parseISODate(isoDate);
    if (!parsed) return;
    const key = toISODate(parsed);
    if (!dayMeta.some((m) => m.key === key)) return;
    push(key, entry);
  };

  for (const inc of incomes) {
    const amount = Number(inc.monthlyAmount);
    if (inc.kind === "one_time") {
      if (!inc.date) continue;
      pushOneTime(
        {
          id: inc.id,
          side: "income",
          name: inc.name,
          amount,
          kind: "one_time",
          source: inc,
        },
        inc.date
      );
    } else {
      const start = inc.startDate ? parseISODate(inc.startDate) : null;
      const end = inc.endDate ? parseISODate(inc.endDate) : null;
      pushRecurring(
        {
          id: inc.id,
          side: "income",
          name: inc.name,
          amount,
          kind: "recurring",
          source: inc,
        },
        "income",
        inc.id,
        buildHitResolver(inc, planStartMonth),
        start,
        end
      );
    }
  }

  for (const exp of expenses) {
    const amount = Number(exp.monthlyAmount);
    if (exp.kind === "one_time") {
      if (!exp.date) continue;
      pushOneTime(
        {
          id: exp.id,
          side: "expense",
          name: exp.name,
          amount,
          kind: "one_time",
          source: exp,
        },
        exp.date
      );
    } else {
      pushRecurring(
        {
          id: exp.id,
          side: "expense",
          name: exp.name,
          amount,
          kind: "recurring",
          source: exp,
        },
        "expense",
        exp.id,
        buildHitResolver(exp, planStartMonth),
        null,
        null
      );
    }
  }

  for (const debt of debts) {
    pushRecurring(
      {
        id: debt.id,
        side: "debt",
        name: debt.name,
        amount: debtCalendarAmount(debt),
        kind: "recurring",
        source: debt,
      },
      "debt",
      debt.id,
      buildHitResolver(debt, planStartMonth),
      null,
      null
    );
  }

  return map;
}

function clampDayInMonth(day: number, year: number, monthZeroIdx: number): number {
  const lastDay = new Date(year, monthZeroIdx + 1, 0).getDate();
  return Math.min(day, lastDay);
}

type DialogState =
  | { kind: "none" }
  | { kind: "add"; side: "income" | "expense"; date: string }
  | { kind: "edit-income"; income: FinancePlanIncome }
  | { kind: "edit-expense"; expense: FinancePlanExpense }
  | { kind: "edit-debt"; debt: FinancePlanDebt };

// Tiny payload we put on the native dataTransfer when dragging an entry's
// grip handle. sourceDate is the ISO key of the cell the chip was dragged
// FROM — needed to detect intra-month drops and to decide whether the
// "Just this month" override option is available.
const DND_MIME = "application/x-allstars-finance-entry";
/** One shared empty list, so an empty day's memoised cell sees the same prop. */
const NO_ENTRIES: DayEntry[] = [];
type DragPayload = { id: string; side: EntrySide; sourceDate: string };

// useOptimistic updates — each kind describes a local mutation we apply to the
// plan snapshot the second the user acts, before the server confirms. When
// the wrapping transition resolves (success or failure), React swaps back to
// the canonical `plan` prop, which either reflects the new data (success) or
// the original (failure → toast surfaces the error).
type OptimisticUpdate =
  | {
      kind: "income-move";
      id: string;
      dayOfMonth: number | null;
      date: string | null;
    }
  | {
      kind: "expense-move";
      id: string;
      dayOfMonth: number | null;
      date: string | null;
    }
  | { kind: "debt-move"; id: string; dayOfMonth: number }
  | {
      kind: "upsert-override";
      parentSide: EntrySide;
      parentId: string;
      monthYear: string;
      action: "skip" | "reschedule" | "amount";
      date?: string | null;
      monthlyAmount?: string | null;
    }
  | {
      kind: "delete-override";
      parentSide: EntrySide;
      parentId: string;
      monthYear: string;
    };

function applyOptimistic(
  plan: FinancePlanWithLines,
  update: OptimisticUpdate
): FinancePlanWithLines {
  switch (update.kind) {
    case "income-move":
      return {
        ...plan,
        incomes: plan.incomes.map((i) =>
          i.id === update.id
            ? { ...i, dayOfMonth: update.dayOfMonth, date: update.date }
            : i
        ),
      };
    case "expense-move":
      return {
        ...plan,
        expenses: plan.expenses.map((e) =>
          e.id === update.id
            ? { ...e, dayOfMonth: update.dayOfMonth, date: update.date }
            : e
        ),
      };
    case "debt-move":
      return {
        ...plan,
        debts: plan.debts.map((d) =>
          d.id === update.id ? { ...d, dayOfMonth: update.dayOfMonth } : d
        ),
      };
    case "upsert-override": {
      const matches = (o: FinancePlanLineOverride) =>
        o.parentSide === update.parentSide &&
        o.parentId === update.parentId &&
        o.monthYear === update.monthYear;
      const next: FinancePlanLineOverride = {
        // The id will be replaced by the canonical row once the server
        // responds; a sentinel is fine for the optimistic window.
        id: `optimistic-${update.parentSide}-${update.parentId}-${update.monthYear}`,
        planId: plan.id,
        parentSide: update.parentSide,
        parentId: update.parentId,
        monthYear: update.monthYear,
        action: update.action,
        date: update.action === "reschedule" ? update.date ?? null : null,
        monthlyAmount:
          update.action === "amount" ? update.monthlyAmount ?? null : null,
        createdAt: new Date(),
      };
      const existing = plan.overrides.findIndex(matches);
      const overrides =
        existing >= 0
          ? plan.overrides.map((o, i) => (i === existing ? next : o))
          : [...plan.overrides, next];
      return { ...plan, overrides };
    }
    case "delete-override":
      return {
        ...plan,
        overrides: plan.overrides.filter(
          (o) =>
            !(
              o.parentSide === update.parentSide &&
              o.parentId === update.parentId &&
              o.monthYear === update.monthYear
            )
        ),
      };
  }
}

export function PlanCalendar({
  plan,
  onAddIncome,
  onAddExpense,
  onUpdateIncome,
  onUpdateExpense,
  onUpdateDebt,
  onUpsertOverride,
  onDeleteOverride,
}: PlanCalendarProps) {
  // Open on the current month — that's the most actionable view ("what's
  // happening this month?"). The "Plan start" button still jumps back to the
  // plan's beginning when the user needs the long view.
  // The cursor is a DAY inside the period to show. It used to be the 1st of the
  // month, which with an anchor day > 1 always belongs to the PREVIOUS period —
  // the calendar opened one period back and "Today" led there too.
  const todayMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const planStartMonth = useMemo(() => {
    const d = new Date(plan.startMonth);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [plan.startMonth]);

  const [cursor, setCursor] = useState<Date>(todayMonth);
  const [viewMode, setViewMode] = useState<"anchored" | "month">("anchored");
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Period anchor day. 0 (feature disabled) collapses to day=1 — equivalent
  // to calendar months, which is the "Month" view anyway.
  const anchorDay =
    plan.confirmationDayOfMonth > 0 ? plan.confirmationDayOfMonth : 1;

  // Resolved "what to display": either a confirmation-day-anchored period
  // (day N → day N-1 of next month) or the cursor's calendar month.
  // `periodRangeFor` works in UTC; everything below (the week grid, the
  // summary, the muted test) works in LOCAL days. Convert once here, or a
  // negative-offset zone shifts the whole period a day early and the period's
  // last day renders greyed out with its entries missing from the totals.
  const currentRange = useMemo<Period>(() => {
    if (viewMode === "anchored") {
      const r = periodRangeFor(
        new Date(
          Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
        ),
        anchorDay
      );
      return { start: utcToLocalDay(r.start), end: utcToLocalDay(r.end) };
    }
    return { start: startOfMonth(cursor), end: endOfMonth(cursor) };
  }, [viewMode, cursor, anchorDay]);

  const previousRange = useMemo<Period>(() => {
    if (viewMode === "anchored") {
      // One day before the period start lies in the previous period.
      const s = currentRange.start;
      const prevDate = new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate() - 1));
      const r = periodRangeFor(prevDate, anchorDay);
      return { start: utcToLocalDay(r.start), end: utcToLocalDay(r.end) };
    }
    const prevCursor = subMonths(cursor, 1);
    return {
      start: startOfMonth(prevCursor),
      end: endOfMonth(prevCursor),
    };
  }, [viewMode, cursor, anchorDay, currentRange.start]);

  // Optimistic snapshot — every operation that touches the plan applies its
  // change here first, so chips jump to the new position the moment the user
  // confirms. The wrapping startTransition keeps this state alive until the
  // server action resolves; on rejection it reverts automatically.
  const [optimisticPlan, addOptimistic] = useOptimistic<
    FinancePlanWithLines,
    OptimisticUpdate
  >(plan, applyOptimistic);
  const [, startOptimisticTransition] = useTransition();
  // Stashed drag → AlertDialog → user picks "Move all" / "Just this month".
  const [pendingDrop, setPendingDrop] = useState<{
    payload: DragPayload;
    targetKey: string;
  } | null>(null);

  // Keyed on the range's timestamps: the Date objects themselves are new on
  // every render, which rebuilt the grid (and the day map under it) on every
  // drag-over.
  const rangeStartMs = currentRange.start.getTime();
  const rangeEndMs = currentRange.end.getTime();
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(new Date(rangeStartMs), { weekStartsOn: 0 }),
        end: endOfWeek(new Date(rangeEndMs), { weekStartsOn: 0 }),
      }),
    [rangeStartMs, rangeEndMs]
  );

  // dayMap + summary read from the OPTIMISTIC snapshot so the calendar
  // surface updates instantly on user actions, before the server roundtrip.
  // Handler closures below still read `plan.*` (canonical) when looking up
  // the parent record being acted on.
  const dayMap = useMemo(
    () =>
      buildDayMap(
        days,
        optimisticPlan.incomes,
        optimisticPlan.expenses,
        optimisticPlan.debts,
        optimisticPlan.overrides,
        optimisticPlan.startMonth
      ),
    [
      days,
      optimisticPlan.incomes,
      optimisticPlan.expenses,
      optimisticPlan.debts,
      optimisticPlan.overrides,
      optimisticPlan.startMonth,
    ]
  );

  // Summary for the displayed range and the one before it (month → month or
  // period → period), so we can show a current-vs-prev delta per metric.
  // Calendar-month view delegates to the existing month aggregator; the
  // anchored view sums per-day entries computed by `buildDayMap` over the
  // period range, so the same entry contributes only to the period it
  // actually hits in.
  const summary = useMemo(() => {
    const summarize = (range: Period) => {
      if (viewMode === "month") {
        return monthTotalsBySide(
          range.start.getFullYear(),
          range.start.getMonth(),
          optimisticPlan.incomes,
          optimisticPlan.expenses,
          optimisticPlan.debts,
          optimisticPlan.overrides,
          optimisticPlan.startMonth
        );
      }
      const rangeDays = eachDayOfInterval({
        start: range.start,
        end: range.end,
      });
      const rangeMap = buildDayMap(
        rangeDays,
        optimisticPlan.incomes,
        optimisticPlan.expenses,
        optimisticPlan.debts,
        optimisticPlan.overrides,
        optimisticPlan.startMonth
      );
      let income = 0;
      let expense = 0;
      let debt = 0;
      for (const entries of rangeMap.values()) {
        for (const e of entries) {
          if (e.side === "income") income += e.amount;
          else if (e.side === "expense") expense += e.amount;
          else debt += e.amount;
        }
      }
      return { income, expense, debt };
    };

    const curr = summarize(currentRange);
    const prev = summarize(previousRange);
    return {
      curr,
      prev,
      currNet: curr.income - curr.expense - curr.debt,
      prevNet: prev.income - prev.expense - prev.debt,
    };
  }, [
    viewMode,
    currentRange,
    previousRange,
    optimisticPlan.incomes,
    optimisticPlan.expenses,
    optimisticPlan.debts,
    optimisticPlan.overrides,
    optimisticPlan.startMonth,
  ]);

  const monthLabel =
    viewMode === "anchored"
      ? formatDayRange(currentRange.start, currentRange.end)
      : formatMonthLong(cursor);

  // The save failures propagate: the dialog stays open, and the caller has
  // already toasted.
  const handleAdd = async (values: LineFormValues) => {
    if (dialog.kind !== "add") return;
    if (dialog.side === "income") await onAddIncome(values);
    else await onAddExpense(values);
  };

  const handleEditIncome = async (values: LineFormValues) => {
    if (dialog.kind !== "edit-income") return;
    await onUpdateIncome(dialog.income.id, values);
  };

  const handleEditExpense = async (values: LineFormValues) => {
    if (dialog.kind !== "edit-expense") return;
    await onUpdateExpense(dialog.expense.id, values);
  };

  const handleEditDebt = async (values: DebtFormValues) => {
    if (dialog.kind !== "edit-debt") return;
    await onUpdateDebt(dialog.debt.id, values);
  };

  const openEditFor = useCallback(
    (entry: DayEntry) => {
      if (entry.side === "income") {
        const income = plan.incomes.find((i) => i.id === entry.id);
        if (income) setDialog({ kind: "edit-income", income });
      } else if (entry.side === "expense") {
        const expense = plan.expenses.find((e) => e.id === entry.id);
        if (expense) setDialog({ kind: "edit-expense", expense });
      } else {
        const debt = plan.debts.find((d) => d.id === entry.id);
        if (debt) setDialog({ kind: "edit-debt", debt });
      }
    },
    [plan.incomes, plan.expenses, plan.debts]
  );

  // "Move all" path — applies the existing global update to the parent record.
  // Income/expense one-time entries get their `date` rewritten; recurring
  // entries change `dayOfMonth` (or whatever else makes sense for the
  // recurrence type), which ripples to every month.
  const applyMoveAll = useCallback(
    (targetKey: string, payload: DragPayload) => {
      const target = parseISODate(targetKey);
      if (!target) return;

      if (payload.side === "income") {
        const income = plan.incomes.find((i) => i.id === payload.id);
        if (!income) return;
        const isOneTime = income.kind === "one_time";
        if (isOneTime && income.date === targetKey) return;
        if (
          !isOneTime &&
          income.recurrenceType === "monthly_day" &&
          (income.dayOfMonth ?? 1) === target.getDate()
        )
          return;
        startOptimisticTransition(async () => {
          addOptimistic({
            kind: "income-move",
            id: income.id,
            dayOfMonth: isOneTime ? null : target.getDate(),
            date: isOneTime ? targetKey : null,
          });
          try {
            await onUpdateIncome(income.id, {
              name: income.name,
              monthlyAmount: income.monthlyAmount,
              kind: income.kind,
              dayOfMonth: isOneTime ? null : target.getDate(),
              date: isOneTime ? targetKey : null,
              startDate: income.startDate,
              endDate: income.endDate,
              // Dropping on a day means "this day every month". A weekday or
              // every-N rule would keep ignoring dayOfMonth and snap back.
              recurrenceType: isOneTime ? income.recurrenceType : "monthly_day",
              weekOfMonth: isOneTime ? income.weekOfMonth : null,
              dayOfWeek: isOneTime ? income.dayOfWeek : null,
              intervalMonths: income.intervalMonths,
              recurrenceStart: income.recurrenceStart,
            });
            toast.success(
              isOneTime
                ? `Income moved to ${formatDay(target)}`
                : `Income now hits day ${target.getDate()} of every month`
            );
          } catch {
            // Reported by the caller; the optimistic move reverts on its own.
          }
        });
        return;
      }

      if (payload.side === "expense") {
        const expense = plan.expenses.find((e) => e.id === payload.id);
        if (!expense) return;
        const isOneTime = expense.kind === "one_time";
        if (isOneTime && expense.date === targetKey) return;
        if (
          !isOneTime &&
          expense.recurrenceType === "monthly_day" &&
          (expense.dayOfMonth ?? 1) === target.getDate()
        )
          return;
        startOptimisticTransition(async () => {
          addOptimistic({
            kind: "expense-move",
            id: expense.id,
            dayOfMonth: isOneTime ? null : target.getDate(),
            date: isOneTime ? targetKey : null,
          });
          try {
            await onUpdateExpense(expense.id, {
              name: expense.name,
              monthlyAmount: expense.monthlyAmount,
              kind: expense.kind,
              dayOfMonth: isOneTime ? null : target.getDate(),
              date: isOneTime ? targetKey : null,
              // Dropping on a day means "this day every month". A weekday or
              // every-N rule would keep ignoring dayOfMonth and snap back.
              recurrenceType: isOneTime ? expense.recurrenceType : "monthly_day",
              weekOfMonth: isOneTime ? expense.weekOfMonth : null,
              dayOfWeek: isOneTime ? expense.dayOfWeek : null,
              intervalMonths: expense.intervalMonths,
              recurrenceStart: expense.recurrenceStart,
            });
            toast.success(
              isOneTime
                ? `Expense moved to ${formatDay(target)}`
                : `Expense now hits day ${target.getDate()} of every month`
            );
          } catch {
            // Reported by the caller; the optimistic move reverts on its own.
          }
        });
        return;
      }

      // debt — always recurring
      const debt = plan.debts.find((d) => d.id === payload.id);
      if (!debt) return;
      if ((debt.dayOfMonth ?? 1) === target.getDate()) return;
      startOptimisticTransition(async () => {
        addOptimistic({
          kind: "debt-move",
          id: debt.id,
          dayOfMonth: target.getDate(),
        });
        try {
          await onUpdateDebt(debt.id, {
            name: debt.name,
            initialBalance: debt.initialBalance,
            monthlyInterestRate: debt.monthlyInterestRate,
            monthlyPayment: debt.monthlyPayment,
            paymentType: debt.paymentType,
            minPaymentPercent: debt.minPaymentPercent,
            minPaymentFloor: debt.minPaymentFloor,
            dayOfMonth: target.getDate(),
            // Same as incomes/expenses: the drop makes it a day-of-month rule.
            recurrenceType: "monthly_day",
            weekOfMonth: null,
            dayOfWeek: null,
            intervalMonths: debt.intervalMonths,
            recurrenceStart: debt.recurrenceStart,
          });
          toast.success(
            `Debt payment now scheduled for day ${target.getDate()} of every month`
          );
        } catch {
          // Reported by the caller; the optimistic move reverts on its own.
        }
      });
    },
    [
      plan.incomes,
      plan.expenses,
      plan.debts,
      addOptimistic,
      onUpdateIncome,
      onUpdateExpense,
      onUpdateDebt,
    ]
  );

  // Skip this month — writes a skip override for the chip's month. Used by
  // the per-chip "⋯" menu so users can pause a recurring entry without
  // touching the schedule.
  const handleSkipMonth = useCallback(
    (
      side: "income" | "expense" | "debt",
      parentId: string,
      dayKey: string
    ) => {
      const d = parseISODate(dayKey);
      if (!d) return;
      const monthYear = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
      // useOptimistic only persists the update while a transition is in
      // flight, so we wrap the server call here. If the server rejects, the
      // optimistic patch is dropped automatically and the toast surfaces.
      startOptimisticTransition(async () => {
        addOptimistic({
          kind: "upsert-override",
          parentSide: side,
          parentId,
          monthYear,
          action: "skip",
        });
        try {
          await onUpsertOverride({
            parentSide: side,
            parentId,
            monthYear,
            action: "skip",
          });
          toast.success(`Skipped for ${formatMonthLong(d)}`);
        } catch {
          // Reported by the caller; the optimistic skip reverts on its own.
        }
      });
    },
    [addOptimistic, onUpsertOverride]
  );

  // Remove any per-month override for the chip's month — used to "undo" a
  // skip / amount / reschedule and restore the natural cadence.
  const handleResetMonth = useCallback(
    (
      side: "income" | "expense" | "debt",
      parentId: string,
      dayKey: string
    ) => {
      const d = parseISODate(dayKey);
      if (!d) return;
      const monthYear = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
      startOptimisticTransition(async () => {
        addOptimistic({
          kind: "delete-override",
          parentSide: side,
          parentId,
          monthYear,
        });
        try {
          await onDeleteOverride({ parentSide: side, parentId, monthYear });
          toast.success(`Override cleared for ${formatMonthLong(d)}`);
        } catch {
          // Reported by the caller; the optimistic change reverts on its own.
        }
      });
    },
    [addOptimistic, onDeleteOverride]
  );

  // "Just this month" path — writes a reschedule override pinned to the source
  // month so the parent's recurring cadence stays untouched. Restricted to
  // intra-month drops (the override stores monthYear of the source).
  const applyJustThisMonth = useCallback(
    (sourceKey: string, targetKey: string, payload: DragPayload) => {
      const source = parseISODate(sourceKey);
      const target = parseISODate(targetKey);
      if (!source || !target) return;
      if (
        source.getFullYear() !== target.getFullYear() ||
        source.getMonth() !== target.getMonth()
      ) {
        toast.error("Just-this-month moves must stay within the same month");
        return;
      }
      const monthYear = toISODate(
        new Date(source.getFullYear(), source.getMonth(), 1)
      );
      startOptimisticTransition(async () => {
        addOptimistic({
          kind: "upsert-override",
          parentSide: payload.side,
          parentId: payload.id,
          monthYear,
          action: "reschedule",
          date: targetKey,
        });
        try {
          await onUpsertOverride({
            parentSide: payload.side,
            parentId: payload.id,
            monthYear,
            action: "reschedule",
            date: targetKey,
          });
          toast.success(
            `Moved to ${formatDay(target)} for ${formatMonthLong(source)} only`
          );
        } catch {
          // Reported by the caller; the optimistic move reverts on its own.
        }
      });
    },
    [addOptimistic, onUpsertOverride]
  );

  // Drag-end dispatcher. one-time → just move (no prompt needed). recurring
  // → stash the pending drop and let the AlertDialog ask the user whether to
  // change the whole schedule or just this month.
  const handleDrop = useCallback(
    (targetKey: string, payload: DragPayload) => {
      // No-op when the chip is dropped back on its own cell — nothing to ask
      // about and nothing to save. Avoids the prompt flashing for accidental
      // grip-drops that don't actually move the chip.
      if (payload.sourceDate === targetKey) return;
      let isRecurring = false;
      if (payload.side === "income") {
        const inc = plan.incomes.find((i) => i.id === payload.id);
        if (!inc) return;
        isRecurring = inc.kind === "recurring";
      } else if (payload.side === "expense") {
        const exp = plan.expenses.find((e) => e.id === payload.id);
        if (!exp) return;
        isRecurring = exp.kind === "recurring";
      } else {
        isRecurring = true;
      }
      if (!isRecurring) {
        void applyMoveAll(targetKey, payload);
        return;
      }
      setPendingDrop({ payload, targetKey });
    },
    [plan.incomes, plan.expenses, applyMoveAll]
  );

  // Stable per-cell handlers that take the cell's key, so a memoised cell only
  // re-renders when its own props change — not on every drag-over elsewhere.
  const toggleExpand = useCallback(
    (key: string) => setExpandedDay((prev) => (prev === key ? null : key)),
    []
  );
  const openAdd = useCallback(
    (side: "income" | "expense", key: string) =>
      setDialog({ kind: "add", side, date: key }),
    []
  );
  const skipMonthFor = useCallback(
    (entry: DayEntry, key: string) => handleSkipMonth(entry.side, entry.id, key),
    [handleSkipMonth]
  );
  const resetMonthFor = useCallback(
    (entry: DayEntry, key: string) => handleResetMonth(entry.side, entry.id, key),
    [handleResetMonth]
  );
  const dropOn = useCallback(
    (key: string, payload: DragPayload) => {
      setDragOverDay(null);
      handleDrop(key, payload);
    },
    [handleDrop]
  );
  const dragEnterCell = useCallback((key: string) => setDragOverDay(key), []);
  const dragLeaveCell = useCallback(
    (key: string) => setDragOverDay((prev) => (prev === key ? null : prev)),
    []
  );

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                viewMode === "anchored" ? "Previous period" : "Previous month"
              }
              onClick={() => {
                if (viewMode === "anchored") {
                  const prevDay = new Date(currentRange.start);
                  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
                  setCursor(prevDay);
                } else {
                  setCursor((c) => addMonths(c, -1));
                }
              }}
            >
              <ChevronLeft />
            </Button>
            <Heading
              level="h5"
              as="h2"
              aria-live="polite"
              className="min-w-0 text-center sm:min-w-45"
            >
              {monthLabel}
            </Heading>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                viewMode === "anchored" ? "Next period" : "Next month"
              }
              onClick={() => {
                if (viewMode === "anchored") {
                  const nextDay = new Date(currentRange.end);
                  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                  setCursor(nextDay);
                } else {
                  setCursor((c) => addMonths(c, 1));
                }
              }}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              size="sm"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as "anchored" | "month")}
              aria-label="Calendar view mode"
            >
              <ToggleGroupItem value="anchored">Anchored</ToggleGroupItem>
              <ToggleGroupItem value="month">Month</ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(planStartMonth)}
            >
              Plan start
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(todayMonth)}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block size-2 rounded-full bg-success" />
            Income
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block size-2 rounded-full bg-warning" />
            Expense
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block size-2 rounded-full bg-destructive" />
            Debt
          </span>
          <span className="ml-auto text-2xs italic text-muted-foreground/70">
            Click an entry to edit · drag the ⋮ handle to move · “+N more” expands a day
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div
          aria-hidden="true"
          className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = toISODate(day);
            const entries = dayMap.get(key) ?? NO_ENTRIES;
            // In anchored mode, "muted" means outside the current period.
            // In month mode it falls back to outside the cursor's month.
            const muted =
              viewMode === "anchored"
                ? day < currentRange.start || day > currentRange.end
                : !isSameMonth(day, cursor);
            // Highlight the configured confirmation day in each rendered
            // calendar month — clamped to month-end so day-31 in February
            // shows on Feb 28/29.
            const lastDayOfMonth = new Date(
              day.getFullYear(),
              day.getMonth() + 1,
              0
            ).getDate();
            const clampedAnchor = Math.min(anchorDay, lastDayOfMonth);
            const isAnchor =
              plan.confirmationDayOfMonth > 0 &&
              day.getDate() === clampedAnchor;
            return (
              <CalendarCell
                key={key}
                day={day}
                isoKey={key}
                entries={entries}
                muted={muted}
                isCurrent={isToday(day)}
                isAnchor={isAnchor}
                isExpanded={expandedDay === key}
                isDragOver={dragOverDay === key}
                onToggleExpand={toggleExpand}
                onAdd={openAdd}
                onEditEntry={openEditFor}
                onSkipMonth={skipMonthFor}
                onResetMonth={resetMonthFor}
                onDropEntry={dropOn}
                onDragEnterCell={dragEnterCell}
                onDragLeaveCell={dragLeaveCell}
              />
            );
          })}
        </div>

        <MonthSummaryStrip summary={summary} />
      </CardContent>

      <LineFormDialog
        open={dialog.kind === "add"}
        onOpenChange={(o) => (o ? null : setDialog({ kind: "none" }))}
        variant={dialog.kind === "add" ? dialog.side : "income"}
        defaultDate={dialog.kind === "add" ? dialog.date : undefined}
        initial={
          dialog.kind === "add"
            ? { kind: "one_time", date: dialog.date }
            : undefined
        }
        onSubmit={handleAdd}
      />

      <LineFormDialog
        open={dialog.kind === "edit-income"}
        onOpenChange={(o) => (o ? null : setDialog({ kind: "none" }))}
        variant="income"
        initial={
          dialog.kind === "edit-income"
            ? {
                id: dialog.income.id,
                name: dialog.income.name,
                monthlyAmount: dialog.income.monthlyAmount,
                kind: dialog.income.kind,
                dayOfMonth: dialog.income.dayOfMonth,
                date: dialog.income.date,
                startDate: dialog.income.startDate,
                endDate: dialog.income.endDate,
                recurrenceType: dialog.income.recurrenceType,
                weekOfMonth: dialog.income.weekOfMonth,
                dayOfWeek: dialog.income.dayOfWeek,
                intervalMonths: dialog.income.intervalMonths,
                recurrenceStart: dialog.income.recurrenceStart,
              }
            : undefined
        }
        onSubmit={handleEditIncome}
      />

      <LineFormDialog
        open={dialog.kind === "edit-expense"}
        onOpenChange={(o) => (o ? null : setDialog({ kind: "none" }))}
        variant="expense"
        initial={
          dialog.kind === "edit-expense"
            ? {
                id: dialog.expense.id,
                name: dialog.expense.name,
                monthlyAmount: dialog.expense.monthlyAmount,
                kind: dialog.expense.kind,
                dayOfMonth: dialog.expense.dayOfMonth,
                date: dialog.expense.date,
                recurrenceType: dialog.expense.recurrenceType,
                weekOfMonth: dialog.expense.weekOfMonth,
                dayOfWeek: dialog.expense.dayOfWeek,
                intervalMonths: dialog.expense.intervalMonths,
                recurrenceStart: dialog.expense.recurrenceStart,
              }
            : undefined
        }
        onSubmit={handleEditExpense}
      />

      <DebtFormDialog
        open={dialog.kind === "edit-debt"}
        onOpenChange={(o) => (o ? null : setDialog({ kind: "none" }))}
        initial={
          dialog.kind === "edit-debt"
            ? {
                id: dialog.debt.id,
                name: dialog.debt.name,
                initialBalance: dialog.debt.initialBalance,
                monthlyInterestRate: dialog.debt.monthlyInterestRate,
                monthlyPayment: dialog.debt.monthlyPayment,
                paymentType: dialog.debt.paymentType,
                minPaymentPercent: dialog.debt.minPaymentPercent,
                minPaymentFloor: dialog.debt.minPaymentFloor,
                dayOfMonth: dialog.debt.dayOfMonth,
                recurrenceType: dialog.debt.recurrenceType,
                weekOfMonth: dialog.debt.weekOfMonth,
                dayOfWeek: dialog.debt.dayOfWeek,
                intervalMonths: dialog.debt.intervalMonths,
                recurrenceStart: dialog.debt.recurrenceStart,
              }
            : undefined
        }
        onSubmit={handleEditDebt}
      />

      <MoveRecurringPrompt
        pending={pendingDrop}
        onCancel={() => setPendingDrop(null)}
        onMoveAll={() => {
          if (!pendingDrop) return;
          const drop = pendingDrop;
          setPendingDrop(null);
          void applyMoveAll(drop.targetKey, drop.payload);
        }}
        onJustThisMonth={() => {
          if (!pendingDrop) return;
          const drop = pendingDrop;
          setPendingDrop(null);
          void applyJustThisMonth(
            drop.payload.sourceDate,
            drop.targetKey,
            drop.payload
          );
        }}
        onEditDetails={() => {
          // Drop the pending drag and route the user straight to the parent
          // edit dialog so they can configure recurrence + amount in full
          // instead of choosing one of the canned drop semantics.
          if (!pendingDrop) return;
          const { payload } = pendingDrop;
          setPendingDrop(null);
          if (payload.side === "income") {
            const income = plan.incomes.find((i) => i.id === payload.id);
            if (income) setDialog({ kind: "edit-income", income });
          } else if (payload.side === "expense") {
            const expense = plan.expenses.find((e) => e.id === payload.id);
            if (expense) setDialog({ kind: "edit-expense", expense });
          } else {
            const debt = plan.debts.find((d) => d.id === payload.id);
            if (debt) setDialog({ kind: "edit-debt", debt });
          }
        }}
      />
    </Card>
  );
}

// Prompt the user when a recurring entry is dragged: change the schedule for
// every month going forward, override just this month, or punt to the full
// edit dialog for everything else (amount-only override, recurrence-model
// changes, etc.). Cross-month drops disable the "Just this month" option
// since overrides are scoped to the source month.
function MoveRecurringPrompt({
  pending,
  onCancel,
  onMoveAll,
  onJustThisMonth,
  onEditDetails,
}: {
  pending: { payload: DragPayload; targetKey: string } | null;
  onCancel: () => void;
  onMoveAll: () => void;
  onJustThisMonth: () => void;
  onEditDetails: () => void;
}) {
  const sourceDate = pending ? parseISODate(pending.payload.sourceDate) : null;
  const targetDate = pending ? parseISODate(pending.targetKey) : null;
  const sameMonth =
    !!sourceDate &&
    !!targetDate &&
    sourceDate.getFullYear() === targetDate.getFullYear() &&
    sourceDate.getMonth() === targetDate.getMonth();

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(o) => (o ? null : onCancel())}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move this entry</AlertDialogTitle>
          <AlertDialogDescription>
            {targetDate && sourceDate ? (
              <>
                From <strong>{formatDay(sourceDate)}</strong> to{" "}
                <strong>{formatDay(targetDate)}</strong>. Pick the simplest
                action below, or open <em>Edit details</em> to tweak amount,
                recurrence type and start/end window.
              </>
            ) : (
              "Pick an action, or open Edit details for the full form."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          <AlertDialogCancel className="sm:mr-auto">Cancel</AlertDialogCancel>
          <AlertDialogAction variant="outline" onClick={onEditDetails}>
            Edit details…
          </AlertDialogAction>
          {sameMonth ? (
            <AlertDialogAction variant="secondary" onClick={onJustThisMonth}>
              Just this month
            </AlertDialogAction>
          ) : (
            // A disabled button gets no pointer or focus events, so the
            // explanation hangs off a focusable wrapper.
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex rounded-md">
                  <AlertDialogAction variant="secondary" disabled className="w-full">
                    Just this month
                  </AlertDialogAction>
                </span>
              </TooltipTrigger>
              <TooltipContent>Cross-month overrides aren&apos;t supported yet</TooltipContent>
            </Tooltip>
          )}
          <AlertDialogAction onClick={onMoveAll}>Move all</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type MonthSummaryData = {
  curr: { income: number; expense: number; debt: number };
  prev: { income: number; expense: number; debt: number };
  currNet: number;
  prevNet: number;
};

// Strip above the calendar grid: 4 cards (Income / Expense / Debt / Net) with
// the current month's value and a delta vs the previous month. Delta colour is
// semantic (more income = good, more expense/debt = bad).
function MonthSummaryStrip({ summary }: { summary: MonthSummaryData }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryTile
        label="Income"
        value={summary.curr.income}
        delta={summary.curr.income - summary.prev.income}
        biggerIsBetter
      />
      <SummaryTile
        label="Expense"
        value={summary.curr.expense}
        delta={summary.curr.expense - summary.prev.expense}
        biggerIsBetter={false}
      />
      <SummaryTile
        label="Debt"
        value={summary.curr.debt}
        delta={summary.curr.debt - summary.prev.debt}
        biggerIsBetter={false}
      />
      <SummaryTile
        label="Net"
        value={summary.currNet}
        delta={summary.currNet - summary.prevNet}
        biggerIsBetter
        signedValue
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  delta,
  biggerIsBetter,
  signedValue = false,
}: {
  label: string;
  value: number;
  delta: number;
  biggerIsBetter: boolean;
  /** When true (Net only), display the value with an explicit +/− sign. */
  signedValue?: boolean;
}) {
  const deltaRounded = Math.round(delta * 100) / 100;
  const direction =
    Math.abs(deltaRounded) < 0.005 ? "flat" : deltaRounded > 0 ? "up" : "down";
  // good = up && biggerIsBetter, or down && !biggerIsBetter.
  const good =
    direction === "up"
      ? biggerIsBetter
      : direction === "down"
        ? !biggerIsBetter
        : null;
  const deltaColor =
    good === null
      ? "text-muted-foreground"
      : good
        ? "text-success"
        : "text-destructive";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "·";
  const directionText =
    direction === "up" ? "up" : direction === "down" ? "down" : "";

  const displayValue = signedValue
    ? `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`
    : formatCurrency(value);
  const valueColor = signedValue
    ? value >= 0
      ? "text-success"
      : "text-destructive"
    : "";

  return (
    <div className="rounded-lg border p-2.5">
      <Eyebrow size="sm" as="div">
        {label}
      </Eyebrow>
      <Mono as="div" className={cn("mt-0.5 text-base font-semibold", valueColor)}>
        {displayValue}
      </Mono>
      <Mono as="div" className={cn("text-2xs", deltaColor)}>
        <span aria-hidden="true">{arrow}</span>{" "}
        {direction === "flat"
          ? "no change"
          : `${directionText} ${formatCurrency(Math.abs(deltaRounded))} vs prev`}
      </Mono>
    </div>
  );
}

type CalendarCellProps = {
  day: Date;
  isoKey: string;
  entries: DayEntry[];
  muted: boolean;
  isCurrent: boolean;
  /** True on the confirmation-day anchor (clamped to month-end). */
  isAnchor: boolean;
  isExpanded: boolean;
  isDragOver: boolean;
  // Every handler takes the cell's key (or the entry) rather than being bound
  // per cell, so the parent can hand the same functions to all ~42 cells.
  onToggleExpand: (key: string) => void;
  onAdd: (side: "income" | "expense", key: string) => void;
  onEditEntry: (entry: DayEntry) => void;
  onSkipMonth: (entry: DayEntry, key: string) => void;
  onResetMonth: (entry: DayEntry, key: string) => void;
  onDropEntry: (key: string, payload: DragPayload) => void;
  onDragEnterCell: (key: string) => void;
  onDragLeaveCell: (key: string) => void;
};

/**
 * One day. The cell itself is not interactive: everything it does lives on a
 * real button inside it (add, each entry, its menu, "+N more"), so nothing
 * interactive is nested in anything else and all of it is keyboard-reachable.
 */
const CalendarCell = memo(function CalendarCell({
  day,
  isoKey,
  entries,
  muted,
  isCurrent,
  isAnchor,
  isExpanded,
  isDragOver,
  onToggleExpand,
  onAdd,
  onEditEntry,
  onSkipMonth,
  onResetMonth,
  onDropEntry,
  onDragEnterCell,
  onDragLeaveCell,
}: CalendarCellProps) {
  // Collapsed view shows up to 3 entries + overflow indicator. Expanded view
  // shows every entry inside a scroll container.
  const visible = isExpanded ? entries : entries.slice(0, 3);
  const extra = isExpanded ? 0 : entries.length - visible.length;
  const dayLabel = formatDay(day);

  // Native HTML5 drop handlers — onDragOver must preventDefault to make the
  // cell a valid drop target, otherwise onDrop never fires.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    e.preventDefault();
    try {
      const payload = JSON.parse(raw) as DragPayload;
      onDropEntry(isoKey, payload);
    } catch {
      // bad payload, ignore
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={() => onDragEnterCell(isoKey)}
      onDragLeave={(e) => {
        // Only fire leave when we actually leave the cell (not when crossing
        // into a child element). currentTarget contains the cell; relatedTarget
        // is where the cursor is going.
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        onDragLeaveCell(isoKey);
      }}
      onDrop={handleDrop}
      className={cn(
        "group relative flex flex-col rounded-md border p-1.5 text-xs transition-[min-height,box-shadow,border-color,background-color] duration-200 ease-out",
        muted ? "bg-muted/30 text-muted-foreground/60" : "bg-card",
        isAnchor && !muted && "border-warning/60 bg-warning/10",
        // Ring only: the cell's own border already draws the edge.
        isDragOver && "bg-primary/5 ring-1 ring-primary/50",
        isExpanded ? "min-h-80" : "min-h-35"
      )}
      data-date={isoKey}
    >
      <div className="mb-1 flex items-center justify-between">
        {/* Today's date number lives inside a filled pill (Google / Apple
            calendar pattern) so it pops out from a quick scan. Other days
            stay as flat numerals. Colour is not the only signal: the markers
            are spelled out for screen readers. */}
        <span
          aria-current={isCurrent ? "date" : undefined}
          className={
            isCurrent
              ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-mono text-2xs font-semibold text-primary-foreground"
              : "px-1 py-0.5 font-mono text-2xs"
          }
        >
          {day.getDate()}
          {isCurrent && <span className="sr-only"> (today)</span>}
          {isAnchor && <span className="sr-only"> (confirmation day)</span>}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Add entry on ${dayLabel}`}
              className="opacity-60 focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => onAdd("income", isoKey)}>
              <span aria-hidden="true" className="inline-block size-2 rounded-full bg-success" />
              Add income
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAdd("expense", isoKey)}>
              <span aria-hidden="true" className="inline-block size-2 rounded-full bg-warning" />
              Add expense
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ul
        className={cn(
          "flex flex-col gap-1",
          isExpanded && "max-h-65 overflow-y-auto pr-0.5"
        )}
      >
        {visible.map((entry) => (
          <EntryChip
            key={`${entry.side}-${entry.id}`}
            entry={entry}
            dayKey={isoKey}
            onEdit={onEditEntry}
            onSkipMonth={onSkipMonth}
            onResetMonth={onResetMonth}
          />
        ))}
        {extra > 0 && (
          <li>
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-expanded={false}
                  aria-label={`Show ${extra} more on ${dayLabel}`}
                  onClick={() => onToggleExpand(isoKey)}
                  className="w-full cursor-pointer rounded px-1 text-left text-2xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=delayed-open]:bg-muted data-[state=instant-open]:bg-muted data-[state=delayed-open]:text-foreground data-[state=instant-open]:text-foreground"
                >
                  +{extra} more
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={10} className="max-w-xs">
                <HiddenEntriesTooltipBody allEntries={entries} />
              </TooltipContent>
            </Tooltip>
          </li>
        )}
        {isExpanded && (
          <li>
            <button
              type="button"
              aria-expanded
              aria-label={`Show fewer on ${dayLabel}`}
              onClick={() => onToggleExpand(isoKey)}
              className="w-full cursor-pointer rounded px-1 text-left text-2xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show less
            </button>
          </li>
        )}
      </ul>
    </div>
  );
});

function EntryChip({
  entry,
  dayKey,
  onEdit,
  onSkipMonth,
  onResetMonth,
}: {
  entry: DayEntry;
  dayKey: string;
  onEdit: (entry: DayEntry) => void;
  onSkipMonth: (entry: DayEntry, key: string) => void;
  onResetMonth: (entry: DayEntry, key: string) => void;
}) {
  // Only the grip is draggable. The name/amount is the edit button — that's
  // the disambiguation: drag from the dots, click the entry to edit.
  const handleDragStart = (e: React.DragEvent<HTMLSpanElement>) => {
    const payload: DragPayload = {
      id: entry.id,
      side: entry.side,
      sourceDate: dayKey,
    };
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <li
      className={cn(
        "group/entry flex items-stretch gap-1 rounded text-2xs",
        chipPalette(entry.side)
      )}
    >
      {/* Pointer-only affordance: the keyboard path to moving an entry is
          "Edit full entry", so the grip stays out of the accessibility tree. */}
      <span
        draggable
        onDragStart={handleDragStart}
        aria-hidden="true"
        className="flex shrink-0 cursor-grab items-center pl-1 pr-0.5 opacity-50 transition-opacity hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-3" />
      </span>
      <button
        type="button"
        onClick={() => onEdit(entry)}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0 rounded py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <span className="truncate text-2xs font-medium leading-tight">
          {entry.name}
        </span>
        <span className="font-mono text-2xs tabular-nums leading-tight opacity-90">
          {formatCurrency(entry.amount)}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`More actions for ${entry.name}`}
            className="self-center text-current opacity-60 hover:bg-transparent hover:text-current hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover/entry:opacity-60"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(entry)}>
            Edit full entry
          </DropdownMenuItem>
          {entry.kind === "recurring" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onSkipMonth(entry, dayKey)}>
                Skip this month
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onResetMonth(entry, dayKey)}>
                Clear this month&apos;s override
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function chipPalette(side: EntrySide): string {
  return side === "income"
    ? "bg-success/10 text-success"
    : side === "expense"
      ? "bg-warning/10 text-warning"
      : "bg-destructive/10 text-destructive";
}

// Listing of entries hidden behind "+N more" plus a per-side / net total for
// the whole day. Showing the day's net gives the user a one-glance answer to
// "is this day positive or negative?" without expanding the cell.
function HiddenEntriesTooltipBody({ allEntries }: { allEntries: DayEntry[] }) {
  const hidden = allEntries.slice(3);
  const totals = sumBySide(allEntries);
  const net = totals.income - totals.expense - totals.debt;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-2xs opacity-80">
        {hidden.length} more {hidden.length === 1 ? "entry" : "entries"} on this day
      </div>
      <ul className="flex flex-col gap-0.5 text-2xs">
        {hidden.map((e) => (
          <li
            key={`${e.side}-${e.id}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex min-w-0 items-center gap-1">
              <span
                className={cn(
                  "inline-block size-1.5 shrink-0 rounded-full",
                  e.side === "income"
                    ? "bg-success"
                    : e.side === "expense"
                      ? "bg-warning"
                      : "bg-destructive"
                )}
                aria-hidden
              />
              <span className="truncate">{e.name}</span>
            </span>
            <Mono className="opacity-90">
              {formatCurrency(e.amount)}
            </Mono>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-0.5 border-t border-background/20 pt-1.5 text-2xs">
        <div className="text-2xs uppercase tracking-wide opacity-60">
          Day total
        </div>
        {totals.income > 0 && (
          <TotalRow label="Income" amount={totals.income} sign="+" color="text-success" />
        )}
        {totals.expense > 0 && (
          <TotalRow label="Expense" amount={totals.expense} sign="−" color="text-warning" />
        )}
        {totals.debt > 0 && (
          <TotalRow label="Debt" amount={totals.debt} sign="−" color="text-destructive" />
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-background/20 pt-1 font-semibold">
          <span>Net</span>
          <Mono className={net >= 0 ? "text-success" : "text-destructive"}>
            {net >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(net))}
          </Mono>
        </div>
      </div>

      <div className="text-2xs italic opacity-60">Click to expand</div>
    </div>
  );
}

function TotalRow({
  label,
  amount,
  sign,
  color,
}: {
  label: string;
  amount: number;
  sign: "+" | "−";
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="opacity-80">{label}</span>
      <Mono className={color}>
        {sign}
        {formatCurrency(amount)}
      </Mono>
    </div>
  );
}

function sumBySide(entries: DayEntry[]): {
  income: number;
  expense: number;
  debt: number;
} {
  let income = 0;
  let expense = 0;
  let debt = 0;
  for (const e of entries) {
    if (e.side === "income") income += e.amount;
    else if (e.side === "expense") expense += e.amount;
    else debt += e.amount;
  }
  return { income, expense, debt };
}

