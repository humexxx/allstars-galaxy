/**
 * A road path's habit: which days it is due, and how the days went.
 *
 * Every day here is a `YYYY-MM-DD` calendar day in the reader's zone, and the
 * arithmetic runs on those keys in UTC so no zone can shift one. Weekdays are
 * 0 = Sunday … 6 = Saturday, the order the app's calendars use.
 */

import { calendarDayInTimeZone } from "@/lib/utils/date";

export type HabitDayStatus =
  /** Checked in. */
  | "done"
  /** Due, gone, not done. */
  | "missed"
  /** Due today and not done yet: it can still be. */
  | "due"
  /** Due on a day still to come. */
  | "upcoming"
  /** Not a day the habit is due. */
  | "rest"
  /** Before the habit started, or after the path was completed. */
  | "outside";

export type Habit = {
  /** Weekdays it is due. Empty: no schedule. */
  scheduleDays: readonly number[];
  /** First day of the path. */
  startDay: string;
  /** Day the current schedule took effect; earlier days count check-ins only. */
  scheduleSince: string | null;
  /** Day the path was completed, after which nothing is due. */
  endDay: string | null;
};

export type HabitStats = {
  /** Due days done in a row, up to today. A due day still open today does not break it. */
  currentStreak: number;
  bestStreak: number;
  /** Due days so far that were done. */
  doneDue: number;
  /** Due days so far: every one gone, plus today once it is done. */
  due: number;
  /** `doneDue / due`, or null before anything was due. */
  completionRate: number | null;
  /** Every check-in, scheduled or not. */
  checkIns: number;
};

export const WEEKDAYS = [
  { value: 0, short: "Sun", letter: "S" },
  { value: 1, short: "Mon", letter: "M" },
  { value: 2, short: "Tue", letter: "T" },
  { value: 3, short: "Wed", letter: "W" },
  { value: 4, short: "Thu", letter: "T" },
  { value: 5, short: "Fri", letter: "F" },
  { value: 6, short: "Sat", letter: "S" },
] as const;

const DAY_MS = 86_400_000;

function toUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A real `YYYY-MM-DD` day: the right shape, and one the calendar has. */
export function isCalendarDay(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = toUtc(value);
  return !Number.isNaN(ms) && fromUtc(ms) === value;
}

export function addDays(day: string, days: number): string {
  return fromUtc(toUtc(day) + days * DAY_MS);
}

export function weekdayOf(day: string): number {
  return new Date(toUtc(day)).getUTCDay();
}

