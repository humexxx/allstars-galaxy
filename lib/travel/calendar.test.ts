import { describe, expect, it } from "vitest";

import { addMonths, layOutWeek, monthWeeks, occupiedRuns } from "./calendar";
import type { CalendarItem } from "./calendar";

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  id: "x", title: "Something", category: "activity",
  scheduledOn: "2027-01-15", endsOn: null, ...over,
});

describe("monthWeeks", () => {
  it("covers the whole month, padded to whole weeks", () => {
    // January 2027 starts on a Friday and ends on a Sunday, so the grid runs
    // from Sunday 27 Dec to Saturday 6 Feb.
    const weeks = monthWeeks("2027-01");
    expect(weeks[0][0]).toBe("2026-12-27");
    expect(weeks[weeks.length - 1][6]).toBe("2027-02-06");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe("addMonths", () => {
  it("crosses a year boundary in both directions", () => {
    expect(addMonths("2027-01", -1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});

describe("occupiedRuns", () => {
  it("runs a hotel across every night of the stay", () => {
    expect(
      occupiedRuns(item({ category: "lodging", scheduledOn: "2027-01-15", endsOn: "2027-01-17" }))
    ).toEqual([{ from: "2027-01-15", to: "2027-01-17", leg: "only" }]);
  });

  it("splits a return flight into the day out and the day back", () => {
    // The bug this exists to prevent: drawn as one run, a 15th–24th round
    // trip painted a plane across all ten days of the holiday.
    expect(
      occupiedRuns(item({ category: "flight", scheduledOn: "2027-01-15", endsOn: "2027-01-24" }))
    ).toEqual([
      // The leg is what stops the fare being printed on both bars.
      { from: "2027-01-15", to: "2027-01-15", leg: "out" },
      { from: "2027-01-24", to: "2027-01-24", leg: "back" },
    ]);
  });

  it("gives an undated item no days at all", () => {
    expect(occupiedRuns(item({ scheduledOn: null }))).toEqual([]);
  });
});

describe("layOutWeek", () => {
  const week = [
    "2027-01-10", "2027-01-11", "2027-01-12", "2027-01-13",
    "2027-01-14", "2027-01-15", "2027-01-16",
  ];

  it("clips a run to the week and remembers which end it lost", () => {
    const [seg] = layOutWeek(week, [
      item({ id: "c", category: "cruise", scheduledOn: "2027-01-14", endsOn: "2027-01-20" }),
    ]);
    expect(seg).toMatchObject({ start: 4, span: 3, opensRun: true, closesRun: false });
  });

  it("drops an overlapping run to the next lane", () => {
    const segs = layOutWeek(week, [
      item({ id: "a", category: "lodging", scheduledOn: "2027-01-11", endsOn: "2027-01-14" }),
      item({ id: "b", category: "cruise", scheduledOn: "2027-01-13", endsOn: "2027-01-16" }),
    ]);
    expect(segs.map((s) => s.lane)).toEqual([0, 1]);
  });

  it("reuses a lane once the earlier run has ended", () => {
    // Two things that never touch belong on the same line; stacking them
    // would make a quiet week look as busy as a full one.
    const segs = layOutWeek(week, [
      item({ id: "a", scheduledOn: "2027-01-10" }),
      item({ id: "b", scheduledOn: "2027-01-15" }),
    ]);
    expect(segs.map((s) => s.lane)).toEqual([0, 0]);
  });

  it("ignores anything that misses the week entirely", () => {
    expect(layOutWeek(week, [item({ scheduledOn: "2027-02-02" })])).toEqual([]);
  });
});
