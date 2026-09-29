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