/** Sorted, unique, 0–6 only. */
export function normalizeSchedule(days: readonly number[] | null | undefined): number[] {
  if (!days) return [];
  return [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
}

export function hasSchedule(habit: Pick<Habit, "scheduleDays">): boolean {
  return habit.scheduleDays.length > 0;
}

/** First day the schedule judges: misses before it are not counted. */
function trackedFrom(habit: Habit): string {
  return habit.scheduleSince && habit.scheduleSince > habit.startDay ? habit.scheduleSince : habit.startDay;
}

function inPath(habit: Habit, day: string): boolean {
  return day >= habit.startDay && (habit.endDay === null || day <= habit.endDay);
}

/** Due on `day` under the schedule, inside the stretch the schedule judges. */
export function isDueOn(habit: Habit, day: string): boolean {
  return (
    inPath(habit, day) &&
    day >= trackedFrom(habit) &&
    habit.scheduleDays.includes(weekdayOf(day))
  );
}

export function dayStatus(
  habit: Habit,
  day: string,
  checkIns: ReadonlySet<string>,
  today: string
): HabitDayStatus {
  if (checkIns.has(day) && day <= today) return "done";
  if (!inPath(habit, day)) return "outside";
  if (!isDueOn(habit, day)) return "rest";
  if (day < today) return "missed";
  return day === today ? "due" : "upcoming";
}

/**
 * The days that count, oldest first: every due day up to today (today only
 * once done) and every check-in, due or not — a check-in on a day the schedule
 * has since dropped was due when it was made.
 */
function occurrences(habit: Habit, checkIns: ReadonlySet<string>, today: string): string[] {
  const days = new Set<string>();
  for (const day of checkIns) if (day <= today) days.add(day);
  if (hasSchedule(habit)) {
    const end = habit.endDay !== null && habit.endDay < today ? habit.endDay : today;
    for (let day = trackedFrom(habit); day <= end; day = addDays(day, 1)) {
      if (!isDueOn(habit, day)) continue;
      if (day === today && !checkIns.has(day)) continue;
      days.add(day);
    }
  }
  return [...days].sort();
}

export function habitStats(
  habit: Habit,
  checkInDays: Iterable<string>,
  today: string
): HabitStats {
  const checkIns = new Set(checkInDays);
  const days = occurrences(habit, checkIns, today);

  let bestStreak = 0;
  let run = 0;
  let doneDue = 0;
  let due = 0;
  for (const day of days) {
    const done = checkIns.has(day);
    run = done ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
    if (isDueOn(habit, day)) {
      due += 1;
      if (done) doneDue += 1;
    }
  }

  return {
    // The walk ends at today, so the last run is the current one.
    currentStreak: run,
    bestStreak,
    doneDue,
    due,
    completionRate: due > 0 ? doneDue / due : null,
    checkIns: [...checkIns].filter((day) => day <= today).length,
  };
}

/** The next day the habit is due, from `from` on (inclusive), within a fortnight. */
export function nextDueDay(habit: Habit, from: string): string | null {
  if (!hasSchedule(habit)) return null;
  for (let i = 0; i < 14; i += 1) {
    const day = addDays(from, i);
    if (isDueOn(habit, day)) return day;
  }
  return null;
}

/** Sunday to Saturday of the week `day` falls in. */
export function weekOf(day: string): string[] {
  const sunday = addDays(day, -weekdayOf(day));
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

/** "Every day", "Weekdays", "Mon, Wed, Fri". */
export function scheduleLabel(days: readonly number[]): string {
  const set = normalizeSchedule(days);
  if (set.length === 0) return "No schedule";
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  // Monday first in prose, the way a week is said out loud.
  const ordered = [...set.filter((d) => d !== 0), ...set.filter((d) => d === 0)];
  return ordered.map((d) => WEEKDAYS[d].short).join(", ");
}

/** "3× a week" — how often, beside the days themselves. */
export function frequencyLabel(days: readonly number[]): string | null {
  const count = normalizeSchedule(days).length;
  if (count === 0 || count === 7) return null;
  return count === 1 ? "Once a week" : `${count}× a week`;
}

type HabitSource = {
  scheduleDays: readonly number[] | null;
  scheduleSince: string | null;
  startDate: Date | string;
  completedAt: Date | string | null;
};

/** A road path read as a habit, its completion day in the reader's zone. */
export function habitOf(path: HabitSource, timeZone?: string | null): Habit {
  return {
    scheduleDays: normalizeSchedule(path.scheduleDays),
    // A road path's start is a calendar day stored as UTC midnight.
    startDay: new Date(path.startDate).toISOString().slice(0, 10),
    scheduleSince: path.scheduleSince,
    endDay: path.completedAt
      ? calendarDayInTimeZone(new Date(path.completedAt), timeZone).toISOString().slice(0, 10)
      : null,
  };
}

/** Streak lengths worth a word of their own. */
const STREAK_MILESTONES = [5, 10, 25, 50, 100, 200, 365];

/**
 * What the board says the moment a habit's task reaches Done: the streak it
 * makes, and whether that beats every run before this check-in — the thing
 * worth coming back for on the next due day.
 */
export function checkInMessage(title: string, streak: number, previousBest: number): string {
  if (streak <= 1) return `${title} done — a new streak starts today`;
  const milestone = STREAK_MILESTONES.includes(streak) ? ` That’s ${streak}!` : "";
  const record =
    streak > previousBest
      ? ", your best yet"
      : streak === previousBest
        ? ", matching your best"
        : ` (best: ${previousBest})`;
  return `${title} done — ${streak} in a row${record}.${milestone}`;
}
