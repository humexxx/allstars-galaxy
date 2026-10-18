import { describe, expect, it } from "vitest";

import {
  calendarDayInTimeZone,
  earliestCalendarDay,
  isValidTimeZone,
  todayInTimeZone,
  formatDay,
  formatDayRange,
  formatMonth,
  formatShortDay,
  formatWeekdayDay,
  toDay,
} from "./date";
import { formatCurrencyCompact } from "./format";

describe("toDay", () => {
  it("reads a date-only string as a local calendar day", () => {
    const d = toDay("2026-03-08");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 8]);
  });

  it("keeps instants as instants", () => {
    const iso = "2026-03-08T12:00:00.000Z";
    expect(toDay(iso).toISOString()).toBe(iso);
  });
});

describe("date formatters", () => {
  it("formats the standard single-day shapes", () => {
    expect(formatDay("2026-09-03")).toBe("Sep 3, 2026");
    expect(formatShortDay("2026-09-03")).toBe("Sep 3");
    expect(formatWeekdayDay("2026-09-03")).toBe("Thu, Sep 3");
    expect(formatMonth("2026-09-03")).toBe("Sep 2026");
  });

  it("collapses ranges by shared month and year", () => {
    expect(formatDayRange("2026-09-03", "2026-09-10")).toBe("Sep 3 – 10, 2026");
    expect(formatDayRange("2026-09-28", "2026-10-02")).toBe("Sep 28 – Oct 2, 2026");
    expect(formatDayRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026 – Jan 2, 2027");
    expect(formatDayRange("2026-09-03", null)).toBe("Sep 3, 2026");
    expect(formatDayRange("2026-09-03", "2026-09-03")).toBe("Sep 3, 2026");
  });
});

describe("formatCurrencyCompact", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatCurrencyCompact(950)).toBe("$950");
    expect(formatCurrencyCompact(350_000)).toBe("$350k");
    expect(formatCurrencyCompact(1_250)).toBe("$1.3k");
    expect(formatCurrencyCompact(1_500_000)).toBe("$1.5M");
    expect(formatCurrencyCompact(-2_000)).toBe("-$2k");
  });
});

describe("today in the reader's time zone (F25)", () => {
  // 2026-09-30 22:30 UTC — still Sep 30 in London's UTC, already Oct 1 in Madrid.
  const instant = new Date(Date.UTC(2026, 8, 30, 22, 30));

  it("resolves the calendar day in the given zone, as UTC midnight", () => {
    expect(todayInTimeZone("Europe/Madrid", instant)).toEqual(new Date(Date.UTC(2026, 9, 1)));
    expect(todayInTimeZone("America/Mexico_City", instant)).toEqual(new Date(Date.UTC(2026, 8, 30)));
  });

  it("falls back to UTC for a missing or unknown zone", () => {
    expect(todayInTimeZone(null, instant)).toEqual(new Date(Date.UTC(2026, 8, 30)));
    expect(todayInTimeZone("Not/AZone", instant)).toEqual(new Date(Date.UTC(2026, 8, 30)));
    expect(isValidTimeZone("Europe/Madrid")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });

  it("reads a stored instant (a plan's createdAt) as the reader's day", () => {
    expect(calendarDayInTimeZone(instant, "Asia/Tokyo")).toEqual(new Date(Date.UTC(2026, 9, 1)));
  });
});

describe("earliestCalendarDay", () => {
  const U = (y: number, m: number, d: number, h = 0): Date => new Date(Date.UTC(y, m - 1, d, h));

  it("is the day in UTC−12: behind UTC until noon UTC", () => {
    expect(earliestCalendarDay(U(2026, 10, 1, 0))).toEqual(U(2026, 9, 30));
    expect(earliestCalendarDay(U(2026, 10, 1, 11))).toEqual(U(2026, 9, 30));
    expect(earliestCalendarDay(U(2026, 10, 1, 12))).toEqual(U(2026, 10, 1));
  });

  it("is never later than the day in any real zone", () => {
    const instant = U(2026, 10, 1, 3);
    for (const zone of ["Pacific/Pago_Pago", "America/Los_Angeles", "UTC", "Pacific/Kiritimati"]) {
      expect(earliestCalendarDay(instant).getTime()).toBeLessThanOrEqual(
        calendarDayInTimeZone(instant, zone).getTime()
      );
    }
  });
});
