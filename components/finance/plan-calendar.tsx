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
  eachDayOfInterval,
  endOfWeek,
  isToday,
  startOfWeek,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatDay, formatDayRange, formatMonthLong } from "@/lib/utils/date";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatSignedCurrency,
  moneySign,
} from "@/lib/utils/format";
import {
  periodRangeFor,
  type Period,
} from "@/lib/finance/period";
import {
  isoDay,
  monthYearOfKey,
  planOccurrences,
  RESCHEDULE_MARGIN_MONTHS,
  rescheduleWithinReach,
} from "@/lib/finance/schedule";
import {
  debtChipAmount,
  projectedDebtPayments,
  type ProjectedDebtPayments,
} from "@/lib/finance/debt-payments";
import type {
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
  FinancePlanWithLines,
  Projection,
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
  /** The plan page's headline (net worth + the view switcher), drawn above the
   *  calendar's own controls so every view opens the same way. */
  header?: React.ReactNode;
  /** The projections behind the page (calibrated first, then the plan as
   *  written for earlier dates): debt chips show the payment they made. */
  projections?: readonly Projection[];
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

/**
 * One chip. `cadenceMonth` ("YYYY-MM-01") is the month the cadence put the
 * occurrence in — the key its overrides live under. A chip moved into another
 * month still belongs to its cadence month, so skipping, clearing or moving
 * it again must write THAT month's override, not the one it is shown in.
 */
export type DayEntry = { cadenceMonth: string } & (
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
    }
);

function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

