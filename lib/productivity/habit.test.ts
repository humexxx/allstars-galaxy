import { describe, expect, it } from "vitest";

import {
  addDays,
  dayStatus,
  frequencyLabel,
  habitStats,
  isCalendarDay,
  isDueOn,
  nextDueDay,
  normalizeSchedule,
  scheduleLabel,
  weekdayOf,
  weekOf,
  type Habit,
} from "./habit";

// 2026-10-19 is a Monday.
const MON = "2026-10-19";
const MWF = [1, 3, 5];

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    scheduleDays: MWF,
    startDay: "2026-10-01",
    scheduleSince: null,
    endDay: null,
    ...overrides,
  };
}

describe("day arithmetic", () => {
  it("steps across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("reads the weekday of the calendar day, not of an instant", () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(weekdayOf("2026-10-18")).toBe(0);
  });

  it("returns Sunday to Saturday of a week", () => {
    expect(weekOf(MON)).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
  });

  it("accepts only days the calendar has", () => {
    expect(isCalendarDay("2026-10-19")).toBe(true);
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("2026-1-01")).toBe(false);
    expect(isCalendarDay(undefined)).toBe(false);
  });

  it("normalizes a schedule", () => {
    expect(normalizeSchedule([5, 1, 3, 1, 9, -1, 2.5])).toEqual([1, 3, 5]);
    expect(normalizeSchedule(null)).toEqual([]);
  });
});

describe("isDueOn", () => {
  it("is due on the scheduled weekdays from the start day", () => {
    expect(isDueOn(habit(), MON)).toBe(true);
    expect(isDueOn(habit(), "2026-10-20")).toBe(false);
    expect(isDueOn(habit({ startDay: "2026-10-20" }), MON)).toBe(false);
  });

  it("is never due after the path is completed", () => {
    expect(isDueOn(habit({ endDay: "2026-10-16" }), MON)).toBe(false);
  });

  it("is not due before the current schedule took effect", () => {
    expect(isDueOn(habit({ scheduleSince: "2026-10-20" }), MON)).toBe(false);
    expect(isDueOn(habit({ scheduleSince: "2026-10-20" }), "2026-10-21")).toBe(true);
  });
});

describe("dayStatus", () => {
  const checkIns = new Set(["2026-10-14"]);

  it("tells done, missed, due, upcoming, rest and outside apart", () => {
    const h = habit();
    expect(dayStatus(h, "2026-10-14", checkIns, MON)).toBe("done");
    expect(dayStatus(h, "2026-10-16", checkIns, MON)).toBe("missed");
    expect(dayStatus(h, MON, checkIns, MON)).toBe("due");
    expect(dayStatus(h, "2026-10-21", checkIns, MON)).toBe("upcoming");
    expect(dayStatus(h, "2026-10-15", checkIns, MON)).toBe("rest");
    expect(dayStatus(h, "2026-09-30", checkIns, MON)).toBe("outside");
  });

  it("shows a check-in as done even on a day the schedule no longer holds", () => {
    expect(dayStatus(habit({ scheduleDays: [2] }), "2026-10-14", checkIns, MON)).toBe("done");
  });

  it("never invents a miss before the current schedule", () => {
    const h = habit({ scheduleDays: [0, 1, 2, 3, 4, 5, 6], scheduleSince: "2026-10-17" });
    expect(dayStatus(h, "2026-10-15", checkIns, MON)).toBe("rest");
    expect(dayStatus(h, "2026-10-17", checkIns, MON)).toBe("missed");
  });
});

describe("habitStats", () => {
  it("counts a streak of due days, skipping the days off", () => {
    // Mon 12, Wed 14, Fri 16 done; today (Mon 19) still open.
    const stats = habitStats(habit({ startDay: "2026-10-12" }), ["2026-10-12", "2026-10-14", "2026-10-16"], MON);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.due).toBe(3);
    expect(stats.doneDue).toBe(3);
    expect(stats.completionRate).toBe(1);
  });

  it("does not let the open day break the streak, and counts it once done", () => {
    const h = habit({ startDay: "2026-10-12" });
    const open = habitStats(h, ["2026-10-16"], MON);
    expect(open.currentStreak).toBe(1);
    expect(open.due).toBe(3);

    const done = habitStats(h, ["2026-10-16", MON], MON);
    expect(done.currentStreak).toBe(2);
    expect(done.due).toBe(4);
  });

  it("resets the streak on a miss but keeps the best one", () => {
    // Oct 1 (Thu) start: Fri 2, Mon 5, Wed 7 done; Fri 9 missed; Mon 12, Wed 14 done; Fri 16 missed.
    const stats = habitStats(
      habit(),
      ["2026-10-02", "2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14"],
      MON
    );
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(3);
    expect(stats.due).toBe(7);
    expect(stats.doneDue).toBe(5);
    expect(stats.completionRate).toBeCloseTo(5 / 7);
  });

  it("has no rate before anything was due", () => {
    const stats = habitStats(habit({ startDay: MON }), [], MON);
    expect(stats.completionRate).toBeNull();
    expect(stats.currentStreak).toBe(0);
  });

  it("keeps counting check-ins made under an older schedule", () => {
    // Was daily; Tuesday and Thursday check-ins, then the schedule moved to MWF from Oct 17.
    const stats = habitStats(
      habit({ startDay: "2026-10-13", scheduleSince: "2026-10-17" }),
      ["2026-10-13", "2026-10-15"],
      MON
    );
    // Neither old day is a miss, both still done; nothing due since Oct 17 before today.
    expect(stats.checkIns).toBe(2);
    expect(stats.currentStreak).toBe(2);
    expect(stats.due).toBe(0);
  });

  it("stops at the day the path was completed", () => {
    const stats = habitStats(habit({ startDay: "2026-10-12", endDay: "2026-10-14" }), ["2026-10-12"], MON);
    expect(stats.due).toBe(2);
    expect(stats.doneDue).toBe(1);
  });

  it("works for a path with no schedule", () => {
    const stats = habitStats(habit({ scheduleDays: [] }), ["2026-10-15"], MON);
    expect(stats.due).toBe(0);
    expect(stats.checkIns).toBe(1);
    expect(stats.currentStreak).toBe(1);
  });

  it("ignores check-ins after today", () => {
    expect(habitStats(habit(), ["2026-10-21"], MON).checkIns).toBe(0);
  });
});

describe("nextDueDay", () => {
  it("finds today or the next due day", () => {
    expect(nextDueDay(habit(), MON)).toBe(MON);
    expect(nextDueDay(habit(), "2026-10-20")).toBe("2026-10-21");
    expect(nextDueDay(habit({ scheduleDays: [] }), MON)).toBeNull();
  });
});

describe("labels", () => {
  it("names common schedules", () => {
    expect(scheduleLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(scheduleLabel([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(scheduleLabel([6, 0])).toBe("Weekends");
    expect(scheduleLabel([5, 1, 3])).toBe("Mon, Wed, Fri");
    expect(scheduleLabel([0, 2])).toBe("Tue, Sun");
    expect(scheduleLabel([])).toBe("No schedule");
  });

  it("says how often", () => {
    expect(frequencyLabel(MWF)).toBe("3× a week");
    expect(frequencyLabel([2])).toBe("Once a week");
    expect(frequencyLabel([0, 1, 2, 3, 4, 5, 6])).toBeNull();
  });
});
