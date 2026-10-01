import { describe, expect, it } from "vitest";

import { relativeDays } from "./trips-overview";

const today = "2026-09-30";

describe("relativeDays", () => {
  it("counts down to a trip that has not started", () => {
    expect(relativeDays({ startDate: "2026-10-01", endDate: null }, today)).toBe("Tomorrow");
    expect(relativeDays({ startDate: "2026-10-09", endDate: "2026-10-12" }, today)).toBe(
      "In 9 days"
    );
    expect(relativeDays({ startDate: "2026-12-27", endDate: "2027-01-09" }, today)).toBe(
      "In 3 mo"
    );
  });

  it("says when a trip under way ends, not how long ago it began", () => {
    // It read "2 days ago" — as if the week in the forest were already over.
    expect(relativeDays({ startDate: "2026-09-28", endDate: "2026-10-03" }, today)).toBe(
      "Ends in 3 days"
    );
    expect(relativeDays({ startDate: "2026-09-28", endDate: "2026-10-01" }, today)).toBe(
      "Ends tomorrow"
    );
    expect(relativeDays({ startDate: "2026-09-28", endDate: "2026-09-30" }, today)).toBe(
      "Ends today"
    );
    expect(relativeDays({ startDate: "2026-09-30", endDate: "2026-10-04" }, today)).toBe(
      "Starts today"
    );
  });

  it("counts a past trip from its last day", () => {
    expect(relativeDays({ startDate: "2026-09-20", endDate: "2026-09-29" }, today)).toBe(
      "Yesterday"
    );
    // Mar 22 is 192 days back; from the start it read "200 days ago".
    expect(relativeDays({ startDate: "2026-03-14", endDate: "2026-03-22" }, today)).toBe(
      "6 mo ago"
    );
  });
});
