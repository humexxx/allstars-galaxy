import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL, type Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

// A recording stand-in for `@/db`. Reads go through the `query.*` mocks;
// every write lands in `writes` with its table, its values and its WHERE
// rendered to SQL, so a test can check WHICH rows a write was scoped to —
// the column and the DAY — not only that it ran.

type Write = {
  kind: "insert" | "update" | "delete" | "execute";
  table?: string;
  values?: unknown;
  where?: { sql: string; params: unknown[] };
  onConflictDoNothing?: boolean;
};

const dialect = new PgDialect();
const render = (condition: SQL | undefined) =>
  condition ? dialect.sqlToQuery(condition) : undefined;

const writes: Write[] = [];
const columnsFindMany = vi.fn();
const columnsFindFirst = vi.fn();
const tasksFindMany = vi.fn();
const tasksFindFirst = vi.fn();
const selectRows = vi.fn();
const returningRows = vi.fn();

/** A builder that can also be awaited, the way drizzle's are. */
function settled<T extends object>(chain: T): T & PromiseLike<undefined> {
  const done = Promise.resolve(undefined);
  return Object.assign(chain, { then: done.then.bind(done) });
}

vi.mock("@/db", () => {
  const db = {
    query: {
      boardColumns: {
        findMany: (...args: unknown[]) => columnsFindMany(...args),
        findFirst: (...args: unknown[]) => columnsFindFirst(...args),
      },
      boardTasks: {
        findMany: (...args: unknown[]) => tasksFindMany(...args),
        findFirst: (...args: unknown[]) => tasksFindFirst(...args),
      },
    },
    select: () => ({ from: () => ({ where: () => Promise.resolve(selectRows()) }) }),
    insert: (table: Table) => ({
      values: (values: unknown) => {
        const write: Write = { kind: "insert", table: getTableName(table), values };
        writes.push(write);
        const returning = () => Promise.resolve(returningRows());
        return settled({
          returning,
          onConflictDoNothing: () => {
            write.onConflictDoNothing = true;
            return settled({ returning });
          },
        });
      },
    }),
    update: (table: Table) => ({
      set: (values: unknown) => ({
        where: (condition: SQL) => {
          writes.push({ kind: "update", table: getTableName(table), values, where: render(condition) });
          return settled({ returning: () => Promise.resolve(returningRows()) });
        },
      }),
    }),
    delete: (table: Table) => ({
      where: (condition: SQL) => {
        writes.push({ kind: "delete", table: getTableName(table), where: render(condition) });
        return settled({ returning: () => Promise.resolve(returningRows()) });
      },
    }),
    execute: (query: SQL) => {
      writes.push({ kind: "execute", where: render(query) });
      return Promise.resolve();
    },
    transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };
  return { db };
});

import {
  carryOverTasks,
  createBoardTask,
  deleteBoardTask,
  getBoardTasksForDay,
  getCarryOverCandidates,
  getNextTaskOrder,
  initializeDefaultColumns,
  moveTaskToDay,
  reorderTask,
  setDoneColumn,
  updateBoardTask,
} from "./board-service";
import type { BoardColumn, BoardTask } from "@/types";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const DAY = "2026-10-19";
const TODO: BoardColumn = {
  id: "c-todo",
  userId: USER_ID,
  name: "Todo",
  order: 0,
  isDone: false,
  createdAt: null,
  updatedAt: null,
};
const WORKING: BoardColumn = { ...TODO, id: "c-working", name: "Working", order: 1 };
const DONE: BoardColumn = { ...TODO, id: "c-done", name: "Done", order: 2, isDone: true };

