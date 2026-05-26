import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/auth-server", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/task-automation-service", () => ({
  createAutomatedTasksForRoadPath: vi.fn(),
  createAutomatedTasksForAllRoadPaths: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/services/auth-server";
import {
  createAutomatedTasksForAllRoadPaths,
  createAutomatedTasksForRoadPath,
} from "@/lib/services/task-automation-service";

import {
  createAutomatedTaskAction,
  createAutomatedTasksForAllAction,
} from "./task-automation";

// zod v4 enforces v4 UUIDs (version digit 4, variant digit 8-b).
const USER_ID = "00000000-0000-4000-8000-000000000001";
const ROAD_PATH_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue({
    id: USER_ID,
  } as unknown as Awaited<ReturnType<typeof requireAuth>>);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createAutomatedTaskAction", () => {
  it("creates a task when one is needed (happy path)", async () => {
    const task = { id: "task-1", title: "Walk the dog" } as unknown as Awaited<
      ReturnType<typeof createAutomatedTasksForRoadPath>
    >;
    vi.mocked(createAutomatedTasksForRoadPath).mockResolvedValueOnce(task);

    const result = await createAutomatedTaskAction(ROAD_PATH_ID);

    expect(result).toEqual({
      success: true,
      data: task,
      message: "Task created successfully",
    });
    expect(requireAuth).toHaveBeenCalledTimes(1);
    expect(createAutomatedTasksForRoadPath).toHaveBeenCalledWith(
      USER_ID,
      ROAD_PATH_ID,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/portal/productivity");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("returns the 'no task needed' message when the service yields null", async () => {
    vi.mocked(createAutomatedTasksForRoadPath).mockResolvedValueOnce(null);

    const result = await createAutomatedTaskAction(ROAD_PATH_ID);

    expect(result).toEqual({
      success: true,
      data: null,
      message: "No task needed at this time",
    });
    expect(createAutomatedTasksForRoadPath).toHaveBeenCalledWith(
      USER_ID,
      ROAD_PATH_ID,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/portal/productivity");
  });

  it("returns an error envelope when roadPathId is not a uuid (safeParse fails)", async () => {
    const result = await createAutomatedTaskAction("not-a-uuid");

    expect(result).toEqual({ success: false, error: "Invalid roadPathId" });
    expect(createAutomatedTasksForRoadPath).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an error envelope for an empty string id", async () => {
    const result = await createAutomatedTaskAction("");

    expect(result).toEqual({ success: false, error: "Invalid roadPathId" });
    expect(createAutomatedTasksForRoadPath).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("propagates an unauthenticated rejection without calling the service", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(
      createAutomatedTaskAction(ROAD_PATH_ID),
    ).rejects.toThrow("Unauthorized");

    expect(createAutomatedTasksForRoadPath).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("propagates service-layer failures and does not revalidate", async () => {
    vi.mocked(createAutomatedTasksForRoadPath).mockRejectedValueOnce(
      new Error("pg boom"),
    );

    await expect(
      createAutomatedTaskAction(ROAD_PATH_ID),
    ).rejects.toThrow("pg boom");

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createAutomatedTasksForAllAction", () => {
  it("creates tasks for every road path and returns a count message", async () => {
    const tasks = [
      { id: "task-1" },
      { id: "task-2" },
      { id: "task-3" },
    ] as unknown as Awaited<ReturnType<typeof createAutomatedTasksForAllRoadPaths>>;
    vi.mocked(createAutomatedTasksForAllRoadPaths).mockResolvedValueOnce(tasks);

    const result = await createAutomatedTasksForAllAction();

    expect(result).toEqual({
      success: true,
      data: tasks,
      message: "3 task(s) created",
    });
    expect(requireAuth).toHaveBeenCalledTimes(1);
    expect(createAutomatedTasksForAllRoadPaths).toHaveBeenCalledWith(USER_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/portal/productivity");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("returns 0 task(s) created when no tasks were generated", async () => {
    vi.mocked(createAutomatedTasksForAllRoadPaths).mockResolvedValueOnce(
      [] as unknown as Awaited<ReturnType<typeof createAutomatedTasksForAllRoadPaths>>,
    );

    const result = await createAutomatedTasksForAllAction();

    expect(result).toEqual({
      success: true,
      data: [],
      message: "0 task(s) created",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/portal/productivity");
  });

  it("propagates the unauthenticated rejection", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(createAutomatedTasksForAllAction()).rejects.toThrow(
      "Unauthorized",
    );

    expect(createAutomatedTasksForAllRoadPaths).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
