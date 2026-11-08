import type { FinancePlanLineOverride, RecurrenceType } from "@/types/finance";

import { owedAfter, owedRepayments } from "./receivables";
import { parseIsoDay } from "./schedule";

/**
 * Folds a plan's income or expense lines into one group per name, so a salary
 * entered as three phases (a raise, then a new contract) reads as one source.
 *
 * Pure: "today" is a `YYYY-MM-DD` calendar day the caller resolved, or null
 * before it is known (a client render with no server-provided day).
 */

export type GroupableLine = {
  id: string;
  name: string;
  monthlyAmount: string;
  kind: "recurring" | "one_time";
  date: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type LineGroupStatus = "current" | "upcoming" | "past";

export type LineGroup<T extends GroupableLine> = {
  key: string;
  name: string;
  /** Oldest phase first. */
  lines: T[];
  /** The phase whose amount the group shows: today's, else the next, else the last. */
  headline: T;
  /** Null while today is unknown. */
  status: LineGroupStatus | null;
  /** Null when some phase has no start (or end): the range is open that side. */
  from: string | null;
  to: string | null;
};

type Span = { start: string | null; end: string | null };

function spanOf(line: GroupableLine): Span {
  if (line.kind === "one_time") return { start: line.date, end: line.date };
  return { start: line.startDate ?? null, end: line.endDate ?? null };
}

export function groupKey(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

function byStart(a: GroupableLine, b: GroupableLine): number {
  // An open start is the earliest of all.
  const sa = spanOf(a).start ?? "";
  const sb = spanOf(b).start ?? "";
  return sa.localeCompare(sb);
}

function pickHeadline<T extends GroupableLine>(
  lines: readonly T[],
  today: string | null
): { headline: T; status: LineGroupStatus | null } {
  if (today === null) return { headline: lines[0], status: null };

  let current: T | null = null;
  let upcoming: T | null = null;
  let past: T | null = null;
  for (const line of lines) {
    const { start, end } = spanOf(line);
    const started = start === null || start <= today;
    const ended = end !== null && end < today;
    if (started && !ended) {
      // Overlapping phases: the one that started last is the most specific.
      current = line;
    } else if (!started) {
      if (upcoming === null || byStart(line, upcoming) < 0) upcoming = line;
    } else if (past === null || (spanOf(past).end ?? "") <= (end ?? "")) {
      past = line;
    }
  }
  if (current) return { headline: current, status: "current" };
  if (upcoming) return { headline: upcoming, status: "upcoming" };
  return { headline: past ?? lines[lines.length - 1], status: "past" };
}

function rangeOf(lines: readonly GroupableLine[]): { from: string | null; to: string | null } {
  let from: string | null = null;
  let to: string | null = null;
  let openStart = false;
  let openEnd = false;
  for (const line of lines) {
    const { start, end } = spanOf(line);
    if (start === null) openStart = true;
    else if (from === null || start < from) from = start;
    if (end === null) openEnd = true;
    else if (to === null || end > to) to = end;
  }
  return { from: openStart ? null : from, to: openEnd ? null : to };
}

/**
 * One group per trimmed, case-insensitive name, in the order each name first
 * appears in `lines`.
 */
export function groupLinesByName<T extends GroupableLine>(
  lines: readonly T[],
  today: string | null
): LineGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const line of lines) {
    const key = groupKey(line.name);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(line);
    else byKey.set(key, [line]);
  }

  return Array.from(byKey, ([key, bucket]) => {
    const sorted = [...bucket].sort(byStart);
    return {
      key,
      name: bucket[0].name.trim(),
      lines: sorted,
      ...pickHeadline(sorted, today),
      ...rangeOf(sorted),
    };
  });
}

export type OwedLine = GroupableLine & {
  dayOfMonth: number | null;
  recurrenceType?: RecurrenceType;
  weekOfMonth?: number | null;
  dayOfWeek?: number | null;
  intervalMonths?: number | null;
  recurrenceStart?: string | null;
};

export type OwedSchedule = {
  startMonth: Date | string;
  overrides?: readonly FinancePlanLineOverride[] | null;
};

/**
 * What these owed-to-you lines will still pay once `today` is over: every
 * occurrence after it, overrides applied — the figure net worth carries.
 * Without the plan's schedule, an every-N-months line is anchored on today
 * and overrides are ignored.
 */
export function owedStillToCome(
  lines: readonly OwedLine[],
  today: string,
  schedule?: OwedSchedule
): number {
  const day = parseIsoDay(today);
  if (!day) return 0;
  const incomes = lines.map((line) => ({
    id: line.id,
    name: line.name,
    monthlyAmount: line.monthlyAmount,
    kind: line.kind,
    date: line.date,
    startDate: line.startDate ?? null,
    endDate: line.endDate ?? null,
    dayOfMonth: line.dayOfMonth,
    recurrenceType: line.recurrenceType ?? "monthly_day",
    weekOfMonth: line.weekOfMonth ?? null,
    dayOfWeek: line.dayOfWeek ?? null,
    intervalMonths: line.intervalMonths ?? null,
    recurrenceStart: line.recurrenceStart ?? null,
    owedToMe: true,
  }));
  const repayments = owedRepayments(
    {
      startMonth: schedule ? new Date(schedule.startMonth) : day,
      incomes,
      overrides: schedule?.overrides ?? [],
    },
    day
  );
  return owedAfter(repayments, day);
}
