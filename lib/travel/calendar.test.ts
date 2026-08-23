import { describe, expect, it } from "vitest";

import { addMonths, capLanes, layOutWeek, monthWeeks, occupiedRuns } from "./calendar";
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

describe("capLanes", () => {
  const seg = (lane: number, start = 0, span = 1) =>
    ({ lane, start, span, opensRun: true, closesRun: true, leg: "only" as const,
       item: { id: `i${lane}-${start}`, title: "x", category: "activity" as const,
               scheduledOn: "2027-01-10", endsOn: null } });

  it("leaves a day alone until the cap actually buys something", () => {
    // Collapsing four lanes to show "+1 more" in place of the one thing it
    // hides helps nobody.
    const segs = [seg(0), seg(1), seg(2), seg(3)];
    const { visible, hiddenByDay } = capLanes(segs, 4);

    expect(visible).toHaveLength(4);
    expect(hiddenByDay.every((n) => n === 0)).toBe(true);
  });

  it("keeps room for the count once a day overflows", () => {
    const segs = [seg(0), seg(1), seg(2), seg(3), seg(4)];
    const { visible, hiddenByDay } = capLanes(segs, 4);

    // Three shown, and the fourth lane is given over to "+2".
    expect(visible.map((s) => s.lane)).toEqual([0, 1, 2]);
    expect(hiddenByDay[0]).toBe(2);
  });

  it("counts a hidden run only on the days it actually covers", () => {
    // A run hidden on Tuesday is not hidden on Friday just because it passes
    // through both.
    const segs = [seg(0), seg(1), seg(2), seg(3), seg(4)];
    const { hiddenByDay } = capLanes(segs, 4);

    expect(hiddenByDay[0]).toBe(2);
    expect(hiddenByDay.slice(1).every((n) => n === 0)).toBe(true);
  });

  it("caps the day that overflows and leaves its neighbours alone", () => {
    // Deciding week-wide meant one packed Sunday collapsed every other day in
    // its row: a Monday holding exactly the cap lost its last run to a "+1"
    // standing in the very slot that run wanted.
    const sunday = [seg(0), seg(1), seg(2), seg(3), seg(4)];
    const monday = [seg(0, 1), seg(1, 1), seg(2, 1), seg(3, 1)];
    const { hiddenByDay, visible } = capLanes([...sunday, ...monday], 4);

    expect(hiddenByDay[0]).toBe(2);
    expect(hiddenByDay[1]).toBe(0);
    // Monday keeps all four of its runs.
    expect(visible.filter((s) => s.start === 1)).toHaveLength(4);
  });

  it("cuts a spanning run on every day it crosses, not just the busy one", () => {
    // Lanes are shared across the week on purpose — a run that changed rows
    // mid-week would stop reading as one journey. So the lane it was given
    // is what makes each cell tall, and a run parked on lane 4 is over the
    // cap on a quiet Monday exactly as it is on a packed Sunday.
    const segs = [seg(0), seg(1), seg(2), seg(3), seg(4, 0, 3)];
    const { hiddenByDay } = capLanes(segs, 4);

    expect(hiddenByDay.slice(0, 3)).toEqual([2, 1, 1]);
    expect(hiddenByDay[3]).toBe(0);
  });
});
