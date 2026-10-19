"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The reader's IANA time zone, decided once on the server from the `tz` cookie
 * and handed to every client component that formats an instant. Server render
 * and hydration then format in the SAME zone — formatting with the runtime's
 * own zone gave UTC on the server and local time in the browser, a different
 * day every evening west of Greenwich, and a hydration error with it.
 *
 * Before the cookie exists (the first request) both sides use UTC; the header
 * sets the cookie and the next render is local.
 */
const ReaderTimeZoneContext = createContext("UTC");

export function ReaderTimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string;
  children: ReactNode;
}) {
  return (
    <ReaderTimeZoneContext.Provider value={timeZone}>{children}</ReaderTimeZoneContext.Provider>
  );
}

export function useReaderTimeZone(): string {
  return useContext(ReaderTimeZoneContext);
}
