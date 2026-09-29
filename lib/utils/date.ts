/**
 * Date formatting for the UI. One place so the same intent reads the same on
 * every screen ("Sep 3, 2026" everywhere a single day is shown).
 *
 * Always `en-US` — the app's copy is English, and letting the browser pick the
 * locale made day/month order change per visitor and differ between the server
 * render and the client.
 *
 * A date-only value (`YYYY-MM-DD`, what Postgres `date` columns return) is a
 * CALENDAR DAY, not an instant: `new Date("2026-03-08")` is UTC midnight, which
 * renders as Mar 7 anywhere west of Greenwich. `toDay` reads it as local.
 * Timestamps (Date objects, ISO strings with a time) keep their instant.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type DateInput = Date | string;

/** A date-only string as local midnight; anything else as the instant it is. */
export function toDay(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const SHORT_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const WEEKDAY_DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const WEEKDAY_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const MONTH_LONG = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const LONG_DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "Sep 3, 2026" */
export function formatDay(value: DateInput): string {
  return DAY.format(toDay(value));
}

/** "Sep 3" */
export function formatShortDay(value: DateInput): string {
  return SHORT_DAY.format(toDay(value));
}

/** "Thu, Sep 3" */
export function formatWeekdayDay(value: DateInput): string {
  return WEEKDAY_DAY.format(toDay(value));
}

/** "Thu, Sep 3, 2026" */
export function formatWeekdayDayYear(value: DateInput): string {
  return WEEKDAY_DAY_YEAR.format(toDay(value));
}

/** "Thursday, September 3, 2026" — article datelines. */
export function formatLongDay(value: DateInput): string {
  return LONG_DAY.format(toDay(value));
}

/** "Sep 2026" */
export function formatMonth(value: DateInput): string {
  return MONTH.format(toDay(value));
}

/** "September 2026" */
export function formatMonthLong(value: DateInput): string {
  return MONTH_LONG.format(toDay(value));
}

/** "Sep 3, 2026, 4:05 PM" */
export function formatDateTime(value: DateInput): string {
  return DATE_TIME.format(toDay(value));
}

/**
 * "Sep 3 – 10, 2026", "Sep 28 – Oct 2, 2026", "Dec 30, 2026 – Jan 2, 2027".
 * A missing end is a single day.
 */
export function formatDayRange(start: DateInput, end?: DateInput | null): string {
  const s = toDay(start);
  if (!end) return formatDay(s);
  const e = toDay(end);
  if (s.getFullYear() !== e.getFullYear()) return `${formatDay(s)} – ${formatDay(e)}`;
  if (s.getMonth() === e.getMonth()) {
    if (s.getDate() === e.getDate()) return formatDay(s);
    return `${SHORT_DAY.format(s)} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${SHORT_DAY.format(s)} – ${SHORT_DAY.format(e)}, ${e.getFullYear()}`;
}
