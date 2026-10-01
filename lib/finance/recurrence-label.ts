/**
 * A recurring line's schedule in words, for the Setup lists. The lists used
 * to read `dayOfMonth` alone, so a 6-monthly car insurance read "Day 12 ·
 * monthly" and a "last Friday" rule read "Day 1".
 */
import type { RecurrenceType } from "@/types/finance";

import { parseIsoDay } from "./schedule";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDINAL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "Last" };
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export type RecurrenceLabelInput = {
  recurrenceType: RecurrenceType | string;
  dayOfMonth: number | null;
  weekOfMonth?: number | null;
  dayOfWeek?: number | null;
  intervalMonths?: number | null;
  recurrenceStart?: string | null;
};

/** "Day 12 · monthly" · "Last Fri · monthly" · "Day 12 · every 6 mo from Mar 2026". */
export function describeRecurrence(line: RecurrenceLabelInput): string {
  if (
    line.recurrenceType === "monthly_weekday" &&
    line.weekOfMonth != null &&
    line.dayOfWeek != null
  ) {
    return `${ORDINAL[line.weekOfMonth] ?? `${line.weekOfMonth}th`} ${WEEKDAY[line.dayOfWeek] ?? "?"} · monthly`;
  }
  const day = `Day ${line.dayOfMonth ?? 1}`;
  if (line.recurrenceType === "every_n_months" && line.intervalMonths && line.intervalMonths > 1) {
    const start = parseIsoDay(line.recurrenceStart ?? null);
    const from = start ? ` from ${MONTH.format(start)}` : "";
    return `${day} · every ${line.intervalMonths} mo${from}`;
  }
  return `${day} · monthly`;
}
