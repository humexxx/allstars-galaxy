import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/utils/request-today", () => ({
  getRequestTodayIso: vi.fn().mockResolvedValue("2026-10-19"),
}));

vi.mock("@/lib/services/board-service", () => ({
  // An ordinary column by default; the Done column is a test of its own.
  getBoardColumn: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    isDone: false,
  }),
  createBoardColumn: vi.fn(),
  updateBoardColumn: vi.fn(),
  deleteBoardColumn: vi.fn(),
  // Three columns by default, so a delete is allowed unless a test says not.
  countBoardColumns: vi.fn().mockResolvedValue(3),
  getBoardTask: vi.fn(),
  createBoardTask: vi.fn(),
  updateBoardTask: vi.fn(),
  deleteBoardTask: vi.fn(),
  reorderTask: vi.fn(),
  getNextTaskOrder: vi.fn(),
  setDoneColumn: vi.fn(),
  carryOverTasks: vi.fn(),
  moveTaskToDay: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  carryOverTasks,
  countBoardColumns,
  createBoardColumn,
  createBoardTask,
  deleteBoardColumn,
  deleteBoardTask,
  getBoardColumn,
  getBoardTask,
  getNextTaskOrder,
  moveTaskToDay,
  reorderTask,
  setDoneColumn,
  updateBoardColumn,
  updateBoardTask,
} from "@/lib/services/board-service";

import {
  carryOverTasksAction,
  createBoardColumnAction,
  createBoardTaskAction,
  deleteBoardColumnAction,
  deleteBoardTaskAction,
  moveTaskToTodayAction,
  reorderBoardTaskAction,
  setDoneColumnAction,
  updateBoardColumnAction,
  updateBoardTaskAction,
} from "./board";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const COLUMN_ID = "11111111-1111-4111-8111-111111111111";
const COLUMN_ID_2 = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";

const TODAY = "2026-10-19";
// Board writes check road paths in, so they revalidate the whole segment.
const REVALIDATED = ["/portal/productivity", "layout"] as const;

