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

// ---------- "today" in the user's time zone ----------
//
// The server renders in UTC, so `new Date()` there is the wrong calendar day
// for anyone whose midnight isn't Greenwich's: a reader in Madrid at 00:30 on
// Oct 1 was still shown September. The browser reports its IANA zone in a
// cookie (`TIME_ZONE_COOKIE`, written by `useTimeZoneCookie`) and the server
// resolves "today" in that zone. The result is a CALENDAR DAY encoded as UTC
// midnight — the same shape the finance period helpers expect.

/** Cookie the portal shell writes with the browser's IANA time zone. */
export const TIME_ZONE_COOKIE = "tz";

/** True for a zone `Intl` accepts, e.g. "Europe/Madrid". */
export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar day `instant` falls on in `timeZone`, as UTC midnight of that
 * day. An unknown or missing zone falls back to UTC.
 */
export function calendarDayInTimeZone(
  instant: Date,
  timeZone?: string | null
): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/** Today in `timeZone`, as UTC midnight of that calendar day. */
export function todayInTimeZone(
  timeZone?: string | null,
  now: Date = new Date()
): Date {
  return calendarDayInTimeZone(now, timeZone);
}

/**
 * The earliest calendar day anywhere on Earth at `instant` (the day in
 * UTC−12, `Etc/GMT+12` — the POSIX sign is inverted), as UTC midnight.
 *
 * For server code that decides a day boundary without knowing whose day it
 * is (the daily cron runs for every user and stores no time zone): a day
 * before this one has ended everywhere, so a period that ends before it is
 * closed for every user, whatever zone they live in.
 */
export function earliestCalendarDay(instant: Date = new Date()): Date {
  return calendarDayInTimeZone(instant, "Etc/GMT+12");
}
