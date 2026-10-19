/**
 * Dates on the productivity surfaces, read as days in the READER's time zone.
 *
 * A task's due date (written at local noon by its form) and a progress entry
 * are instants. Formatted with the runtime's own zone (and the hydration
 * warning suppressed), the server's UTC text stuck: a value stored as midnight
 * UTC on Sep 25 printed "Sep 25" on a card while the form that edits it,
 * reading the browser's zone in Costa Rica, said Sep 24. The pages pass the
 * zone from the `tz` cookie and these formatters are pinned to it, so the
 * server and the browser agree.
 *
 * A road path's start and target dates are different: calendar days stored as
 * UTC midnight, read back in UTC (`calendarDayKey` / `formatCalendarDay`).
 */

function zoneOrUtc(timeZone: string | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string, style: "key" | "short" | "day"): Intl.DateTimeFormat {
  const id = `${zone}|${style}`;
  let fmt = formatters.get(id);
  if (!fmt) {
    fmt =
      style === "key"
        ? // en-CA prints ISO order (2026-09-24).
          new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
        : new Intl.DateTimeFormat("en-US", {
            timeZone: zone,
            month: "short",
            day: "numeric",
            ...(style === "day" ? { year: "numeric" } : {}),
          });
    formatters.set(id, fmt);
  }
  return fmt;
}

function toDate(instant: Date | string): Date {
  return instant instanceof Date ? instant : new Date(instant);
}

/** `YYYY-MM-DD` of the day `instant` falls on in `timeZone`. */
export function dayKey(instant: Date | string, timeZone?: string): string {
  return formatter(zoneOrUtc(timeZone), "key").format(toDate(instant));
}

/** "Sep 24" in the reader's zone. */
export function formatZonedShortDay(instant: Date | string, timeZone?: string): string {
  return formatter(zoneOrUtc(timeZone), "short").format(toDate(instant));
}

/** "Sep 24, 2026" in the reader's zone. */
export function formatZonedDay(instant: Date | string, timeZone?: string): string {
  return formatter(zoneOrUtc(timeZone), "day").format(toDate(instant));
}

/** Whole calendar days from `fromKey` to `toKey` (both `YYYY-MM-DD`). */
export function daysBetween(fromKey: string, toKey: string): number {
  const utc = (key: string): number => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toKey) - utc(fromKey)) / 86_400_000);
}

/**
 * A calendar day stored as UTC midnight (a road path's start and target): its
 * `YYYY-MM-DD` is the UTC date, whatever the reader's zone. Reading it in the
 * reader's zone put a target of Dec 15 on Dec 14 for anybody west of
 * Greenwich.
 */
export function calendarDayKey(value: Date | string): string {
  return toDate(value).toISOString().slice(0, 10);
}

/** "Dec 15, 2026" for a calendar day stored as UTC midnight. */
export function formatCalendarDay(value: Date | string): string {
  return formatter("UTC", "day").format(toDate(value));
}