beforeEach(() => {
  vi.mocked(requireEffectiveContext).mockResolvedValue({
    realUser: { id: USER_ID } as never,
    realRole: "user",
    impersonatedUser: null,
    effectiveUserId: USER_ID,
    isImpersonating: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createBoardColumnAction", () => {
  it("creates the column, logs the mutation, and revalidates", async () => {
    const column = { id: COLUMN_ID, name: "Todo", order: 0 } as unknown as Awaited<
      ReturnType<typeof createBoardColumn>
    >;
    vi.mocked(createBoardColumn).mockResolvedValueOnce(column);

    const result = await createBoardColumnAction({ name: "Todo", order: 0 });

    expect(result).toEqual({ success: true, data: column });
    expect(createBoardColumn).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: "Todo", order: 0 })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardColumn.create",
        entityTable: "board_columns",
        entityId: COLUMN_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("rejects when name is empty", async () => {
    const result = await createBoardColumnAction({
      name: "",
      order: 0,
    });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createBoardColumn).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateBoardColumnAction", () => {
  it("updates the column on valid input", async () => {
    const column = { id: COLUMN_ID, name: "Doing" } as unknown as Awaited<
      ReturnType<typeof updateBoardColumn>
    >;
    vi.mocked(updateBoardColumn).mockResolvedValueOnce(column);

    const result = await updateBoardColumnAction({ id: COLUMN_ID, name: "Doing" });

    expect(result).toEqual({ success: true, data: column });
    expect(updateBoardColumn).toHaveBeenCalledWith(
      COLUMN_ID,
      USER_ID,
      expect.objectContaining({ name: "Doing" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardColumn.update",
        entityTable: "board_columns",
        entityId: COLUMN_ID,
        after: column,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("captures the before snapshot only when impersonating", async () => {
    const IMPERSONATED = "44444444-4444-4444-8444-444444444444";
    vi.mocked(requireEffectiveContext).mockResolvedValueOnce({
      realUser: { id: USER_ID } as never,
      realRole: "admin",
      impersonatedUser: {
        id: IMPERSONATED,
        email: "x@y.com",
        fullName: "X",
      },
      effectiveUserId: IMPERSONATED,
      isImpersonating: true,
    });
    const before = { id: COLUMN_ID, name: "Todo" } as unknown as Awaited<
      ReturnType<typeof getBoardColumn>
    >;
    const after = { id: COLUMN_ID, name: "Doing" } as unknown as Awaited<
      ReturnType<typeof updateBoardColumn>
    >;
    vi.mocked(getBoardColumn).mockResolvedValueOnce(before);
    vi.mocked(updateBoardColumn).mockResolvedValueOnce(after);

    await updateBoardColumnAction({ id: COLUMN_ID, name: "Doing" });

    expect(getBoardColumn).toHaveBeenCalledWith(COLUMN_ID, IMPERSONATED);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ before, after }),
    );
  });

  it("returns an error when the column is not the user's", async () => {
    vi.mocked(updateBoardColumn).mockResolvedValueOnce(null);

    const result = await updateBoardColumnAction({ id: COLUMN_ID, name: "Doing" });

    expect(result).toEqual({ success: false, error: "Column not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects when id is not a uuid", async () => {
    const result = await updateBoardColumnAction({
      id: "not-a-uuid",
      name: "Doing",
    });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updateBoardColumn).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteBoardColumnAction", () => {
  it("deletes the column, logs, and revalidates", async () => {
    vi.mocked(deleteBoardColumn).mockResolvedValueOnce(undefined as never);

    const result = await deleteBoardColumnAction(COLUMN_ID);

    expect(result).toEqual({ success: true });
    expect(deleteBoardColumn).toHaveBeenCalledWith(COLUMN_ID, USER_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardColumn.delete",
        entityTable: "board_columns",
        entityId: COLUMN_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("refuses to delete the Done column", async () => {
    vi.mocked(getBoardColumn).mockResolvedValueOnce({ id: COLUMN_ID, isDone: true } as never);

    const result = await deleteBoardColumnAction(COLUMN_ID);

    expect(result).toEqual({
      success: false,
      error: "Choose another Done column before deleting this one",
    });
    expect(deleteBoardColumn).not.toHaveBeenCalled();
  });

  it("returns not found for a column that is not the user's", async () => {
    vi.mocked(getBoardColumn).mockResolvedValueOnce(null);

    const result = await deleteBoardColumnAction(COLUMN_ID);

    expect(result).toEqual({ success: false, error: "Column not found" });
    expect(deleteBoardColumn).not.toHaveBeenCalled();
  });

  it("refuses to delete the last column", async () => {
    vi.mocked(countBoardColumns).mockResolvedValueOnce(1);

    const result = await deleteBoardColumnAction(COLUMN_ID);

    expect(result).toEqual({ success: false, error: "A board needs at least one column" });
    expect(deleteBoardColumn).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a uuid", async () => {
    const result = await deleteBoardColumnAction("not-a-uuid");

    expect(result).toEqual({ success: false, error: "Invalid column" });
    expect(deleteBoardColumn).not.toHaveBeenCalled();
  });

  it("returns a failure instead of throwing when the service fails", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    vi.mocked(deleteBoardColumn).mockRejectedValueOnce(new Error("db down"));

    const result = await deleteBoardColumnAction(COLUMN_ID);

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createBoardTaskAction", () => {
  it("creates the task, derives order from getNextTaskOrder, logs, and revalidates", async () => {
    vi.mocked(getNextTaskOrder).mockResolvedValueOnce(3);
    const task = { id: TASK_ID, title: "Ship it", order: 3 } as unknown as Awaited<
      ReturnType<typeof createBoardTask>
    >;
    vi.mocked(createBoardTask).mockResolvedValueOnce(task);

    const result = await createBoardTaskAction({
      columnId: COLUMN_ID,
      boardDate: "2026-10-18",
      title: "Ship it",
    });

    expect(result).toEqual({ success: true, data: task });
    // The end of that column on THAT day's board.
    expect(getNextTaskOrder).toHaveBeenCalledWith(COLUMN_ID, USER_ID, "2026-10-18");
    expect(createBoardTask).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        columnId: COLUMN_ID,
        boardDate: "2026-10-18",
        title: "Ship it",
        order: 3,
      })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardTask.create",
        entityTable: "board_tasks",
        entityId: TASK_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("rejects a task without a day", async () => {
    const result = await createBoardTaskAction({
      columnId: COLUMN_ID,
      title: "Ship it",
    } as never);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createBoardTask).not.toHaveBeenCalled();
  });

  it("never takes a road path from the client", async () => {
    vi.mocked(getNextTaskOrder).mockResolvedValueOnce(0);
    vi.mocked(createBoardTask).mockResolvedValueOnce({ id: TASK_ID } as never);

    await createBoardTaskAction({
      columnId: COLUMN_ID,
      boardDate: TODAY,
      title: "Ship it",
      roadPathId: "55555555-5555-4555-8555-555555555555",
    } as never);

    expect(vi.mocked(createBoardTask).mock.calls[0][1]).not.toHaveProperty("roadPathId");
  });

  it("rejects when title is empty", async () => {
    const result = await createBoardTaskAction({
      columnId: COLUMN_ID,
      boardDate: TODAY,
      title: "",
    });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createBoardTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateBoardTaskAction", () => {
  it("updates the task on valid input", async () => {
    const task = { id: TASK_ID, title: "Ship it v2" } as unknown as Awaited<
      ReturnType<typeof updateBoardTask>
    >;
    vi.mocked(updateBoardTask).mockResolvedValueOnce(task);

    const result = await updateBoardTaskAction({
      id: TASK_ID,
      title: "Ship it v2",
    });

    expect(result).toEqual({ success: true, data: task });
    expect(updateBoardTask).toHaveBeenCalledWith(
      TASK_ID,
      USER_ID,
      expect.objectContaining({ title: "Ship it v2" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardTask.update",
        entityTable: "board_tasks",
        entityId: TASK_ID,
        after: task,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("returns an error when the task is not the user's", async () => {
    vi.mocked(updateBoardTask).mockResolvedValueOnce(null);

    const result = await updateBoardTaskAction({ id: TASK_ID, title: "Ship it v2" });

    expect(result).toEqual({ success: false, error: "Task not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects when id is not a uuid", async () => {
    const result = await updateBoardTaskAction({
      id: "not-a-uuid",
      title: "Ship it v2",
    });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updateBoardTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteBoardTaskAction", () => {
  it("deletes the task, logs, and revalidates", async () => {
    vi.mocked(deleteBoardTask).mockResolvedValueOnce(undefined as never);

    const result = await deleteBoardTaskAction(TASK_ID);

    expect(result).toEqual({ success: true });
    expect(deleteBoardTask).toHaveBeenCalledWith(TASK_ID, USER_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardTask.delete",
        entityTable: "board_tasks",
        entityId: TASK_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("rejects an id that is not a uuid", async () => {
    const result = await deleteBoardTaskAction("not-a-uuid");

    expect(result).toEqual({ success: false, error: "Invalid task" });
    expect(deleteBoardTask).not.toHaveBeenCalled();
  });
});

describe("reorderBoardTaskAction", () => {
  it("reorders the task on valid input", async () => {
    const task = { id: TASK_ID, order: 2 } as unknown as Awaited<
      ReturnType<typeof reorderTask>
    >;
    vi.mocked(reorderTask).mockResolvedValueOnce(task);

    const result = await reorderBoardTaskAction({
      taskId: TASK_ID,
      destinationColumnId: COLUMN_ID_2,
      order: 2,
    });

    expect(result).toEqual({ success: true, data: task });
    expect(reorderTask).toHaveBeenCalledWith(TASK_ID, USER_ID, COLUMN_ID_2, 2);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardTask.reorder",
        entityTable: "board_tasks",
        entityId: TASK_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("rejects when taskId is not a uuid", async () => {
    const result = await reorderBoardTaskAction({
      taskId: "not-a-uuid",
      destinationColumnId: COLUMN_ID_2,
      order: 0,
    });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(reorderTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setDoneColumnAction", () => {
  it("moves the Done flag to the column", async () => {
    const column = { id: COLUMN_ID_2, isDone: true } as never;
    vi.mocked(setDoneColumn).mockResolvedValueOnce(column);

    const result = await setDoneColumnAction(COLUMN_ID_2);

    expect(result).toEqual({ success: true, data: column });
    expect(setDoneColumn).toHaveBeenCalledWith(COLUMN_ID_2, USER_ID);
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("returns not found when nothing matched", async () => {
    vi.mocked(setDoneColumn).mockResolvedValueOnce(null);

    const result = await setDoneColumnAction(COLUMN_ID_2);

    expect(result).toEqual({ success: false, error: "Column not found" });
  });
});

describe("carryOverTasksAction", () => {
  const OTHER_ID = "66666666-6666-4666-8666-666666666666";

  it("answers for the reader's today, not the server's", async () => {
    vi.mocked(carryOverTasks).mockResolvedValueOnce({ moved: 1, left: 1 });

    const result = await carryOverTasksAction({ moveIds: [TASK_ID], leaveIds: [OTHER_ID] });

    expect(result).toEqual({ success: true, data: { moved: 1, left: 1 } });
    expect(carryOverTasks).toHaveBeenCalledWith(USER_ID, TODAY, [TASK_ID], [OTHER_ID]);
    expect(logImpersonatedMutation).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith(...REVALIDATED);
  });

  it("rejects ids that are not uuids", async () => {
    const result = await carryOverTasksAction({ moveIds: ["nope"], leaveIds: [] });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(carryOverTasks).not.toHaveBeenCalled();
  });
});

describe("moveTaskToTodayAction", () => {
  it("puts the task on today's board", async () => {
    vi.mocked(getBoardTask).mockResolvedValueOnce({ id: TASK_ID, roadPathId: null } as never);
    vi.mocked(moveTaskToDay).mockResolvedValueOnce({ id: TASK_ID } as never);

    const result = await moveTaskToTodayAction(TASK_ID);

    expect(result).toEqual({ success: true, data: { id: TASK_ID } });
    expect(moveTaskToDay).toHaveBeenCalledWith(TASK_ID, USER_ID, TODAY);
  });

  it("keeps a road path's task on its own day", async () => {
    vi.mocked(getBoardTask).mockResolvedValueOnce({
      id: TASK_ID,
      roadPathId: "55555555-5555-4555-8555-555555555555",
    } as never);

    const result = await moveTaskToTodayAction(TASK_ID);

    expect(result).toEqual({ success: false, error: "A road path's task counts for its own day" });
    expect(moveTaskToDay).not.toHaveBeenCalled();
  });

  it("returns not found for a task that is not the user's", async () => {
    vi.mocked(getBoardTask).mockResolvedValueOnce(null);

    const result = await moveTaskToTodayAction(TASK_ID);

    expect(result).toEqual({ success: false, error: "Task not found" });
  });
});
