"use client";

import { useMemo } from "react";

import { useReaderTimeZone } from "@/components/reader-time-zone";

import { matchTimeFormat, type MatchTimeFormat } from "./match-time";

/**
 * Kickoff formatters in the reader's zone (the portal-wide
 * `ReaderTimeZoneProvider`) — the same text on the server and the client.
 */
export function useMatchTime(): MatchTimeFormat {
  const timeZone = useReaderTimeZone();
  return useMemo(() => matchTimeFormat(timeZone), [timeZone]);
}
