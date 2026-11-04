import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ensureHabitTasksForDay reads road paths through `db.query.roadPaths`, the
// columns and next order through ./board-service (stubbed here), and writes
// the tasks plus the generation stamp inside `db.transaction`.

const roadPathsFindMany = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const updateSet = vi.fn();

vi.mock("@/db", () => {
  const tx = {
    insert: () => ({
      values: (rows: unknown) => {
        insertValues(rows);
        return { onConflictDoNothing: () => ({ returning: () => insertReturning() }) };
      },
    }),
    update: () => ({
      set: (values: unknown) => {
        updateSet(values);
        return { where: () => Promise.resolve() };
      },
    }),
  };
  return {
    db: {
      query: {
        roadPaths: { findMany: (...args: unknown[]) => roadPathsFindMany(...args) },
      },
      transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    },
  };
});

const getBoardColumns = vi.fn();
const getNextTaskOrder = vi.fn();

vi.mock("./board-service", () => ({
  getBoardColumns: (...args: unknown[]) => getBoardColumns(...args),
  getNextTaskOrder: (...args: unknown[]) => getNextTaskOrder(...args),
}));

import { ensureHabitTasksForDay } from "./task-automation-service";
import type { BoardColumn, RoadPath } from "@/types";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ZONE = "America/Costa_Rica";
// A Monday.
const MONDAY = "2026-10-19";

function path(overrides: Partial<RoadPath> = {}): RoadPath {
  return {
    id: "00000000-0000-0000-0000-0000000000aa",
    userId: USER_ID,
    title: "Exercise",
    description: "30 minutes",
    targetValue: null,
    currentValue: "0",
    unit: null,
    startDate: new Date("2026-10-01T00:00:00Z"),
    targetDate: null,
    autoCreateTasks: false,
    taskFrequency: null,
    scheduleDays: [1, 3, 5],
    scheduleSince: "2026-10-01",
    lastTaskCreatedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as RoadPath;
}

const TODO = { id: "c-todo", order: 0, isDone: false } as BoardColumn;
const DONE = { id: "c-done", order: 2, isDone: true } as BoardColumn;

beforeEach(() => {
  getBoardColumns.mockResolvedValue([DONE, TODO]);
  getNextTaskOrder.mockResolvedValue(2);
  insertReturning.mockImplementation(() => Promise.resolve([{ id: "task-1" }]));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ensureHabitTasksForDay", () => {
  it("puts a due habit's task on the day's board, in the first column that is not Done", async () => {
    roadPathsFindMany.mockResolvedValueOnce([path()]);

    const created = await ensureHabitTasksForDay(USER_ID, MONDAY, ZONE);

    expect(created).toEqual([{ id: "task-1" }]);
    expect(getNextTaskOrder).toHaveBeenCalledWith("c-todo", USER_ID, MONDAY);
    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: USER_ID,
        columnId: "c-todo",
        roadPathId: path().id,
        title: "Exercise",
        description: "30 minutes",
        boardDate: MONDAY,
        order: 2,
      }),
    ]);
    expect(updateSet).toHaveBeenCalledWith({ lastTaskCreatedAt: expect.any(Date) });
  });

  it("does nothing on a day the habit is not due", async () => {
    roadPathsFindMany.mockResolvedValueOnce([path()]);

    expect(await ensureHabitTasksForDay(USER_ID, "2026-10-20", ZONE)).toEqual([]);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("does not bring back a task already generated today in the reader's zone", async () => {
    // 8 pm Monday in Costa Rica is already Tuesday in UTC.
    roadPathsFindMany.mockResolvedValueOnce([
      path({ lastTaskCreatedAt: new Date("2026-10-20T02:00:00Z") }),
    ]);

    expect(await ensureHabitTasksForDay(USER_ID, MONDAY, ZONE)).toEqual([]);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("generates again once the last one was an earlier day", async () => {
    roadPathsFindMany.mockResolvedValueOnce([
      path({ lastTaskCreatedAt: new Date("2026-10-16T15:00:00Z") }),
    ]);

    await ensureHabitTasksForDay(USER_ID, MONDAY, ZONE);

    expect(insertValues).toHaveBeenCalledOnce();
  });

  it("skips paths with no schedule or not started yet", async () => {
    roadPathsFindMany.mockResolvedValueOnce([
      path({ scheduleDays: null }),
      path({ startDate: new Date("2026-10-26T00:00:00Z") }),
    ]);

    expect(await ensureHabitTasksForDay(USER_ID, MONDAY, ZONE)).toEqual([]);
  });

  it("writes one task per due path in one insert, in order", async () => {
    roadPathsFindMany.mockResolvedValueOnce([
      path({ id: "p1", title: "Exercise" }),
      path({ id: "p2", title: "Read", scheduleDays: [0, 1, 2, 3, 4, 5, 6] }),
    ]);

    await ensureHabitTasksForDay(USER_ID, MONDAY, ZONE);

    const rows = insertValues.mock.calls[0][0] as { roadPathId: string; order: number }[];
    expect(rows.map((r) => [r.roadPathId, r.order])).toEqual([
      ["p1", 2],
      ["p2", 3],
    ]);
  });

  it("does nothing when every column is a Done column", async () => {
    roadPathsFindMany.mockResolvedValueOnce([path()]);
    getBoardColumns.mockResolvedValueOnce([DONE]);

    expect(await ensureHabitTasksForDay(USER_ID, MONDAY, ZONE)).toEqual([]);
    expect(insertValues).not.toHaveBeenCalled();
  });
});
