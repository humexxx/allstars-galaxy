import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/board-service", () => ({
  getUserBoardColumns: vi.fn(),
  getBoardColumn: vi.fn(),
  createBoardColumn: vi.fn(),
  updateBoardColumn: vi.fn(),
  deleteBoardColumn: vi.fn(),
  initializeDefaultColumns: vi.fn(),
  getBoardTask: vi.fn(),
  getUserBoardTasks: vi.fn(),
  createBoardTask: vi.fn(),
  updateBoardTask: vi.fn(),
  deleteBoardTask: vi.fn(),
  reorderTask: vi.fn(),
  getNextTaskOrder: vi.fn(),
  getNextColumnOrder: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  createBoardColumn,
  createBoardTask,
  deleteBoardColumn,
  deleteBoardTask,
  getBoardColumn,
  getBoardTask,
  getNextColumnOrder,
  getNextTaskOrder,
  getUserBoardColumns,
  getUserBoardTasks,
  initializeDefaultColumns,
  reorderTask,
  updateBoardColumn,
  updateBoardTask,
} from "@/lib/services/board-service";

import {
  createBoardColumnAction,
  createBoardTaskAction,
  deleteBoardColumnAction,
  deleteBoardTaskAction,
  getBoardColumnAction,
  getBoardDataAction,
  getBoardTaskAction,
  getNextColumnOrderAction,
  getNextTaskOrderAction,
  getUserBoardColumnsAction,
  getUserBoardTasksAction,
  initializeDefaultColumnsAction,
  reorderBoardTaskAction,
  updateBoardColumnAction,
  updateBoardTaskAction,
} from "./board";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const COLUMN_ID = "11111111-1111-4111-8111-111111111111";
const COLUMN_ID_2 = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";

const BOARD_PATH = "/portal/productivity/board";

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

describe("getUserBoardColumnsAction", () => {
  it("returns the columns for the effective user", async () => {
    const columns = [{ id: COLUMN_ID, name: "Todo", tasks: [] }] as unknown as Awaited<
      ReturnType<typeof getUserBoardColumns>
    >;
    vi.mocked(getUserBoardColumns).mockResolvedValueOnce(columns);

    const result = await getUserBoardColumnsAction();

    expect(result).toEqual({ success: true, data: columns });
    expect(getUserBoardColumns).toHaveBeenCalledWith(USER_ID);
  });
});

describe("getBoardColumnAction", () => {
  it("returns the column when found", async () => {
    const column = { id: COLUMN_ID, name: "Todo", tasks: [] } as unknown as Awaited<
      ReturnType<typeof getBoardColumn>
    >;
    vi.mocked(getBoardColumn).mockResolvedValueOnce(column);

    const result = await getBoardColumnAction(COLUMN_ID);

    expect(result).toEqual({ success: true, data: column });
    expect(getBoardColumn).toHaveBeenCalledWith(COLUMN_ID, USER_ID);
  });

  it("throws when column not found", async () => {
    vi.mocked(getBoardColumn).mockResolvedValueOnce(null);

    await expect(getBoardColumnAction(COLUMN_ID)).rejects.toThrow("Column not found");
  });
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
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
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
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
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
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
  });
});

describe("initializeDefaultColumnsAction", () => {
  it("seeds the default columns and revalidates", async () => {
    const columns = [{ id: COLUMN_ID, name: "Todo" }] as unknown as Awaited<
      ReturnType<typeof initializeDefaultColumns>
    >;
    vi.mocked(initializeDefaultColumns).mockResolvedValueOnce(columns);

    const result = await initializeDefaultColumnsAction();

    expect(result).toEqual({ success: true, data: columns });
    expect(initializeDefaultColumns).toHaveBeenCalledWith(USER_ID);
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
  });
});

describe("getUserBoardTasksAction", () => {
  it("returns the user's tasks", async () => {
    const tasks = [{ id: TASK_ID, title: "Ship it" }] as unknown as Awaited<
      ReturnType<typeof getUserBoardTasks>
    >;
    vi.mocked(getUserBoardTasks).mockResolvedValueOnce(tasks);

    const result = await getUserBoardTasksAction();

    expect(result).toEqual({ success: true, data: tasks });
    expect(getUserBoardTasks).toHaveBeenCalledWith(USER_ID);
  });
});

