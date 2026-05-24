"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils/format";
import type {
  DebtPaymentType,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanWithLines,
} from "@/types/finance";

import { DebtFormDialog, type DebtFormValues } from "./debt-form-dialog";
import {
  LineFormDialog,
  toISODate,
  type LineFormValues,
} from "./line-form-dialog";

type EntrySide = "income" | "expense" | "debt";

type PlanCalendarProps = {
  plan: FinancePlanWithLines;
  onAddIncome: (input: LineFormValues) => Promise<void>;
  onAddExpense: (input: LineFormValues) => Promise<void>;
  onUpdateIncome: (id: string, input: LineFormValues) => Promise<void>;
  onUpdateExpense: (id: string, input: LineFormValues) => Promise<void>;
  onUpdateDebt: (id: string, input: DebtFormValues) => Promise<void>;
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
  if ((d.paymentType as DebtPaymentType) === "fixed") return payment;
  const floor = Number(d.minPaymentFloor);
  return payment > 0 ? payment : floor;
}

// Build the list of income/expense/debt entries that hit each visible day. We
// walk the grid once and bucket entries by their local YYYY-MM-DD key.
function buildDayMap(
  days: Date[],
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[]
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

  const pushRecurring = (
    entry: DayEntry,
    dayOfMonth: number,
    startKey: { y: number; m: number } | null,
    endKey: { y: number; m: number } | null
  ) => {
    for (const meta of dayMeta) {
      if (meta.day !== clampDayInMonth(dayOfMonth, meta.year, meta.month)) continue;
      const mk = meta.year * 12 + meta.month;
      if (startKey !== null && mk < startKey.y * 12 + startKey.m) continue;
      if (endKey !== null && mk > endKey.y * 12 + endKey.m) continue;
      push(meta.key, entry);
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
      const dom = inc.dayOfMonth ?? 1;
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
        dom,
        start ? { y: start.getFullYear(), m: start.getMonth() } : null,
        end ? { y: end.getFullYear(), m: end.getMonth() } : null
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
      const dom = exp.dayOfMonth ?? 1;
      pushRecurring(
        {
          id: exp.id,
          side: "expense",
          name: exp.name,
          amount,
          kind: "recurring",
          source: exp,
        },
        dom,
        null,
        null
      );
    }
  }

  for (const debt of debts) {
    const dom = debt.dayOfMonth ?? 1;
    pushRecurring(
      {
        id: debt.id,
        side: "debt",
        name: debt.name,
        amount: debtCalendarAmount(debt),
        kind: "recurring",
        source: debt,
      },
      dom,
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

// Identity carried by dnd-kit's `data` channel on each draggable. The same
// entry can appear on many days (recurring), so the draggable id alone is not
// unique — we route the side+entry id through this payload instead.
type DragPayload = { id: string; side: EntrySide };

export function PlanCalendar({
  plan,
  onAddIncome,
  onAddExpense,
  onUpdateIncome,
  onUpdateExpense,
  onUpdateDebt,
}: PlanCalendarProps) {
  const initialMonth = useMemo(() => {
    const d = new Date(plan.startMonth);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [plan.startMonth]);

  const [cursor, setCursor] = useState<Date>(initialMonth);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  // Entry currently being dragged — drives the DragOverlay ghost.
  const [activeEntry, setActiveEntry] = useState<DayEntry | null>(null);

  // PointerSensor with delay constraint: a quick mousedown→up fires onClick
  // (edit), but holding for 250 ms (without moving more than 5 px) activates
  // drag-to-move. This is the click-vs-hold disambiguation the UX requires.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const dayMap = useMemo(
    () => buildDayMap(days, plan.incomes, plan.expenses, plan.debts),
    [days, plan.incomes, plan.expenses, plan.debts]
  );

  const monthLabel = format(cursor, "MMMM yyyy");

  const handleAdd = async (values: LineFormValues) => {
    if (dialog.kind !== "add") return;
    try {
      if (dialog.side === "income") await onAddIncome(values);
      else await onAddExpense(values);
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleEditIncome = async (values: LineFormValues) => {
    if (dialog.kind !== "edit-income") return;
    try {
      await onUpdateIncome(dialog.income.id, values);
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleEditExpense = async (values: LineFormValues) => {
    if (dialog.kind !== "edit-expense") return;
    try {
      await onUpdateExpense(dialog.expense.id, values);
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleEditDebt = async (values: DebtFormValues) => {
    if (dialog.kind !== "edit-debt") return;
    try {
      await onUpdateDebt(dialog.debt.id, values);
    } catch {
      toast.error("Failed to save");
    }
  };

  const openEditFor = (entry: DayEntry) => {
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
  };

  // Translate a drop on a target day into the right update call. one_time entries
  // get their `date` rewritten; recurring entries change `dayOfMonth`, which
  // ripples to every month (we toast to make that consequence visible).
  const handleDrop = useCallback(
    async (targetKey: string, payload: DragPayload) => {
      const target = parseISODate(targetKey);
      if (!target) return;

      if (payload.side === "income") {
        const income = plan.incomes.find((i) => i.id === payload.id);
        if (!income) return;
        const isOneTime = income.kind === "one_time";
        if (isOneTime && income.date === targetKey) return;
        if (!isOneTime && (income.dayOfMonth ?? 1) === target.getDate()) return;
        try {
          await onUpdateIncome(income.id, {
            name: income.name,
            monthlyAmount: income.monthlyAmount,
            kind: income.kind,
            dayOfMonth: isOneTime ? null : target.getDate(),
            date: isOneTime ? targetKey : null,
            startDate: income.startDate,
            endDate: income.endDate,
          });
          toast.success(
            isOneTime
              ? `Income moved to ${format(target, "PPP")}`
              : `Income now hits day ${target.getDate()} of every month`
          );
        } catch {
          toast.error("Failed to move income");
        }
        return;
      }

      if (payload.side === "expense") {
        const expense = plan.expenses.find((e) => e.id === payload.id);
        if (!expense) return;
        const isOneTime = expense.kind === "one_time";
        if (isOneTime && expense.date === targetKey) return;
        if (!isOneTime && (expense.dayOfMonth ?? 1) === target.getDate()) return;
        try {
          await onUpdateExpense(expense.id, {
            name: expense.name,
            monthlyAmount: expense.monthlyAmount,
            kind: expense.kind,
            dayOfMonth: isOneTime ? null : target.getDate(),
            date: isOneTime ? targetKey : null,
          });
          toast.success(
            isOneTime
              ? `Expense moved to ${format(target, "PPP")}`
              : `Expense now hits day ${target.getDate()} of every month`
          );
        } catch {
          toast.error("Failed to move expense");
        }
        return;
      }

      // debt — always recurring
      const debt = plan.debts.find((d) => d.id === payload.id);
      if (!debt) return;
      if ((debt.dayOfMonth ?? 1) === target.getDate()) return;
      try {
        await onUpdateDebt(debt.id, {
          name: debt.name,
          initialBalance: debt.initialBalance,
          monthlyInterestRate: debt.monthlyInterestRate,
          monthlyPayment: debt.monthlyPayment,
          paymentType: debt.paymentType as DebtPaymentType,
          minPaymentPercent: debt.minPaymentPercent,
          minPaymentFloor: debt.minPaymentFloor,
          dayOfMonth: target.getDate(),
        });
        toast.success(
          `Debt payment now scheduled for day ${target.getDate()} of every month`
        );
      } catch {
        toast.error("Failed to move debt");
      }
    },
    [plan.incomes, plan.expenses, plan.debts, onUpdateIncome, onUpdateExpense, onUpdateDebt]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const entry = event.active.data.current?.entry as DayEntry | undefined;
    if (entry) setActiveEntry(entry);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveEntry(null);
    const over = event.over;
    if (!over) return;
    const payload = event.active.data.current?.payload as DragPayload | undefined;
    const targetKey = over.data.current?.dayKey as string | undefined;
    if (!payload || !targetKey) return;
    void handleDrop(targetKey, payload);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveEntry(null)}
    >
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => setCursor((c) => addMonths(c, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="min-w-[180px] text-center text-lg font-semibold">
              {monthLabel}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => setCursor((c) => addMonths(c, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(initialMonth)}
          >
            Plan start
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-green-500" />
            Income
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-red-500" />
            Expense
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-amber-500" />
            Debt
          </span>
          <span className="ml-auto text-[10px] italic text-muted-foreground/70">
            Click an entry to edit · hold to drag · click a day to expand
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = toISODate(day);
            const entries = dayMap.get(key) ?? [];
            const muted = !isSameMonth(day, cursor);
            return (
              <CalendarCell
                key={key}
                day={day}
                isoKey={key}
                entries={entries}
                muted={muted}
                isCurrent={isToday(day)}
                isExpanded={expandedDay === key}
                onToggleExpand={() =>
                  setExpandedDay((prev) => (prev === key ? null : key))
                }
                onAdd={(side) => setDialog({ kind: "add", side, date: key })}
                onEditEntry={openEditFor}
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
                dayOfMonth: dialog.income.dayOfMonth,
                date: dialog.income.date,
                startDate: dialog.income.startDate,
                endDate: dialog.income.endDate,
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
                paymentType: dialog.debt.paymentType as DebtPaymentType,
                minPaymentPercent: dialog.debt.minPaymentPercent,
                minPaymentFloor: dialog.debt.minPaymentFloor,
                dayOfMonth: dialog.debt.dayOfMonth,
              }
            : undefined
        }
        onSubmit={handleEditDebt}
      />
    </Card>
    <DragOverlay dropAnimation={null}>
      {activeEntry ? <ChipGhost entry={activeEntry} /> : null}
    </DragOverlay>
    </DndContext>
  );
}

type CalendarCellProps = {
  day: Date;
  isoKey: string;
  entries: DayEntry[];
  muted: boolean;
  isCurrent: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAdd: (side: "income" | "expense") => void;
  onEditEntry: (entry: DayEntry) => void;
};

function CalendarCell({
  day,
  isoKey,
  entries,
  muted,
  isCurrent,
  isExpanded,
  onToggleExpand,
  onAdd,
  onEditEntry,
}: CalendarCellProps) {
  // Collapsed view shows up to 3 entries + overflow indicator. Expanded view
  // shows every entry inside a scroll container.
  const visible = isExpanded ? entries : entries.slice(0, 3);
  const extra = isExpanded ? 0 : entries.length - visible.length;
  const hasEntries = entries.length > 0;

  // Register the cell as a dnd-kit drop target. `isOver` flips while a drag
  // hovers this cell, giving us the same visual feedback the old HTML5 path
  // had via the dragOverDay state in the parent.
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${isoKey}`,
    data: { dayKey: isoKey },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex flex-col rounded-md border p-1.5 text-xs transition-[min-height,box-shadow,border-color] duration-200 ease-out ${
        muted ? "bg-muted/30 text-muted-foreground/60" : "bg-card"
      } ${isCurrent ? "ring-1 ring-primary" : ""} ${
        isOver ? "border-primary/70 bg-primary/5 ring-1 ring-primary/50" : ""
      } ${isExpanded ? "min-h-[320px]" : "min-h-[140px]"}`}
      data-date={isoKey}
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? `Collapse ${format(day, "PPP")}`
              : `Expand ${format(day, "PPP")}`
          }
          className={`flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[11px] hover:bg-muted ${
            isCurrent ? "font-semibold text-primary" : ""
          }`}
        >
          {day.getDate()}
          {hasEntries && (
            <ChevronUp
              className={`h-3 w-3 transition-transform duration-200 ${
                isExpanded ? "" : "rotate-180"
              }`}
            />
          )}
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Add entry on ${format(day, "PPP")}`}
              className="rounded p-0.5 opacity-0 transition hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            <button
              type="button"
              onClick={() => onAdd("income")}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span className="inline-block size-2 rounded-full bg-green-500" />
              Add income
            </button>
            <button
              type="button"
              onClick={() => onAdd("expense")}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span className="inline-block size-2 rounded-full bg-red-500" />
              Add expense
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <ul
        className={`space-y-1 ${
          isExpanded ? "max-h-[260px] overflow-y-auto pr-0.5" : ""
        }`}
      >
        {visible.map((entry) => (
          <EntryChip
            key={`${entry.side}-${entry.id}`}
            entry={entry}
            isoKey={isoKey}
            onEdit={() => onEditEntry(entry)}
          />
        ))}
        {extra > 0 && (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <li
                role="button"
                tabIndex={0}
                onClick={onToggleExpand}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleExpand();
                  }
                }}
                className="cursor-pointer rounded px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground data-[state=delayed-open]:bg-muted data-[state=instant-open]:bg-muted data-[state=delayed-open]:text-foreground data-[state=instant-open]:text-foreground"
              >
                +{extra} more
              </li>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={10} className="max-w-xs">
              <HiddenEntriesTooltipBody entries={entries.slice(3)} />
            </TooltipContent>
          </Tooltip>
        )}
      </ul>
    </div>
  );
}

function EntryChip({
  entry,
  isoKey,
  onEdit,
}: {
  entry: DayEntry;
  isoKey: string;
  onEdit: () => void;
}) {
  // dnd-kit ids must be globally unique. The same recurring record renders on
  // multiple days, so the id has to include the cell key.
  const draggableId = `chip-${isoKey}-${entry.side}-${entry.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId,
    data: {
      entry,
      payload: { id: entry.id, side: entry.side } satisfies DragPayload,
    },
  });

  // While this chip is the drag source, hide it from its own cell so the
  // DragOverlay ghost is the only visual under the cursor. (Don't unmount —
  // we still need the dnd-kit node alive for the active state.)
  const dragHidden = isDragging
    ? "pointer-events-none opacity-30"
    : "";

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // The PointerSensor's delay constraint guarantees that a quick click
      // doesn't activate drag, so we can wire onClick to edit safely.
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      role="button"
      aria-label={`Edit ${entry.name}`}
      className={`flex cursor-pointer flex-col gap-0 rounded px-1.5 py-1 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-current ${chipPalette(entry.side)} ${dragHidden}`}
    >
      <span className="truncate text-[11px] font-medium leading-tight">
        {entry.name}
      </span>
      <span className="font-mono text-[10px] tabular-nums leading-tight opacity-90">
        {formatCurrency(entry.amount)}
      </span>
    </li>
  );
}

// The ghost rendered by DragOverlay — same look as the resting chip so the
// transition feels seamless when the user picks one up.
function ChipGhost({ entry }: { entry: DayEntry }) {
  return (
    <div
      className={`pointer-events-none flex w-40 cursor-grabbing flex-col gap-0 rounded px-1.5 py-1 shadow-lg ring-1 ring-current/30 ${chipPalette(entry.side)}`}
    >
      <span className="truncate text-[11px] font-medium leading-tight">
        {entry.name}
      </span>
      <span className="font-mono text-[10px] tabular-nums leading-tight opacity-90">
        {formatCurrency(entry.amount)}
      </span>
    </div>
  );
}

function chipPalette(side: EntrySide): string {
  return side === "income"
    ? "bg-green-500/10 text-green-700 dark:text-green-300"
    : side === "expense"
      ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

// Listing of entries hidden behind "+N more" — name + amount per line so the
// user can scan what's underneath without having to expand the cell.
function HiddenEntriesTooltipBody({ entries }: { entries: DayEntry[] }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] opacity-80">
        {entries.length} more {entries.length === 1 ? "entry" : "entries"} on this day
      </div>
      <ul className="space-y-0.5 text-[11px]">
        {entries.map((e) => (
          <li
            key={`${e.side}-${e.id}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex min-w-0 items-center gap-1">
              <span
                className={`inline-block size-1.5 shrink-0 rounded-full ${
                  e.side === "income"
                    ? "bg-green-500"
                    : e.side === "expense"
                      ? "bg-red-500"
                      : "bg-amber-500"
                }`}
                aria-hidden
              />
              <span className="truncate">{e.name}</span>
            </span>
            <span className="font-mono tabular-nums opacity-90">
              {formatCurrency(e.amount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="pt-0.5 text-[10px] italic opacity-60">Click to expand</div>
    </div>
  );
}

