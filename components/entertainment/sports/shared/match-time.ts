/**
 * Kickoff and dateline formatting for the sports surfaces, in ONE time zone.
 *
 * A kickoff is an instant. Formatted with the runtime's own zone, the server
 * (UTC) printed "8:00 PM" and the browser "2:00 PM" for the same match — and
 * which one a reader saw depended on whether that card was server-rendered
 * (the default tab) or mounted later by a tab switch, so the knockout tab and
 * the matches tab disagreed about the same fixture. The page reads the
 * reader's zone from the `tz` cookie and every formatter here is pinned to it,
 * so the server and the browser print the same text.
 *
 * A date-only string (`YYYY-MM-DD`) is a calendar day, not an instant, and is
 * printed as that day whatever the zone.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type MatchTimeFormat = {
  /** "Jul 5" */
  shortDay: (value: string | Date) => string;
  /** "Jul 5, 2026" */
  day: (value: string | Date) => string;
  /** "Wednesday, September 30, 2026" */
  longDay: (value: string | Date) => string;
  /** "2:00 PM" */
  time: (value: string | Date) => string;
  /** "Sun, Jul 5, 2:00 PM" */
  dayTime: (value: string | Date) => string;
};

const SHORT_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const LONG_DAY: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
};
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const DAY_TIME: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function validZone(timeZone: string | undefined): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

const cache = new Map<string, MatchTimeFormat>();

/**
 * Formatters pinned to `timeZone` (an IANA name). Without one they fall back
 * to the runtime's zone, which is what made server and browser disagree — so
 * pass it wherever the page knows it.
 */
export function matchTimeFormat(timeZone?: string): MatchTimeFormat {
  const zone = validZone(timeZone);
  const key = zone ?? "";
  const hit = cache.get(key);
  if (hit) return hit;

  const make = (options: Intl.DateTimeFormatOptions) => {
    const inZone = new Intl.DateTimeFormat("en-US", { ...options, timeZone: zone });
    const asCalendarDay = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
    return (value: string | Date): string => {
      if (typeof value === "string" && DATE_ONLY.test(value)) {
        const [y, m, d] = value.split("-").map(Number);
        return asCalendarDay.format(new Date(Date.UTC(y, m - 1, d, 12)));
      }
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? "" : inZone.format(date);
    };
  };

  const format: MatchTimeFormat = {
    shortDay: make(SHORT_DAY),
    day: make(DAY),
    longDay: make(LONG_DAY),
    time: make(TIME),
    dayTime: make(DAY_TIME),
  };
  cache.set(key, format);
  return format;
}
