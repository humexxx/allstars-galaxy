import { describe, expect, it } from "vitest";

import {
  isDateInPeriod,
  iteratePeriods,
  nextPeriodStart,
  periodAnchorIso,
  periodAtIndex,
  periodLengthDays,
  periodRangeFor,
  periodStartFor,
} from "./period";

// Sanity helper — every test below uses UTC dates so the math is timezone-
// independent across machines.
function utc(year: number, monthZeroIdx: number, day: number): Date {
  return new Date(Date.UTC(year, monthZeroIdx, day));
}

describe("periodStartFor", () => {
  it("returns this month's anchor when today is on or after it", () => {
    expect(periodStartFor(utc(2026, 0, 15), 15)).toEqual(utc(2026, 0, 15));
    expect(periodStartFor(utc(2026, 0, 20), 15)).toEqual(utc(2026, 0, 15));
    // Anchor day 1 = calendar month start; today day 15 is well past.
    expect(periodStartFor(utc(2026, 0, 15), 1)).toEqual(utc(2026, 0, 1));
  });

  it("returns the previous month's anchor when today is before it", () => {
    expect(periodStartFor(utc(2026, 0, 14), 15)).toEqual(utc(2025, 11, 15));
    expect(periodStartFor(utc(2026, 0, 1), 25)).toEqual(utc(2025, 11, 25));
  });

  it("clamps day=31 to month-end when the destination month is shorter", () => {
    // February 28 is the last day; anchor day=31 clamps there.
    expect(periodStartFor(utc(2026, 1, 28), 31)).toEqual(utc(2026, 1, 28));
    // Mid-February with day=31: today=15 is before clamped 28 → previous
    // month's anchor is Jan 31.
    expect(periodStartFor(utc(2026, 1, 15), 31)).toEqual(utc(2026, 0, 31));
  });

  it("respects leap-year clamping for February", () => {
    // 2024 is a leap year — Feb 29 is the last day.
    expect(periodStartFor(utc(2024, 1, 29), 31)).toEqual(utc(2024, 1, 29));
    // 2026 is non-leap — Feb 28 is the last day.
    expect(periodStartFor(utc(2026, 1, 28), 29)).toEqual(utc(2026, 1, 28));
  });
});

describe("nextPeriodStart", () => {
  it("rolls forward one month and re-clamps the anchor", () => {
    expect(nextPeriodStart(utc(2026, 0, 15), 15)).toEqual(utc(2026, 1, 15));
    // Jan 31 → Feb 28 (clamped in non-leap year)
    expect(nextPeriodStart(utc(2026, 0, 31), 31)).toEqual(utc(2026, 1, 28));
    // Feb 28 → Mar 31 (re-clamps back to the configured day when month allows)
    expect(nextPeriodStart(utc(2026, 1, 28), 31)).toEqual(utc(2026, 2, 31));
  });
});

describe("periodRangeFor", () => {
  it("runs from the anchor day to the day before the next anchor", () => {
    expect(periodRangeFor(utc(2026, 0, 20), 15)).toEqual({
      start: utc(2026, 0, 15),
      end: utc(2026, 1, 14),
    });
  });

  it("collapses to a calendar month when day=1", () => {
    expect(periodRangeFor(utc(2026, 0, 10), 1)).toEqual({
      start: utc(2026, 0, 1),
      end: utc(2026, 0, 31),
    });
  });

  it("handles day=31 across February without losing days outside the period", () => {
    // Period containing Feb 15 with day=31 anchor: Jan 31 → Feb 27.
    expect(periodRangeFor(utc(2026, 1, 15), 31)).toEqual({
      start: utc(2026, 0, 31),
      end: utc(2026, 1, 27),
    });
    // Period containing Feb 28 (the clamped anchor): Feb 28 → Mar 30.
    expect(periodRangeFor(utc(2026, 1, 28), 31)).toEqual({
      start: utc(2026, 1, 28),
      end: utc(2026, 2, 30),
    });
  });
});

describe("periodAtIndex / iteratePeriods", () => {
  it("indexes forward in time", () => {
    expect(periodAtIndex(utc(2026, 0, 15), 15, 0)).toEqual({
      start: utc(2026, 0, 15),
      end: utc(2026, 1, 14),
    });
    expect(periodAtIndex(utc(2026, 0, 15), 15, 3)).toEqual({
      start: utc(2026, 3, 15),
      end: utc(2026, 4, 14),
    });
  });

  it("iteratePeriods returns N consecutive non-overlapping periods", () => {
    const periods = iteratePeriods(utc(2026, 0, 15), 15, 3);
    expect(periods).toHaveLength(3);
    expect(periods[0].start).toEqual(utc(2026, 0, 15));
    expect(periods[1].start).toEqual(utc(2026, 1, 15));
    expect(periods[2].start).toEqual(utc(2026, 2, 15));
    // No gap: each end is one day before the next start.
    expect(periods[0].end).toEqual(utc(2026, 1, 14));
    expect(periods[1].end).toEqual(utc(2026, 2, 14));
  });
});

describe("periodAnchorIso", () => {
  it("returns the YYYY-MM-DD of the period start", () => {
    expect(periodAnchorIso(utc(2026, 0, 20), 15)).toBe("2026-01-15");
    expect(periodAnchorIso(utc(2026, 0, 10), 15)).toBe("2025-12-15");
    expect(periodAnchorIso(utc(2026, 1, 15), 31)).toBe("2026-01-31");
  });
});

describe("periodLengthDays", () => {
  it("counts inclusive days", () => {
    // Jan 15 → Feb 14 = 31 days (Jan has 31 days, so 15..31 = 17 + 1..14 = 14 → 31).
    expect(
      periodLengthDays({ start: utc(2026, 0, 15), end: utc(2026, 1, 14) })
    ).toBe(31);
    // Feb 1 → Feb 28 = 28 days (non-leap).
    expect(
      periodLengthDays({ start: utc(2026, 1, 1), end: utc(2026, 1, 28) })
    ).toBe(28);
    // Single-day period.
    expect(
      periodLengthDays({ start: utc(2026, 0, 1), end: utc(2026, 0, 1) })
    ).toBe(1);
  });
});

describe("isDateInPeriod", () => {
  it("treats both endpoints as inclusive", () => {
    const period = { start: utc(2026, 0, 15), end: utc(2026, 1, 14) };
    expect(isDateInPeriod(utc(2026, 0, 15), period)).toBe(true);
    expect(isDateInPeriod(utc(2026, 1, 14), period)).toBe(true);
    expect(isDateInPeriod(utc(2026, 0, 14), period)).toBe(false);
    expect(isDateInPeriod(utc(2026, 1, 15), period)).toBe(false);
  });
});