describe("getBoardDataAction", () => {
  it("returns columns and tasks together", async () => {
    const columns = [{ id: COLUMN_ID }] as unknown as Awaited<
      ReturnType<typeof getUserBoardColumns>
    >;
    const tasks = [{ id: TASK_ID }] as unknown as Awaited<
      ReturnType<typeof getUserBoardTasks>
    >;
    vi.mocked(getUserBoardColumns).mockResolvedValueOnce(columns);
    vi.mocked(getUserBoardTasks).mockResolvedValueOnce(tasks);

    const result = await getBoardDataAction();

    expect(result).toEqual({ success: true, data: { columns, tasks } });
    expect(getUserBoardColumns).toHaveBeenCalledWith(USER_ID);
    expect(getUserBoardTasks).toHaveBeenCalledWith(USER_ID);
  });
});

describe("getBoardTaskAction", () => {
  it("returns the task when found", async () => {
    const task = { id: TASK_ID, title: "Ship it" } as unknown as Awaited<
      ReturnType<typeof getBoardTask>
    >;
    vi.mocked(getBoardTask).mockResolvedValueOnce(task);

    const result = await getBoardTaskAction(TASK_ID);

    expect(result).toEqual({ success: true, data: task });
    expect(getBoardTask).toHaveBeenCalledWith(TASK_ID, USER_ID);
  });

  it("throws when task not found", async () => {
    vi.mocked(getBoardTask).mockResolvedValueOnce(null);

    await expect(getBoardTaskAction(TASK_ID)).rejects.toThrow("Task not found");
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
      title: "Ship it",
    });

    expect(result).toEqual({ success: true, data: task });
    expect(getNextTaskOrder).toHaveBeenCalledWith(COLUMN_ID, USER_ID);
    expect(createBoardTask).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        columnId: COLUMN_ID,
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
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
  });

  it("uses the provided order without calling getNextTaskOrder", async () => {
    const task = { id: TASK_ID, title: "Ship it", order: 7 } as unknown as Awaited<
      ReturnType<typeof createBoardTask>
    >;
    vi.mocked(createBoardTask).mockResolvedValueOnce(task);

    await createBoardTaskAction({
      columnId: COLUMN_ID,
      title: "Ship it",
      order: 7,
    });

    expect(getNextTaskOrder).not.toHaveBeenCalled();
    expect(createBoardTask).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ order: 7 })
    );
  });

  it("rejects when title is empty", async () => {
    const result = await createBoardTaskAction({
      columnId: COLUMN_ID,
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
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
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
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
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
      sourceColumnId: COLUMN_ID,
      destinationColumnId: COLUMN_ID_2,
      order: 2,
    });

    expect(result).toEqual({ success: true, data: task });
    expect(reorderTask).toHaveBeenCalledWith(
      TASK_ID,
      USER_ID,
      COLUMN_ID,
      COLUMN_ID_2,
      2
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "boardTask.reorder",
        entityTable: "board_tasks",
        entityId: TASK_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(BOARD_PATH);
  });

  it("rejects when taskId is not a uuid", async () => {
    const result = await reorderBoardTaskAction({
      taskId: "not-a-uuid",
      sourceColumnId: COLUMN_ID,
      destinationColumnId: COLUMN_ID_2,
      order: 0,
    });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(reorderTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("getNextTaskOrderAction", () => {
  it("returns the next task order", async () => {
    vi.mocked(getNextTaskOrder).mockResolvedValueOnce(5);

    const result = await getNextTaskOrderAction(COLUMN_ID);

    expect(result).toEqual({ success: true, data: 5 });
    expect(getNextTaskOrder).toHaveBeenCalledWith(COLUMN_ID, USER_ID);
  });
});

describe("getNextColumnOrderAction", () => {
  it("returns the next column order", async () => {
    vi.mocked(getNextColumnOrder).mockResolvedValueOnce(4);

    const result = await getNextColumnOrderAction();

    expect(result).toEqual({ success: true, data: 4 });
    expect(getNextColumnOrder).toHaveBeenCalledWith(USER_ID);
  });
});
