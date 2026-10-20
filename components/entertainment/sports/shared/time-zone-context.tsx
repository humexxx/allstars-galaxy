"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useReaderTimeZone } from "@/components/reader-time-zone";
import { todayInTimeZone } from "@/lib/utils/date";

import { matchTimeFormat, type MatchTimeFormat } from "./match-time";

/**
 * Kickoff formatters in the reader's zone (the portal-wide
 * `ReaderTimeZoneProvider`) — the same text on the server and the client.
 */
export function useMatchTime(): MatchTimeFormat {
  const timeZone = useReaderTimeZone();
  return useMemo(() => matchTimeFormat(timeZone), [timeZone]);
}

const SportsTodayContext = createContext<string | null>(null);

/**
 * The reader's today (`YYYY-MM-DD`) as the page decided it for this request
 * (`getRequestTodayIso`). A client that read its own clock while rendering
 * could hydrate on the other side of midnight from the server and print
 * "Today" on a different day.
 */
export function SportsTodayProvider({ today, children }: { today: string; children: ReactNode }) {
  return <SportsTodayContext.Provider value={today}>{children}</SportsTodayContext.Provider>;
}

/** The request's today, or — outside the hub, as in a test — the reader's own. */
export function useSportsToday(): string {
  const decided = useContext(SportsTodayContext);
  const timeZone = useReaderTimeZone();
  return decided ?? todayInTimeZone(timeZone).toISOString().slice(0, 10);
}
