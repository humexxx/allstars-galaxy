"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import {
  WEEKDAYS,
  addDays,
  dayStatus,
  weekOf,
  weekdayOf,
  type Habit,
  type HabitDayStatus,
} from "@/lib/productivity/habit";
import { formatMonthLong, formatShortDay } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<HabitDayStatus, string> = {
  done: "done",
  missed: "missed",
  due: "due today",
  upcoming: "coming up",
  rest: "day off",
  outside: "not tracked",
};

const CELL_TONE: Record<HabitDayStatus, string> = {
  done: "bg-success font-medium text-success-foreground",
  // Ringed as well as tinted: a 10% red wash alone vanished on the dark theme.
  missed: "bg-destructive/15 text-destructive ring-1 ring-destructive/50 ring-inset",
  due: "font-medium text-foreground ring-2 ring-primary ring-inset",
  upcoming: "border border-dashed border-primary/40 text-foreground",
  rest: "text-muted-foreground",
  outside: "text-muted-foreground/40",
};

/** The month grid's days, Sunday first, with blanks before the 1st and after the last. */
function monthCells(month: string): (string | null)[] {
  const first = `${month}-01`;
  const cells: (string | null)[] = Array.from({ length: weekdayOf(first) }, () => null);
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type HabitCalendarProps = {
  habit: Habit;
  /** Days checked in, `YYYY-MM-DD`. */
  checkIns: readonly string[];
  today: string;
};

/**
 * A month of the habit, one square a day: done, missed, due, or a day off.
 * It opens on the current month and pages back to the month the path began.
 * The grid stops at a phone's width — square cells across a desktop card
 * were 120px tall — and the month's tally sits beside it where there is room.
 */
export function HabitCalendar({ habit, checkIns, today }: HabitCalendarProps) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const done = useMemo(() => new Set(checkIns), [checkIns]);
  const cells = monthCells(month);
  const statuses = cells.map((day) => (day ? dayStatus(habit, day, done, today) : null));
  const doneCount = statuses.filter((s) => s === "done").length;
  const missedCount = statuses.filter((s) => s === "missed").length;

  const first = `${month}-01`;
  const previous = addDays(first, -1).slice(0, 7);
  const next = addDays(first, 31).slice(0, 7);
  const canGoBack = previous >= habit.startDay.slice(0, 7);

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @xl:flex-row @xl:items-start @xl:gap-10">
        <div className="flex w-full max-w-sm flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Text weight="medium" as="p" aria-live="polite">
              {formatMonthLong(first)}
            </Text>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setMonth(previous)}
                disabled={!canGoBack}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setMonth(next)}
                aria-label="Next month"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday.value} className="text-center text-2xs font-medium text-muted-foreground">
                {weekday.letter}
              </span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              const status = statuses[index];
              if (!day || !status) return <li key={`blank-${index}`} aria-hidden="true" />;
              return (
                <li
                  key={day}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-xs",
                    CELL_TONE[status],
                    day === today && status !== "due" && "ring-2 ring-foreground/30 ring-inset"
                  )}
                >
                  <span aria-hidden="true">
                    <Mono>{Number(day.slice(8))}</Mono>
                  </span>
                  <span className="sr-only">
                    {formatShortDay(day)}: {STATUS_LABEL[status]}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              <Eyebrow as="div">Done</Eyebrow>
              <Mono className="text-xl font-semibold text-success sm:text-2xl">{doneCount}</Mono>
            </div>
            <div className="flex flex-col gap-1">
              <Eyebrow as="div">Missed</Eyebrow>
              <Mono
                className={cn(
                  "text-xl font-semibold sm:text-2xl",
                  missedCount > 0 && "text-destructive"
                )}
              >
                {missedCount}
              </Mono>
            </div>
          </div>
          <HabitLegend />
        </div>
      </div>
    </div>
  );
}

function HabitLegend() {
  const items: { status: HabitDayStatus; label: string }[] = [
    { status: "done", label: "Done" },
    { status: "missed", label: "Missed" },
    { status: "due", label: "Due" },
    { status: "upcoming", label: "Coming up" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <li key={item.status} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-3 rounded-sm", CELL_TONE[item.status])} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

type HabitWeekProps = {
  habit: Habit;
  checkIns: readonly string[];
  today: string;
};

/** This week, Sunday to Saturday, as a row of seven marks. */
export function HabitWeek({ habit, checkIns, today }: HabitWeekProps) {
  const done = new Set(checkIns);
  return (
    <ol className="flex items-center gap-1" aria-label="This week">
      {weekOf(today).map((day) => {
        const status = dayStatus(habit, day, done, today);
        return (
          <li key={day} className="flex flex-col items-center gap-1">
            <span className="text-2xs text-muted-foreground" aria-hidden="true">
              {WEEKDAYS[weekdayOf(day)].letter}
            </span>
            <span
              className={cn(
                "size-5 rounded-full",
                CELL_TONE[status],
                status === "rest" && "bg-muted",
                status === "outside" && "bg-muted/50",
                day === today && status !== "due" && "ring-2 ring-foreground/30 ring-inset"
              )}
            />
            <span className="sr-only">
              {formatShortDay(day)}: {STATUS_LABEL[status]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
