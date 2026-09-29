import { describe, expect, it } from "vitest";

import {
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
