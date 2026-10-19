import { describe, expect, it } from "vitest";

import { describeRecurrence } from "./recurrence-label";

describe("describeRecurrence (Setup lists)", () => {
  it("an every-6-months line says so (it read 'Day 12 · monthly')", () => {
    expect(
      describeRecurrence({
        recurrenceType: "every_n_months",
        dayOfMonth: 12,
        intervalMonths: 6,
        recurrenceStart: "2026-03-01",
      })
    ).toBe("Day 12 · every 6 mo from Mar 2026");
  });

  it("a weekday rule names the weekday (it read 'Day 1')", () => {
    expect(
      describeRecurrence({
        recurrenceType: "monthly_weekday",
        dayOfMonth: null,
        weekOfMonth: 5,
        dayOfWeek: 5,
      })
    ).toBe("Last Fri · monthly");
  });

  it("a plain monthly line, and an every-1-month line, read as monthly", () => {
    expect(describeRecurrence({ recurrenceType: "monthly_day", dayOfMonth: 20 })).toBe(
      "Day 20 · monthly"
    );
    expect(
      describeRecurrence({ recurrenceType: "every_n_months", dayOfMonth: 3, intervalMonths: 1 })
    ).toBe("Day 3 · monthly");
  });
});
