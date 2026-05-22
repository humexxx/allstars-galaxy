"use client";

import { useMemo, useState } from "react";
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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatCurrency } from "@/lib/utils/format";
import type {
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanWithLines,
} from "@/types/finance";

import {
  LineFormDialog,
  toISODate,
  type LineFormValues,
} from "./line-form-dialog";

type PlanCalendarProps = {
  plan: FinancePlanWithLines;
  onAddIncome: (input: LineFormValues) => Promise<void>;
  onAddExpense: (input: LineFormValues) => Promise<void>;
};

type DayEntry = {
  id: string;
  side: "income" | "expense";
  name: string;
  amount: number;
  kind: "recurring" | "one_time";
};

function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

// Build the list of income/expense entries that hit each visible day. We walk
// the grid once and bucket entries by their local YYYY-MM-DD key.
function buildDayMap(
  days: Date[],
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[]
): Map<string, DayEntry[]> {
  const map = new Map<string, DayEntry[]>();
  const push = (key: string, entry: DayEntry) => {
    const arr = map.get(key);
    if (arr) arr.push(entry);
    else map.set(key, [entry]);
  };

  // Pre-compute month/year keys for each visible day so we don't re-derive
  // them inside the per-line loops.
  const dayMeta = days.map((d) => ({
    date: d,
    key: toISODate(d),
    year: d.getFullYear(),
    month: d.getMonth(), // 0..11
    day: d.getDate(),
  }));

  const handleRecurring = (
    side: "income" | "expense",
    id: string,
    name: string,
    amount: number,
    dayOfMonth: number,
    startKey: { y: number; m: number } | null,
    endKey: { y: number; m: number } | null
  ) => {
    for (const meta of dayMeta) {
      if (meta.day !== clampDayInMonth(dayOfMonth, meta.year, meta.month)) continue;
      const mk = meta.year * 12 + meta.month;
      if (startKey !== null && mk < startKey.y * 12 + startKey.m) continue;
      if (endKey !== null && mk > endKey.y * 12 + endKey.m) continue;
      push(meta.key, {
        id,
        side,
        name,
        amount,
        kind: "recurring",
      });
    }
  };

  const handleOneTime = (
    side: "income" | "expense",
    id: string,
    name: string,
    amount: number,
    isoDate: string
  ) => {
    const parsed = parseISODate(isoDate);
    if (!parsed) return;
    const key = toISODate(parsed);
    // Only push if it falls inside the visible window.
    if (!dayMeta.some((m) => m.key === key)) return;
    push(key, { id, side, name, amount, kind: "one_time" });
  };

  for (const inc of incomes) {
    const amount = Number(inc.monthlyAmount);
    if (inc.kind === "one_time") {
      if (inc.date) handleOneTime("income", inc.id, inc.name, amount, inc.date);
    } else {
      const dom = inc.dayOfMonth ?? 1;
      const start = inc.startDate ? parseISODate(inc.startDate) : null;
      const end = inc.endDate ? parseISODate(inc.endDate) : null;
      handleRecurring(
        "income",
        inc.id,
        inc.name,
        amount,
        dom,
        start ? { y: start.getFullYear(), m: start.getMonth() } : null,
        end ? { y: end.getFullYear(), m: end.getMonth() } : null
      );
    }
  }

  for (const exp of expenses) {
    const amount = Number(exp.monthlyAmount);
    if (exp.kind === "one_time") {
      if (exp.date) handleOneTime("expense", exp.id, exp.name, amount, exp.date);
    } else {
      const dom = exp.dayOfMonth ?? 1;
      handleRecurring("expense", exp.id, exp.name, amount, dom, null, null);
    }
  }

  return map;
}

// Some months don't have day 31 (or 30, or 29). Clamp the recurring day to the
// last day of the target month so e.g. dayOfMonth=31 still pays in February.
function clampDayInMonth(day: number, year: number, monthZeroIdx: number): number {
  const lastDay = new Date(year, monthZeroIdx + 1, 0).getDate();
  return Math.min(day, lastDay);
}

export function PlanCalendar({
  plan,
  onAddIncome,
  onAddExpense,
}: PlanCalendarProps) {
  // Anchor on the plan's startMonth so the first thing the user sees is the
  // beginning of their projection horizon.
  const initialMonth = useMemo(() => {
    const d = new Date(plan.startMonth);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [plan.startMonth]);

  const [cursor, setCursor] = useState<Date>(initialMonth);
  const [dialog, setDialog] = useState<
    | { open: false }
    | { open: true; side: "income" | "expense"; date: string }
  >({ open: false });

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  // Snap to the grid (whole weeks) so the calendar always shows complete rows.
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const dayMap = useMemo(
    () => buildDayMap(days, plan.incomes, plan.expenses),
    [days, plan.incomes, plan.expenses]
  );

  const monthLabel = format(cursor, "MMMM yyyy");

  const handleSubmit = async (values: LineFormValues) => {
    if (!dialog.open) return;
    try {
      if (dialog.side === "income") await onAddIncome(values);
      else await onAddExpense(values);
    } catch {
      toast.error("Failed to save");
    }
  };

  return (
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
                onAdd={(side) =>
                  setDialog({ open: true, side, date: key })
                }
              />
            );
          })}
        </div>
      </CardContent>

      <LineFormDialog
        open={dialog.open}
        onOpenChange={(o) => (o ? null : setDialog({ open: false }))}
        variant={dialog.open ? dialog.side : "income"}
        defaultDate={dialog.open ? dialog.date : undefined}
        // We pre-select one_time when opened from a calendar cell — the user
        // clicked on a specific day, that's the natural intent.
        initial={dialog.open ? { kind: "one_time", date: dialog.date } : undefined}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}

function CalendarCell({
  day,
  isoKey,
  entries,
  muted,
  isCurrent,
  onAdd,
}: {
  day: Date;
  isoKey: string;
  entries: DayEntry[];
  muted: boolean;
  isCurrent: boolean;
  onAdd: (side: "income" | "expense") => void;
}) {
  const visible = entries.slice(0, 3);
  const extra = entries.length - visible.length;

  return (
    <div
      className={`group relative flex min-h-[92px] flex-col rounded-md border p-1.5 text-xs ${
        muted ? "bg-muted/30 text-muted-foreground/60" : "bg-card"
      } ${isCurrent ? "ring-1 ring-primary" : ""}`}
      data-date={isoKey}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`font-mono text-[11px] ${
            isCurrent ? "font-semibold text-primary" : ""
          }`}
        >
          {day.getDate()}
        </span>
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

      <ul className="space-y-0.5">
        {visible.map((entry, i) => (
          <li
            key={`${entry.side}-${entry.id}-${i}`}
            className={`truncate rounded px-1 py-0.5 text-[10px] ${
              entry.side === "income"
                ? "bg-green-500/10 text-green-700 dark:text-green-300"
                : "bg-red-500/10 text-red-700 dark:text-red-300"
            }`}
            title={`${entry.name} · ${formatCurrency(entry.amount)}`}
          >
            <span className="font-medium">{entry.name}</span>
            <span className="ml-1 font-mono tabular-nums">
              {formatCurrency(entry.amount)}
            </span>
          </li>
        ))}
        {extra > 0 && (
          <li className="text-[10px] text-muted-foreground">+{extra} more</li>
        )}
      </ul>
    </div>
  );
}
