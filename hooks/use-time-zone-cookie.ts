"use client";

import { useEffect } from "react";

import { TIME_ZONE_COOKIE } from "@/lib/utils/date";

/**
 * Writes the browser's IANA time zone into the `tz` cookie so server renders
 * can work out the reader's calendar day (see `getRequestToday`). Only writes
 * when the value changed, so it costs nothing on most renders.
 */
export function useTimeZoneCookie(): void {
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone) return;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1);
    if (current && decodeURIComponent(current) === zone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
  }, []);
}
