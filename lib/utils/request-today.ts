import "server-only";

import { cookies } from "next/headers";

import { TIME_ZONE_COOKIE, isValidTimeZone, todayInTimeZone } from "./date";

/** The reader's IANA time zone from the `tz` cookie, or "UTC". */
export async function getRequestTimeZone(): Promise<string> {
  const store = await cookies();
  const value = store.get(TIME_ZONE_COOKIE)?.value;
  return isValidTimeZone(value) ? value : "UTC";
}

/**
 * Today's calendar day for the reader (UTC midnight of their local day). Every
 * finance surface derives "the current period" from this, so a reader east or
 * west of Greenwich sees the period their own calendar is in.
 */
export async function getRequestToday(now: Date = new Date()): Promise<Date> {
  return todayInTimeZone(await getRequestTimeZone(), now);
}

/**
 * The reader's today as `YYYY-MM-DD`, for client components that would
 * otherwise read `new Date()` themselves: the server's UTC day and the
 * browser's local day disagree every evening west of Greenwich, and React
 * throws the server markup away over the mismatch. Decide it here, pass it down.
 */
export async function getRequestTodayIso(now: Date = new Date()): Promise<string> {
  // UTC midnight of the reader's day, so the ISO prefix IS that day.
  return (await getRequestToday(now)).toISOString().slice(0, 10);
}
