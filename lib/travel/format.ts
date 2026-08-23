import { format } from "date-fns";

import { spansDays } from "./item-fields";
import type { TripItemCategory } from "@/types/travel";

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

/**
 * "$600" alone, or "$600 ~ $800" when the two ends differ.
 *
 * A tilde, not a dash: money written "$600 – $800" reads as a subtraction or
 * a negative figure at a glance, and the itinerary is full of both real
 * arithmetic and real dates using dashes. `~` says "about" and nothing else.
 *
 * Lives here, not beside the component that first needed it: it is pure
 * formatting, and its old home was a `"use client"` module — which meant the
 * public trip page, a server component, crashed the moment it tried to show a
 * price. A shared helper has no business carrying a runtime boundary.
 */
export function moneyRange(low: number, high: number, currency: string): string {
  return high > low
    ? `${formatTripMoney(low, currency)} ~ ${formatTripMoney(high, currency)}`
    : formatTripMoney(low, currency);
}

/**
 * A day's heading, carrying the run when something on it lasts longer.
 *
 * "Sunday, Jan 17" under a seven-night sailing says less than the trip does:
 * the day is where the cruise *starts*, and the reader has to open the item
 * to learn it ends on the 24th. When the day begins something that spans, the
 * heading says so.
 */
export function dayGroupLabel(day: string, runsUntil: string | null): string {
  const opens = format(parseTripDate(day), "EEEE, MMM d");
  if (!runsUntil || runsUntil <= day) return opens;
  return `${opens} – ${format(parseTripDate(runsUntil), "EEE, MMM d")}`;
}

/**
 * The furthest day anything starting here runs to, or null when nothing does.
 *
 * `spansDays` is what decides: a hotel booked to the 17th occupies the 17th,
 * a return flight on the 24th does not occupy the days in between, so only
 * the first should stretch a heading.
 */
export function runsUntil(
  items: { category: TripItemCategory; scheduledOn: string | null; endsOn: string | null }[]
): string | null {
  let latest: string | null = null;
  for (const item of items) {
    if (!item.endsOn || !spansDays(item.category)) continue;
    if (item.endsOn > (latest ?? "")) latest = item.endsOn;
  }
  return latest;
}