function task(overrides: Partial<BoardTask> = {}): BoardTask & { column: BoardColumn } {
  const base: BoardTask = {
    id: "t-1",
    userId: USER_ID,
    columnId: TODO.id,
    roadPathId: null,
    title: "Some task",
    description: null,
    priority: null,
    order: 0,
    boardDate: DAY,
    dueDate: null,
    completedAt: null,
    carryOverDeclinedAt: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
  const column = [TODO, WORKING, DONE].find((c) => c.id === base.columnId) ?? TODO;
  return { ...base, column };
}

const writesTo = (table: string, kind?: Write["kind"]) =>
  writes.filter((w) => w.table === table && (!kind || w.kind === kind));

beforeEach(() => {
  writes.length = 0;
  selectRows.mockReturnValue([]);
  returningRows.mockReturnValue([]);
});

afterEach(() => {
  // Reset, not clear: a queued `…Once` value left unused must not leak.
  vi.resetAllMocks();
});

describe("getBoardTasksForDay", () => {
  it("reads one day's board", async () => {
    tasksFindMany.mockResolvedValueOnce([task()]);

    expect(await getBoardTasksForDay(USER_ID, DAY)).toEqual([task()]);
    const { where } = tasksFindMany.mock.calls[0][0] as { where: SQL };
    expect(render(where)?.params).toEqual([USER_ID, DAY]);
  });
});

describe("initializeDefaultColumns", () => {
  it("leaves an existing board alone", async () => {
    columnsFindMany.mockResolvedValueOnce([TODO]);

    expect(await initializeDefaultColumns(USER_ID)).toEqual([TODO]);
    expect(writes).toEqual([]);
  });

  it("creates Todo / Working / Done, with Done flagged", async () => {
    columnsFindMany.mockResolvedValueOnce([]);
    returningRows.mockReturnValueOnce([TODO, WORKING, DONE]);

    await initializeDefaultColumns(USER_ID);

    expect(writes[0].values).toEqual([
      { userId: USER_ID, name: "Todo", order: 0, isDone: false },
      { userId: USER_ID, name: "Working", order: 1, isDone: false },
      { userId: USER_ID, name: "Done", order: 2, isDone: true },
    ]);
  });
});

describe("setDoneColumn", () => {
  it("clears the old Done column before flagging the new one", async () => {
    columnsFindFirst.mockResolvedValueOnce(WORKING);
    // Only the second update returns its row.
    returningRows.mockReturnValueOnce([{ ...WORKING, isDone: true }]);

    const column = await setDoneColumn(WORKING.id, USER_ID);

    expect(column).toEqual({ ...WORKING, isDone: true });
    const updates = writesTo("board_columns", "update");
    expect(updates.map((u) => (u.values as { isDone: boolean }).isDone)).toEqual([false, true]);
    expect(updates[0].where?.sql).toContain("<>");
  });

  it("refuses a column the user does not own", async () => {
    columnsFindFirst.mockResolvedValueOnce(undefined);

    await expect(setDoneColumn("foreign", USER_ID)).rejects.toThrow("Column not found");
    expect(writes).toEqual([]);
  });
});

describe("createBoardTask", () => {
  it("refuses a column the user does not own", async () => {
    columnsFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      createBoardTask(USER_ID, { columnId: "foreign", boardDate: DAY, title: "x", order: 0 })
    ).rejects.toThrow("Column not found");
    expect(writes).toEqual([]);
  });

  it("puts the task on its day, unfinished", async () => {
    columnsFindFirst.mockResolvedValueOnce(TODO);
    returningRows.mockReturnValueOnce([task()]);

    await createBoardTask(USER_ID, { columnId: TODO.id, boardDate: DAY, title: "x", order: 3 });

    expect(writes[0].values).toEqual(
      expect.objectContaining({ userId: USER_ID, boardDate: DAY, order: 3, completedAt: null })
    );
  });

  it("marks a task written straight into Done as finished", async () => {
    columnsFindFirst.mockResolvedValueOnce(DONE);
    returningRows.mockReturnValueOnce([task()]);

    await createBoardTask(USER_ID, { columnId: DONE.id, boardDate: DAY, title: "x", order: 0 });

    expect((writes[0].values as { completedAt: unknown }).completedAt).toBeInstanceOf(Date);
  });
});

