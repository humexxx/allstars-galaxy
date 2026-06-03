/**
 * Period math anchored on a plan's `confirmationDayOfMonth`.
 *
 * A "period" runs from day N of month X (the anchor) through day N-1 of month
 * X+1. When N exceeds the destination month's length, it clamps to that
 * month's last day (so day=31 in February becomes Feb 28 or 29, and the next
 * period still starts on day=31 of the following month if it has one).
 */

export type Period = {
  /** Inclusive period start at UTC midnight. */
  start: Date;
  /** Inclusive period end at UTC midnight (the day before the next anchor). */
  end: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function lastDayOfMonth(year: number, monthZeroIdx: number): number {
  return new Date(Date.UTC(year, monthZeroIdx + 1, 0)).getUTCDate();
}

function clampedAnchorDay(year: number, monthZeroIdx: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, monthZeroIdx));
}

function anchorDate(year: number, monthZeroIdx: number, day: number): Date {
  const realDay = clampedAnchorDay(year, monthZeroIdx, day);
  return new Date(Date.UTC(year, monthZeroIdx, realDay));
}

/**
 * Start date of the period containing `date`, anchored on `day` (1..31).
 *
 * If `date`'s day-of-month is on or after the clamped anchor for its month,
 * the period started that month. Otherwise the period started the previous
 * month on its (clamped) anchor.
 */
export function periodStartFor(date: Date, day: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const thisMonthAnchor = clampedAnchorDay(y, m, day);
  if (d >= thisMonthAnchor) {
    return new Date(Date.UTC(y, m, thisMonthAnchor));
  }
  return anchorDate(y, m - 1, day);
}

/**
 * Start of the period immediately following `periodStart`. Re-clamps the
 * anchor for the next calendar month.
 */
export function nextPeriodStart(periodStart: Date, day: number): Date {
  return anchorDate(
    periodStart.getUTCFullYear(),
    periodStart.getUTCMonth() + 1,
    day
  );
}

/**
 * Period (start, end) containing `date`, anchored on `day`.
 */
export function periodRangeFor(date: Date, day: number): Period {
  const start = periodStartFor(date, day);
  const nextStart = nextPeriodStart(start, day);
  const end = new Date(nextStart.getTime() - MS_PER_DAY);
  return { start, end };
}

/**
 * Period at offset `index` from the period containing `from`. index=0 is the
 * current period; index=1 is the next; etc.
 */
export function periodAtIndex(from: Date, day: number, index: number): Period {
  let start = periodStartFor(from, day);
  for (let i = 0; i < index; i++) {
    start = nextPeriodStart(start, day);
  }
  const nextStart = nextPeriodStart(start, day);
  const end = new Date(nextStart.getTime() - MS_PER_DAY);
  return { start, end };
}

/**
 * `count` consecutive periods starting with the one containing `from`.
 */
export function iteratePeriods(from: Date, day: number, count: number): Period[] {
  const periods: Period[] = [];
  let start = periodStartFor(from, day);
  for (let i = 0; i < count; i++) {
    const nextStart = nextPeriodStart(start, day);
    const end = new Date(nextStart.getTime() - MS_PER_DAY);
    periods.push({ start, end });
    start = nextStart;
  }
  return periods;
}

/**
 * ISO YYYY-MM-DD of the period start that contains `date`. Used as the
 * confirmation bucket key in the DB.
 */
export function periodAnchorIso(date: Date, day: number): string {
  return periodStartFor(date, day).toISOString().slice(0, 10);
}

/**
 * Inclusive day count of the period (Jan 15 → Feb 14 = 31).
 */
export function periodLengthDays(period: Period): number {
  const ms = period.end.getTime() - period.start.getTime();
  return Math.round(ms / MS_PER_DAY) + 1;
}

/**
 * True when `date` falls within `period` (inclusive on both ends).
 */
export function isDateInPeriod(date: Date, period: Period): boolean {
  const t = date.getTime();
  return t >= period.start.getTime() && t <= period.end.getTime();
}
