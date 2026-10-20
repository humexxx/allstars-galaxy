import { describe, expect, it } from "vitest";

import { buildDashboardProductivity } from "./dashboard";

// A Monday.
const TODAY = "2026-10-19";
const TODO = { id: "c-todo", name: "Todo", order: 0, isDone: false };
const WORKING = { id: "c-working", name: "Working", order: 1, isDone: false };
const DONE = { id: "c-done", name: "Done", order: 2, isDone: true };

function task(id: string, columnId: string, order = 0, extra: Partial<{ roadPathId: string; completedAt: Date }> = {}) {
  return { id, title: id, columnId, order, roadPathId: null, completedAt: null, ...extra };
}

function path(id: string, scheduleDays: number[] | null, checkIns: string[] = [], completedAt: Date | null = null) {
  return {
    id,
    title: id,
    scheduleDays,
    scheduleSince: "2026-10-05",
    startDate: new Date("2026-10-05T00:00:00Z"),
    completedAt,
    checkIns: checkIns.map((day) => ({ day })),
  };
}

function build(overrides: Partial<Parameters<typeof buildDashboardProductivity>[0]> = {}) {
  return buildDashboardProductivity({
    today: TODAY,
    timeZone: "America/Costa_Rica",
    columns: [TODO, WORKING, DONE],
    tasks: [],
    carryOverCount: 0,
    roadPaths: [],
    ...overrides,
  });
}

describe("buildDashboardProductivity", () => {
  it("counts today's board and lists what is open in board order", () => {
    const summary = build({
      tasks: [
        task("write", WORKING.id),
        task("call", TODO.id, 1),
        task("gym", TODO.id, 0, { roadPathId: "p-gym" }),
        task("shipped", DONE.id),
        task("finished elsewhere", TODO.id, 2, { completedAt: new Date() }),
      ],
      carryOverCount: 2,
    });

    expect(summary.total).toBe(5);
    expect(summary.done).toBe(2);
    expect(summary.open).toEqual([
      { id: "gym", title: "gym", columnName: "Todo", isHabit: true },
      { id: "call", title: "call", columnName: "Todo", isHabit: false },
      { id: "write", title: "write", columnName: "Working", isHabit: false },
    ]);
    expect(summary.carryOverCount).toBe(2);
  });

  it("puts what is due today first, then what is done, then the rest by when it is next", () => {
    const summary = build({
      roadPaths: [
        path("weekends", [0, 6]),
        path("read", [0, 1, 2, 3, 4, 5, 6], ["2026-10-19"]),
        path("gym", [1, 3, 5], ["2026-10-14", "2026-10-16"]),
        path("tuesdays", [2]),
      ],
    });

    expect(summary.habits.map((h) => [h.id, h.today, h.next])).toEqual([
      ["gym", "due", TODAY],
      ["read", "done", "2026-10-20"],
      ["tuesdays", "rest", "2026-10-20"],
      ["weekends", "rest", "2026-10-24"],
    ]);
    expect(summary.habits[0].currentStreak).toBe(2);
  });

  it("leaves out paths with no schedule and paths already completed", () => {
    const summary = build({
      roadPaths: [path("goal", null), path("done", [1], [], new Date("2026-10-10T12:00:00Z"))],
    });

    expect(summary.habits).toEqual([]);
  });
});