describe("updateBoardTask", () => {
  it("writes the edited fields", async () => {
    tasksFindFirst.mockResolvedValueOnce(task());
    returningRows.mockReturnValueOnce([task({ title: "New" })]);

    const updated = await updateBoardTask("t-1", USER_ID, { title: "New" });

    expect(updated?.title).toBe("New");
    expect(writesTo("board_tasks", "update")).toHaveLength(1);
  });

  it("returns null for a task that is not the user's", async () => {
    tasksFindFirst.mockResolvedValueOnce(undefined);

    expect(await updateBoardTask("t-1", USER_ID, { title: "New" })).toBeNull();
    expect(writes).toEqual([]);
  });

  it("moves a task given a new column to the end of it, not to its old position", async () => {
    // updateBoardTask's read, then reorderTask's read and re-read.
    tasksFindFirst
      .mockResolvedValueOnce(task({ order: 0 }))
      .mockResolvedValueOnce(task({ order: 0 }))
      .mockResolvedValueOnce(task({ columnId: WORKING.id, order: 2 }));
    columnsFindFirst.mockResolvedValueOnce(WORKING);
    selectRows.mockReturnValueOnce([{ id: "a" }, { id: "b" }]);
    returningRows.mockReturnValue([task()]);

    await updateBoardTask("t-1", USER_ID, { columnId: WORKING.id, title: "x" });

    const move = writesTo("board_tasks", "update").find(
      (w) => (w.values as { columnId?: string }).columnId === WORKING.id
    );
    expect(move?.values).toEqual(expect.objectContaining({ order: 2 }));
  });
});

describe("deleteBoardTask", () => {
  it("closes the gap in its column on its own day", async () => {
    returningRows.mockReturnValueOnce([{ columnId: TODO.id, order: 1, boardDate: DAY }]);

    await deleteBoardTask("t-1", USER_ID);

    const [gap] = writesTo("board_tasks", "update");
    expect(gap.where?.sql).toContain('"board_date" = ');
    expect(gap.where?.params).toEqual([USER_ID, TODO.id, DAY, 1]);
  });

  it("does nothing more when the task did not exist", async () => {
    returningRows.mockReturnValueOnce([]);

    await deleteBoardTask("t-1", USER_ID);

    expect(writesTo("board_tasks", "update")).toEqual([]);
  });
});