/** A UTC-midnight instant as the same calendar day at LOCAL midnight. */
function utcToLocalDay(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** A local calendar day as UTC midnight (the schedule's date encoding). */
function toUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// Build the list of income/expense/debt entries that land on each visible
// day, from the SAME occurrence resolver the projection uses (overrides,
// moves across months and periods, every-N-month cycles, weekday rules) —
// so a chip sits on the day, and at the amount, the projection counts it.
export function buildDayMap(
  days: Date[],
  source: Pick<
    FinancePlanWithLines,
    "incomes" | "expenses" | "debts" | "overrides" | "startMonth"
  >,
  debtPayments: ProjectedDebtPayments
): Map<string, DayEntry[]> {
  const map = new Map<string, DayEntry[]>();
  if (days.length === 0) return map;
  const push = (key: string, entry: DayEntry) => {
    const arr = map.get(key);
    if (arr) arr.push(entry);
    else map.set(key, [entry]);
  };
  const occurrences = planOccurrences(
    {
      startMonth: new Date(source.startMonth),
      incomes: source.incomes,
      expenses: source.expenses,
      debts: source.debts,
      overrides: source.overrides,
    },
    toUtcDay(days[0]),
    toUtcDay(days[days.length - 1])
  );
  const incomes = new Map(source.incomes.map((i) => [i.id, i]));
  const expenses = new Map(source.expenses.map((e) => [e.id, e]));
  const debts = new Map(source.debts.map((d) => [d.id, d]));
  for (const o of occurrences) {
    const key = isoDay(o.date);
    const cadenceMonth = monthYearOfKey(o.monthKey);
    if (o.side === "income") {
      const inc = incomes.get(o.lineId);
      if (!inc) continue;
      push(key, {
        cadenceMonth,
        id: inc.id,
        side: "income",
        name: inc.name,
        amount: o.amount ?? 0,
        kind: o.kind,
        source: inc,
      });
    } else if (o.side === "expense") {
      const exp = expenses.get(o.lineId);
      if (!exp) continue;
      push(key, {
        cadenceMonth,
        id: exp.id,
        side: "expense",
        name: exp.name,
        amount: o.amount ?? 0,
        kind: o.kind,
        source: exp,
      });
    } else {
      const debt = debts.get(o.lineId);
      if (!debt) continue;
      const amount = o.amount ?? debtChipAmount(debt, o.date, debtPayments);
      if (amount === null) continue;
      push(key, {
        cadenceMonth,
        id: debt.id,
        side: "debt",
        name: debt.name,
        amount,
        kind: "recurring",
        source: debt,
      });
    }
  }
  return map;
}

type DialogState =
  | { kind: "none" }
  | { kind: "add"; side: "income" | "expense"; date: string }
  | { kind: "edit-income"; income: FinancePlanIncome }
  | { kind: "edit-expense"; expense: FinancePlanExpense }
  | { kind: "edit-debt"; debt: FinancePlanDebt };

// Tiny payload we put on the native dataTransfer when dragging an entry's
// grip handle. sourceDate is the ISO key of the cell the chip was dragged
// FROM; cadenceMonth is the month its override is keyed under (see
// DayEntry) — a "Just this month" move writes that month's override, and may
// land on any day within reach of it (`rescheduleWithinReach`).
const DND_MIME = "application/x-allstars-finance-entry";
/** One shared empty list, so an empty day's memoised cell sees the same prop. */
const NO_ENTRIES: DayEntry[] = [];
type DragPayload = {
  id: string;
  side: EntrySide;
  sourceDate: string;
  /** Absent only on a drag started from a page loaded before it existed. */
  cadenceMonth?: string;
};

/** The cadence month a drag belongs to ("YYYY-MM-01"). */
function cadenceMonthOf(payload: DragPayload): string {
  return payload.cadenceMonth ?? `${payload.sourceDate.slice(0, 7)}-01`;
}

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
  header,
  projections = [],
  onAddIncome,
  onAddExpense,
  onUpdateIncome,
  onUpdateExpense,
  onUpdateDebt,
  onUpsertOverride,
  onDeleteOverride,
}: PlanCalendarProps) {
  // Open on the current period — the most actionable view ("what's happening
  // this month?").
  // The cursor is a DAY inside the period to show. It used to be the 1st of the
  // month, which with an anchor day > 1 always belongs to the PREVIOUS period —
  // the calendar opened one period back and "Today" led there too.
  const todayMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [cursor, setCursor] = useState<Date>(todayMonth);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Period anchor day. 0 (feature disabled) collapses to day=1 — calendar
  // months.
  const anchorDay =
    plan.confirmationDayOfMonth > 0 ? plan.confirmationDayOfMonth : 1;

  // The confirmation-day-anchored period on screen (day N → day N-1 of next
  // month).
  // `periodRangeFor` works in UTC; everything below (the week grid and
  // the muted test) works in LOCAL days. Convert once here, or a
  // negative-offset zone shifts the whole period a day early and the period's
  // last day renders greyed out.
  const currentRange = useMemo<Period>(() => {
    const r = periodRangeFor(
      new Date(
        Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
      ),
      anchorDay
    );
    return { start: utcToLocalDay(r.start), end: utcToLocalDay(r.end) };
  }, [cursor, anchorDay]);

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

  // dayMap reads from the OPTIMISTIC snapshot so the calendar
  // surface updates instantly on user actions, before the server roundtrip.
  // Handler closures below still read `plan.*` (canonical) when looking up
  // the parent record being acted on.
  // Debt chips read the payments the projection made (see
  // `projectedDebtPayments`), so the calendar shows the capped final payment,
  // the percent-of-balance minimum, and nothing once a debt is paid off.
  const debtPayments = useMemo(() => projectedDebtPayments(projections), [projections]);

  const dayMap = useMemo(
    () => buildDayMap(days, optimisticPlan, debtPayments),
    [days, optimisticPlan, debtPayments]
  );

  const monthLabel = formatDayRange(currentRange.start, currentRange.end);

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
              owedToMe: income.owedToMe,
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

  // Skip this month — writes a skip override for the chip's CADENCE month
  // (the one it belongs to, even when it was moved into another). Used by
  // the per-chip "⋯" menu so users can pause a recurring entry without
  // touching the schedule.
  const handleSkipMonth = useCallback(
    (
      side: "income" | "expense" | "debt",
      parentId: string,
      monthYear: string
    ) => {
      const d = parseISODate(monthYear);
      if (!d) return;
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

  // Remove the override of the chip's cadence month — used to "undo" a
  // skip / amount / reschedule and restore the natural cadence (a chip moved
  // into another month goes back to its own).
  const handleResetMonth = useCallback(
    (
      side: "income" | "expense" | "debt",
      parentId: string,
      monthYear: string
    ) => {
      const d = parseISODate(monthYear);
      if (!d) return;
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

  // "Just this month" path — writes a reschedule override keyed by the
  // occurrence's cadence month, so the parent's recurring cadence stays
  // untouched. The target may be any day, in another month too: overrides are
  // keyed by the month the cadence put the occurrence in, never by where it
  // lands, so moving March's payment to April 2 leaves April's own payment
  // (its own key) alone. Only a move beyond the resolver's reach is refused.
  const applyJustThisMonth = useCallback(
    (targetKey: string, payload: DragPayload) => {
      const monthYear = cadenceMonthOf(payload);
      const month = parseISODate(monthYear);
      const target = parseISODate(targetKey);
      if (!month || !target) return;
      if (!rescheduleWithinReach(monthYear, targetKey)) {
        toast.error(
          `A single occurrence can move at most ${RESCHEDULE_MARGIN_MONTHS} months from its own month`
        );
        return;
      }
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
            `${formatMonthLong(month)}'s occurrence moved to ${formatDay(target)}`
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
    (entry: DayEntry) => handleSkipMonth(entry.side, entry.id, entry.cadenceMonth),
    [handleSkipMonth]
  );
  const resetMonthFor = useCallback(
    (entry: DayEntry) => handleResetMonth(entry.side, entry.id, entry.cadenceMonth),
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
    // A named container: the cells switch between a compact pill (narrow
    // calendar — a phone, a tablet beside the app sidebar) and the full chip
    // by the CALENDAR's width, not the viewport's. At 390px a cell is ~45px
    // wide and the full chip (grip, name, amount, menu) spilled into the
    // neighbouring days.
    <Card className="@container/cal xl:h-full">
      <CardHeader className="gap-3">
        {header}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous period"
              onClick={() => {
                const prevDay = new Date(currentRange.start);
                prevDay.setUTCDate(prevDay.getUTCDate() - 1);
                setCursor(prevDay);
              }}
            >
              <ChevronLeft />
            </Button>
            <Heading
              level="h6"
              as="h2"
              aria-live="polite"
              className="min-w-0 text-center sm:min-w-40"
            >
              {monthLabel}
            </Heading>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next period"
              onClick={() => {
                const nextDay = new Date(currentRange.end);
                nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                setCursor(nextDay);
              }}
            >
              <ChevronRight />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(todayMonth)}
          >
            Today
          </Button>
        </div>
      </CardHeader>

      {/* Narrow: the card's 24px gutters cost a seventh of a cell each. */}
      <CardContent className="flex flex-col gap-3 px-3 @2xl/cal:px-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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
            const muted = day < currentRange.start || day > currentRange.end;
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
                owedToMe: dialog.income.owedToMe,
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
          void applyJustThisMonth(drop.targetKey, drop.payload);
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
// changes, etc.). "Just this month" moves only the dragged occurrence — to any
// day, in another month too — and is disabled only beyond the resolver's
// reach (`rescheduleWithinReach`).
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
  const cadenceMonth = pending ? cadenceMonthOf(pending.payload) : null;
  const cadenceDate = cadenceMonth ? parseISODate(cadenceMonth) : null;
  const withinReach =
    !!pending && !!cadenceMonth && rescheduleWithinReach(cadenceMonth, pending.targetKey);

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
                {cadenceDate && (
                  <>
                    {" "}
                    <em>Just this month</em> moves only{" "}
                    {formatMonthLong(cadenceDate)}&apos;s occurrence.
                  </>
                )}
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
          {withinReach ? (
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
              <TooltipContent>
                A single occurrence can move at most {RESCHEDULE_MARGIN_MONTHS} months from its
                own month
              </TooltipContent>
            </Tooltip>
          )}
          <AlertDialogAction onClick={onMoveAll}>Move all</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  // Two chips before "+N more": with three, every week stood 140px tall and
  // the month ran far past the chart's height.
  const visible = isExpanded ? entries : entries.slice(0, 2);
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
        "group relative flex min-w-0 flex-col rounded-md border p-0.5 text-xs transition-[min-height,box-shadow,border-color,background-color] duration-200 ease-out @2xl/cal:p-1.5",
        muted ? "bg-muted/30 text-muted-foreground/60" : "bg-card",
        isAnchor && !muted && "border-warning/60 bg-warning/10",
        // Ring only: the cell's own border already draws the edge.
        isDragOver && "bg-primary/5 ring-1 ring-primary/50",
        isExpanded ? "min-h-80" : "min-h-12 @2xl/cal:min-h-20"
      )}
      data-date={isoKey}
    >
      <div className="mb-0.5 flex items-center justify-between">
        {/* Today's date number lives inside a filled pill (Google / Apple
            calendar pattern) so it pops out from a quick scan. Other days
            stay as flat numerals. Colour is not the only signal: the markers
            are spelled out for screen readers.
            Narrow calendar: there is no room for a separate "+" beside the
            number, so the number itself opens the add menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Add entry on ${dayLabel}${isCurrent ? " (today)" : ""}`}
              aria-current={isCurrent ? "date" : undefined}
              className={cn(
                "cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring @2xl/cal:hidden",
                dayNumberClass(isCurrent)
              )}
            >
              {day.getDate()}
            </button>
          </DropdownMenuTrigger>
          <AddEntryMenuContent isoKey={isoKey} onAdd={onAdd} />
        </DropdownMenu>
        <span
          aria-current={isCurrent ? "date" : undefined}
          // Visibility last: tailwind-merge keeps the later display class, and
          // today's pill carries its own inline-flex.
          className={cn(dayNumberClass(isCurrent), "hidden @2xl/cal:inline-flex")}
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
              className="hidden opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 @2xl/cal:inline-flex"
            >
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <AddEntryMenuContent isoKey={isoKey} onAdd={onAdd} />
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
                  +{extra}
                  <span className="hidden @lg/cal:inline"> more</span>
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

function dayNumberClass(isCurrent: boolean): string {
  return isCurrent
    ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-fill px-1 font-mono text-2xs font-semibold text-primary-foreground"
    : "px-1 py-0.5 font-mono text-2xs";
}

function AddEntryMenuContent({
  isoKey,
  onAdd,
}: {
  isoKey: string;
  onAdd: (side: "income" | "expense", key: string) => void;
}) {
  return (
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
  );
}

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
      cadenceMonth: entry.cadenceMonth,
    };
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const menuItems = (
    <>
      <DropdownMenuItem onSelect={() => onEdit(entry)}>Edit full entry</DropdownMenuItem>
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
    </>
  );

  return (
    <li className={cn("group/entry relative min-w-0 rounded text-2xs", chipPalette(entry.side))}>
      {/* Narrow calendar: a pill with the compact amount (and the name when
          it fits) that opens the entry's menu — editing, skipping and
          clearing all stay one tap away. No grip: there is no room for it,
          and touch screens don't drag with HTML5 drag-and-drop anyway. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${entry.name}, ${formatCurrency(entry.amount)}`}
            className="flex w-full min-w-0 cursor-pointer flex-col rounded px-0.5 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-current @lg/cal:px-1 @2xl/cal:hidden"
          >
            <span className="hidden truncate font-medium leading-tight @lg/cal:block">
              {entry.name}
            </span>
            <span className="truncate font-mono tabular-nums leading-tight">
              {formatCurrencyCompact(entry.amount)}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-64">
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate">{entry.name}</span>
            <Mono className="text-xs font-normal text-muted-foreground">
              {formatCurrency(entry.amount)}
            </Mono>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden items-stretch gap-1 @2xl/cal:flex">
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
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0 rounded py-1 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <span className="truncate text-2xs font-medium leading-tight">
            {entry.name}
          </span>
          <span className="font-mono text-2xs tabular-nums leading-tight opacity-90">
            {formatCurrency(entry.amount)}
          </span>
        </button>
        {/* Floats over the chip's right edge instead of reserving a column:
            the reserved 24px cut every name to a few letters ("Groceri…"). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`More actions for ${entry.name}`}
              className="absolute top-1/2 right-0.5 -translate-y-1/2 bg-card text-current opacity-0 shadow-xs hover:bg-card hover:text-current focus-visible:opacity-100 group-hover/entry:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
        </DropdownMenu>
      </div>
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
          <TotalRow label="Expense" amount={totals.expense} sign="-" color="text-warning" />
        )}
        {totals.debt > 0 && (
          <TotalRow label="Debt" amount={totals.debt} sign="-" color="text-destructive" />
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-background/20 pt-1 font-semibold">
          <span>Net</span>
          <Mono className={moneySign(net) >= 0 ? "text-success" : "text-destructive"}>
            {formatSignedCurrency(net)}
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
  // ASCII "-", the sign `formatCurrency` prints, so every figure in the
  // module carries the same glyph.
  sign: "+" | "-";
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

