import { format } from "date-fns";

/**
 * Shared, server-safe formatting helpers for the travel planner. These were
 * previously duplicated across travel components — and importing them from the
 * "use client" trip-detail module turned them into client references, which
 * made the public share page (a server component) throw a 500 on every token.
 * Keep this module free of "use client" so both RSC and client components can
 * call them.
 */

/** Parse a date-only `YYYY-MM-DD` column value in LOCAL time. `new Date(str)`
 *  would parse as UTC midnight and shift a day in negative-offset timezones. */
export function parseTripDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateRange(start: string, end: string | null): string {
  const s = parseTripDate(start);
  if (!end || start === end) return format(s, "EEE, MMM d, yyyy");
  const e = parseTripDate(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${format(s, "EEE, MMM d")} – ${format(e, "EEE, MMM d, yyyy")}`;
  }
  return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

/** Inclusive day count of the trip (Aug 12 → Aug 14 = 3). */
export function tripDays(start: string, end: string | null): number {
  const s = parseTripDate(start);
  const e = end ? parseTripDate(end) : s;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** "1 day" / "5 days" — pluralized duration for stat cards. */
export function tripDurationLabel(start: string, end: string | null): string {
  const days = tripDays(start, end);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function formatTripMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown currency code falls back to plain number prefixed with code.
    return `${currency} ${value.toFixed(2)}`;
  }
}