describe("reorderTask", () => {
  it("throws when the task is not found", async () => {
    tasksFindFirst.mockResolvedValueOnce(undefined);

    await expect(reorderTask("t-1", USER_ID, TODO.id, 0)).rejects.toThrow("Task not found");
  });

  it("shifts only the same column on the same day", async () => {
    tasksFindFirst.mockResolvedValueOnce(task({ order: 0 })).mockResolvedValueOnce(task({ order: 2 }));
    selectRows.mockReturnValueOnce([{}, {}, {}]);

    await reorderTask("t-1", USER_ID, TODO.id, 2);

    const [shift, place] = writesTo("board_tasks", "update");
    expect(shift.where?.params).toEqual([USER_ID, TODO.id, DAY, 0, 3]);
    expect(place.values).toEqual(expect.objectContaining({ order: 2 }));
    // Inside one column nothing is finished or reopened.
    expect(writesTo("road_path_check_ins")).toEqual([]);
  });

  it("clamps a drop past the end of the list", async () => {
    tasksFindFirst.mockResolvedValueOnce(task({ order: 0 })).mockResolvedValueOnce(task());
    columnsFindFirst.mockResolvedValueOnce(WORKING);
    selectRows.mockReturnValueOnce([{}, {}]);

    await reorderTask("t-1", USER_ID, WORKING.id, 40);

    const move = writesTo("board_tasks", "update").at(-1);
    expect(move?.values).toEqual(expect.objectContaining({ columnId: WORKING.id, order: 2 }));
  });

  it("finishes a habit's task moved into Done and checks its day in", async () => {
    const habitTask = task({ roadPathId: "rp-1", boardDate: "2026-10-16" });
    tasksFindFirst.mockResolvedValueOnce(habitTask).mockResolvedValueOnce(habitTask);
    columnsFindFirst.mockResolvedValueOnce(DONE);
    selectRows.mockReturnValueOnce([]);

    await reorderTask("t-1", USER_ID, DONE.id, 0);

    const finished = writesTo("board_tasks", "update").at(-1);
    expect((finished?.values as { completedAt: unknown }).completedAt).toBeInstanceOf(Date);
    const [checkIn] = writesTo("road_path_check_ins", "insert");
    // The day it was on, not the day it was dragged.
    expect(checkIn.values).toEqual({ roadPathId: "rp-1", day: "2026-10-16", taskId: "t-1" });
    expect(checkIn.onConflictDoNothing).toBe(true);
  });

  it("reopens a task moved out of Done and takes its check-in back", async () => {
    const doneTask = task({
      columnId: DONE.id,
      roadPathId: "rp-1",
      completedAt: new Date("2026-10-19T15:00:00Z"),
    });
    tasksFindFirst.mockResolvedValueOnce(doneTask).mockResolvedValueOnce(doneTask);
    columnsFindFirst.mockResolvedValueOnce(TODO);
    selectRows.mockReturnValueOnce([]);

    await reorderTask("t-1", USER_ID, TODO.id, 0);

    expect(writesTo("board_tasks", "update").at(-1)?.values).toEqual({ completedAt: null });
    const [removed] = writesTo("road_path_check_ins", "delete");
    expect(removed.where?.params).toEqual(["t-1"]);
  });

  it("records nothing for a plain task moved between open columns", async () => {
    tasksFindFirst.mockResolvedValueOnce(task()).mockResolvedValueOnce(task());
    columnsFindFirst.mockResolvedValueOnce(WORKING);
    selectRows.mockReturnValueOnce([]);

    await reorderTask("t-1", USER_ID, WORKING.id, 0);

    expect(writesTo("road_path_check_ins")).toEqual([]);
    expect(
      writesTo("board_tasks", "update").some((w) => "completedAt" in (w.values as object))
    ).toBe(false);
  });
});

describe("getNextTaskOrder", () => {
  it("is the end of the column on that day", async () => {
    tasksFindMany.mockResolvedValueOnce([{ order: 4 }]);

    expect(await getNextTaskOrder(TODO.id, USER_ID, DAY)).toBe(5);
    const { where } = tasksFindMany.mock.calls[0][0] as { where: SQL };
    expect(render(where)?.params).toEqual([TODO.id, USER_ID, DAY]);
  });

  it("is 0 for an empty list", async () => {
    tasksFindMany.mockResolvedValueOnce([]);

    expect(await getNextTaskOrder(TODO.id, USER_ID, DAY)).toBe(0);
  });
});

describe("getCarryOverCandidates", () => {
  it("asks the database for open, plain, unanswered tasks from before today", async () => {
    tasksFindMany.mockResolvedValueOnce([]);

    await getCarryOverCandidates(USER_ID, DAY);

    const { where } = tasksFindMany.mock.calls[0][0] as { where: SQL };
    const query = render(where);
    expect(query?.params).toEqual([USER_ID, DAY]);
    expect(query?.sql).toContain('"board_date" < ');
    for (const column of ["completed_at", "road_path_id", "carry_over_declined_at"]) {
      expect(query?.sql).toContain(`"${column}" is null`);
    }
  });

  it("drops what sits in Done and sorts oldest day first, then by column", async () => {
    tasksFindMany.mockResolvedValueOnce([
      task({ id: "working-18", columnId: WORKING.id, boardDate: "2026-10-18" }),
      task({ id: "todo-18", boardDate: "2026-10-18", title: "Call the bank" }),
      task({ id: "todo-12", boardDate: "2026-10-12" }),
      task({ id: "in-done", columnId: DONE.id, boardDate: "2026-10-18" }),
    ]);

    const candidates = await getCarryOverCandidates(USER_ID, DAY);

    expect(candidates.map((c) => c.id)).toEqual(["todo-12", "todo-18", "working-18"]);
    expect(candidates[1]).toEqual({
      id: "todo-18",
      title: "Call the bank",
      columnId: TODO.id,
      columnName: "Todo",
      boardDate: "2026-10-18",
    });
  });
});

