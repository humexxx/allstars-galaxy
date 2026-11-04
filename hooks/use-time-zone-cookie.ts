"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { TIME_ZONE_COOKIE } from "@/lib/utils/date";

function readCookie(): string | null {
  const current = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`))
    ?.slice(TIME_ZONE_COOKIE.length + 1);
  return current ? decodeURIComponent(current) : null;
}

/**
 * Writes the browser's IANA time zone into the `tz` cookie so server renders
 * can work out the reader's calendar day (see `getRequestToday`). Only writes
 * when the value changed, so it costs nothing on most renders.
 *
 * A write means the page in front of the reader was rendered for another
 * zone — UTC on a device's first visit — so it re-renders once with the new
 * one. Only when the cookie stuck: with cookies blocked, a refresh would only
 * bring the same UTC page back.
 */
export function useTimeZoneCookie(): void {
  const router = useRouter();
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone || readCookie() === zone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    if (readCookie() === zone) router.refresh();
  }, [router]);
}
