import {
  calendarDayInTimeZone,
  endOfDayInTimeZone,
  formatDay,
  formatShortDay,
} from "@/lib/utils/date";

/**
 * How long a share link keeps working, as its owner chooses it.
 *
 * Every choice resolves to one instant (or to null, for never) at the moment
 * the owner saves it. That instant is what `trip_shares.expires_at` stores and
 * what the public resolver compares against, so nothing downstream needs to
 * know which choice produced it.
 *
 * Days are the reader's. "Until the trip ends" is the last millisecond of the
 * trip's last day on the owner's clock. On the server's clock, which is UTC, a
 * trip in Costa Rica would stop being shared at 6 pm on its final day.
 *
 * No `"use client"`: the schema imports its message from here.
 */

export const SHARE_EXPIRY_CHOICES = ["trip-end", "1d", "7d", "30d", "custom", "never"] as const;

export type ShareExpiryChoice = (typeof SHARE_EXPIRY_CHOICES)[number];

/** What the picker holds: the choice, and the day a custom choice means. */
export type ShareExpiryDraft = { choice: ShareExpiryChoice; day: string };

/** The only parts of a trip an expiry depends on. */
export type ShareExpiryTrip = { endDate: string | null };

/** The schema's message too, so the panel and the server say the same thing. */
export const EXPIRY_IN_PAST = "Pick an expiry in the future";

const DAY_MS = 86_400_000;

const PRESET_DAYS = { "1d": 1, "7d": 7, "30d": 30 } as const;

export function isShareExpiryChoice(value: string): value is ShareExpiryChoice {
  return (SHARE_EXPIRY_CHOICES as readonly string[]).includes(value);
}

/** The calendar day `instant` falls on in `timeZone`, as `YYYY-MM-DD`. */
function dayIn(instant: Date, timeZone: string): string {
  return calendarDayInTimeZone(instant, timeZone).toISOString().slice(0, 10);
}

/** The reader's calendar day at `now`, as `YYYY-MM-DD`. */
export function readerToday(timeZone: string, now: number): string {
  return dayIn(new Date(now), timeZone);
}

/** `day` moved by `days` calendar days. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * When a link chosen as "until the trip ends" stops working, or null when
 * that is not on offer.
 *
 * Only a trip with an end date has one: a missing end date is an open-ended
 * trip (a relocation, a sabbatical), not a trip that ends on its first day.
 * A trip that has already ended has nothing left to share it for.
 */
export function tripEndExpiry(
  trip: ShareExpiryTrip,
  timeZone: string,
  now: number
): Date | null {
  if (!trip.endDate) return null;
  const end = endOfDayInTimeZone(trip.endDate, timeZone);
  return end.getTime() > now ? end : null;
}

/**
 * Where a new link starts: for as long as the trip is on, when the trip has
 * an end still ahead of it. Anything else keeps what every link did before
 * there was a choice, which is to live until it is revoked.
 *
 * `day` is where "On a date…" opens: the trip's last day, or a week out.
 */
export function defaultShareExpiry(
  trip: ShareExpiryTrip,
  timeZone: string,
  now: number
): ShareExpiryDraft {
  const lastDay = tripEndExpiry(trip, timeZone, now) ? trip.endDate : null;
  return lastDay
    ? { choice: "trip-end", day: lastDay }
    : { choice: "never", day: addDays(readerToday(timeZone, now), 7) };
}

/**
 * The instant a draft stands for, or null for a link that never expires.
 *
 * A preset counts whole days from `now` (one day is 24 hours). A day, picked
 * or the trip's last, runs to its end in the reader's zone.
 */
export function resolveShareExpiry(
  draft: ShareExpiryDraft,
  trip: ShareExpiryTrip,
  timeZone: string,
  now: number
): Date | null {
  switch (draft.choice) {
    case "never":
      return null;
    case "trip-end":
      return trip.endDate ? endOfDayInTimeZone(trip.endDate, timeZone) : null;
    case "custom":
      return endOfDayInTimeZone(draft.day, timeZone);
    default:
      return new Date(now + PRESET_DAYS[draft.choice] * DAY_MS);
  }
}

/**
 * The draft a link's own expiry reads as, for changing it later.
 *
 * Which preset made an instant is not stored, so a link that ends with the
 * trip reads as "until the trip ends" and any other as its day. A link that
 * has already expired starts from the default instead: its old day is in
 * the past and could not be saved again.
 */
export function draftForShare(
  expiresAt: Date | string | null,
  trip: ShareExpiryTrip,
  timeZone: string,
  now: number
): ShareExpiryDraft {
  const fallback = defaultShareExpiry(trip, timeZone, now);
  if (expiresAt === null) return { choice: "never", day: fallback.day };
  const when = new Date(expiresAt).getTime();
  if (when <= now) return fallback;
  if (tripEndExpiry(trip, timeZone, now)?.getTime() === when) {
    return { choice: "trip-end", day: fallback.day };
  }
  return { choice: "custom", day: dayIn(new Date(when), timeZone) };
}

/**
 * "Expires Jan 16", or "Never expires", for a link that is still live. In the
 * reader's zone, so the day printed is the day the reader sees the link stop.
 *
 * A month and day name the next one of themselves, which is right for
 * anything under a year away: in October, "Jan 16" is next January. A year
 * or more out it would point at the wrong one, so the year is added.
 */
export function shareExpiryLabel(
  expiresAt: Date | string | null,
  timeZone: string,
  now: number
): string {
  if (expiresAt === null) return "Never expires";
  const when = new Date(expiresAt);
  const day = dayIn(when, timeZone);
  const today = readerToday(timeZone, now);
  const sameDayNextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  return `Expires ${
    day < sameDayNextYear ? formatShortDay(when, timeZone) : formatDay(when, timeZone)
  }`;
}
