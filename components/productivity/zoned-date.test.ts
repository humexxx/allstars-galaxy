import { describe, expect, it } from "vitest";

import {
  calendarDayKey,
  dayKey,
  daysBetween,
  formatCalendarDay,
  formatZonedDay,
  formatZonedShortDay,
} from "./zoned-date";
import { dueTone, isDoneColumnName } from "./board/due-date";

describe("zoned dates", () => {
  // 2026-09-25T00:00Z is still the evening of Sep 24 in Costa Rica (UTC−6).
  const midnightUtc = new Date("2026-09-25T00:00:00Z");

  it("reads an instant as the reader's day, not the server's", () => {
    expect(dayKey(midnightUtc, "America/Costa_Rica")).toBe("2026-09-24");
    expect(dayKey(midnightUtc, "Europe/Madrid")).toBe("2026-09-25");
    expect(formatZonedShortDay(midnightUtc, "America/Costa_Rica")).toBe("Sep 24");
    expect(formatZonedDay(midnightUtc, "Europe/Madrid")).toBe("Sep 25, 2026");
  });

  it("falls back to UTC for a missing or bogus zone", () => {
    expect(dayKey(midnightUtc)).toBe("2026-09-25");
    expect(dayKey(midnightUtc, "Not/AZone")).toBe("2026-09-25");
  });

  it("reads a road path's calendar day in UTC whatever the reader's zone", () => {
    expect(calendarDayKey("2026-12-15T00:00:00Z")).toBe("2026-12-15");
    expect(formatCalendarDay(new Date("2026-12-15T00:00:00Z"))).toBe("Dec 15, 2026");
  });

  it("counts whole calendar days across months", () => {
    // Hand count: Sep 30 → Oct 31 is 31, → Nov 30 is 61, → Dec 15 is 76.
    expect(daysBetween("2026-09-30", "2026-12-15")).toBe(76);
    expect(daysBetween("2026-09-30", "2026-09-15")).toBe(-15);
  });
});

describe("due tone", () => {
  it("ranks a due day against today", () => {
    expect(dueTone("2026-09-24", "2026-09-30")).toBe("overdue");
    expect(dueTone("2026-09-30", "2026-09-30")).toBe("today");
    expect(dueTone("2026-10-01", "2026-09-30")).toBe("tomorrow");
    expect(dueTone("2026-12-31", "2026-12-30")).toBe("tomorrow");
    expect(dueTone("2026-10-09", "2026-09-30")).toBe("later");
  });

  it("knows a finished column by its name", () => {
    expect(isDoneColumnName("Done")).toBe(true);
    expect(isDoneColumnName("Completed ✅")).toBe(true);
    expect(isDoneColumnName("Waiting on someone else")).toBe(false);
    expect(isDoneColumnName("Undone ideas")).toBe(false);
  });
});