describe("carryOverTasks", () => {
  beforeEach(() => {
    tasksFindMany.mockResolvedValue([
      task({ id: "a", boardDate: "2026-10-17", order: 0 }),
      task({ id: "b", columnId: WORKING.id, boardDate: "2026-10-18", order: 0 }),
      task({ id: "c", boardDate: "2026-10-18", order: 0 }),
    ]);
  });

  it("moves the chosen tasks to the top of their column today and renumbers both days", async () => {
    const result = await carryOverTasks(USER_ID, DAY, ["a", "c", "b"], []);

    expect(result).toEqual({ moved: 3, left: 0 });
    const moves = writesTo("board_tasks", "update").map((w) => w.values as { boardDate: string; order: number });
    // Todo gets a (older) above c; Working gets b. All before today's own tasks.
    expect(moves).toEqual([
      expect.objectContaining({ boardDate: DAY, order: -2 }),
      expect.objectContaining({ boardDate: DAY, order: -1 }),
      expect.objectContaining({ boardDate: DAY, order: -1 }),
    ]);
    const renumbered = writes.filter((w) => w.kind === "execute").map((w) => w.where?.params.slice(1));
    expect(renumbered).toEqual(
      expect.arrayContaining([
        [TODO.id, DAY],
        [WORKING.id, DAY],
        [TODO.id, "2026-10-17"],
        [TODO.id, "2026-10-18"],
        [WORKING.id, "2026-10-18"],
      ])
    );
  });

  it("leaves the rest on their day and marks them answered", async () => {
    const result = await carryOverTasks(USER_ID, DAY, ["a"], ["b", "c"]);

    expect(result).toEqual({ moved: 1, left: 2 });
    const declined = writesTo("board_tasks", "update").at(-1);
    expect(declined?.values).toEqual({ carryOverDeclinedAt: expect.any(Date) });
    // In the order they were offered: same day, Todo before Working.
    expect(declined?.where?.params.flat()).toEqual([USER_ID, "c", "b"]);
  });

  it("ignores ids that were not on offer", async () => {
    const result = await carryOverTasks(USER_ID, DAY, ["someone-elses"], ["another"]);

    expect(result).toEqual({ moved: 0, left: 0 });
    expect(writes).toEqual([]);
  });
});

describe("moveTaskToDay", () => {
  it("keeps a habit's task on its own day", async () => {
    tasksFindFirst.mockResolvedValueOnce(task({ roadPathId: "rp-1" }));

    await expect(moveTaskToDay("t-1", USER_ID, DAY)).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it("moves it to the end of its column on that day, and closes the gap it leaves", async () => {
    tasksFindFirst.mockResolvedValueOnce(
      task({ boardDate: "2026-10-12", carryOverDeclinedAt: new Date() })
    );
    tasksFindMany.mockResolvedValueOnce([{ order: 1 }]);
    returningRows.mockReturnValueOnce([task()]);

    await moveTaskToDay("t-1", USER_ID, DAY);

    expect(writesTo("board_tasks", "update")[0].values).toEqual(
      expect.objectContaining({ boardDate: DAY, order: 2, carryOverDeclinedAt: null })
    );
    expect(writes.find((w) => w.kind === "execute")?.where?.params.slice(1)).toEqual([
      TODO.id,
      "2026-10-12",
    ]);
  });
});
