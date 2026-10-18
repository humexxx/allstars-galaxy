import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/road-path-service", () => ({
  getRoadPath: vi.fn(),
  createRoadPath: vi.fn(),
  deleteRoadPath: vi.fn(),
  createRoadPathMilestone: vi.fn(),
  updateRoadPathMilestone: vi.fn(),
  deleteRoadPathMilestone: vi.fn(),
  getNextMilestoneOrder: vi.fn(),
  createRoadPathProgress: vi.fn(),
  deleteRoadPathProgress: vi.fn(),
}));

vi.mock("@/lib/services/task-automation-service", () => ({
  createAutomatedTasksForRoadPath: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  createRoadPath,
  deleteRoadPath,
  createRoadPathMilestone,
  updateRoadPathMilestone,
  deleteRoadPathMilestone,
  getNextMilestoneOrder,
  createRoadPathProgress,
  deleteRoadPathProgress,
} from "@/lib/services/road-path-service";
import { createAutomatedTasksForRoadPath } from "@/lib/services/task-automation-service";

import {
  createRoadPathAction,
  deleteRoadPathAction,
  createRoadPathMilestoneAction,
  updateRoadPathMilestoneAction,
  deleteRoadPathMilestoneAction,
  createRoadPathProgressAction,
  deleteRoadPathProgressAction,
} from "./road-path";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ROAD_PATH_ID = "11111111-1111-4111-8111-111111111111";
const MILESTONE_ID = "22222222-2222-4222-8222-222222222222";
const PROGRESS_ID = "33333333-3333-4333-8333-333333333333";

const PATH = "/portal/productivity";

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

describe("createRoadPathAction", () => {
  it("creates the road path, logs, and revalidates on the happy path", async () => {
    const path = {
      id: ROAD_PATH_ID,
      title: "Learn Spanish",
      autoCreateTasks: false,
      taskFrequency: null,
    } as unknown as Awaited<ReturnType<typeof createRoadPath>>;
    vi.mocked(createRoadPath).mockResolvedValueOnce(path);

    const result = await createRoadPathAction({
      title: "Learn Spanish",
      startDate: "2026-06-01",
    } as unknown as Parameters<typeof createRoadPathAction>[0]);

    expect(result).toEqual({ success: true, data: path });
    expect(createRoadPath).toHaveBeenCalledOnce();
    expect(createRoadPath).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ title: "Learn Spanish", autoCreateTasks: false })
    );
    expect(createAutomatedTasksForRoadPath).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPath.create",
        entityTable: "road_paths",
        entityId: ROAD_PATH_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("triggers createAutomatedTasksForRoadPath when createFirstTask + autoCreateTasks are set", async () => {
    const path = {
      id: ROAD_PATH_ID,
      title: "Daily Run",
      autoCreateTasks: true,
      taskFrequency: "daily",
    } as unknown as Awaited<ReturnType<typeof createRoadPath>>;
    vi.mocked(createRoadPath).mockResolvedValueOnce(path);

    const result = await createRoadPathAction({
      title: "Daily Run",
      startDate: "2026-06-01",
      autoCreateTasks: true,
      taskFrequency: "daily",
      createFirstTask: true,
    } as unknown as Parameters<typeof createRoadPathAction>[0]);

    expect(result).toEqual({ success: true, data: path });
    expect(createAutomatedTasksForRoadPath).toHaveBeenCalledOnce();
    expect(createAutomatedTasksForRoadPath).toHaveBeenCalledWith(
      USER_ID,
      ROAD_PATH_ID
    );
  });

  it("still creates the path when its first task fails, and says so", async () => {
    const path = {
      id: ROAD_PATH_ID,
      title: "Daily Run",
      autoCreateTasks: true,
      taskFrequency: "daily",
    } as unknown as Awaited<ReturnType<typeof createRoadPath>>;
    vi.mocked(createRoadPath).mockResolvedValueOnce(path);
    vi.mocked(createAutomatedTasksForRoadPath).mockRejectedValueOnce(
      new Error("boom")
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createRoadPathAction({
      title: "Daily Run",
      startDate: "2026-06-01",
      autoCreateTasks: true,
      taskFrequency: "daily",
      createFirstTask: true,
    } as unknown as Parameters<typeof createRoadPathAction>[0]);

    expect(result).toEqual({
      success: true,
      data: path,
      message: "Road path created, but its first task could not be added",
    });
    expect(createAutomatedTasksForRoadPath).toHaveBeenCalledOnce();
    expect(logImpersonatedMutation).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
    errorSpy.mockRestore();
  });

  it("returns an error envelope when title is missing", async () => {
    const result = await createRoadPathAction({
      startDate: "2026-06-01",
    } as unknown as Parameters<typeof createRoadPathAction>[0]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createRoadPath).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteRoadPathAction", () => {
  it("deletes the road path, logs, and revalidates", async () => {
    vi.mocked(deleteRoadPath).mockResolvedValueOnce(undefined as never);

    const result = await deleteRoadPathAction(ROAD_PATH_ID);

    expect(result).toEqual({ success: true });
    expect(deleteRoadPath).toHaveBeenCalledOnce();
    expect(deleteRoadPath).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPath.delete",
        entityTable: "road_paths",
        entityId: ROAD_PATH_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("rejects an id that is not a uuid", async () => {
    const result = await deleteRoadPathAction("not-a-uuid");

    expect(result).toEqual({ success: false, error: "Invalid road path" });
    expect(deleteRoadPath).not.toHaveBeenCalled();
  });
});

describe("createRoadPathMilestoneAction", () => {
  it("creates the milestone on valid input", async () => {
    const milestone = { id: MILESTONE_ID, title: "M1" } as unknown as Awaited<
      ReturnType<typeof createRoadPathMilestone>
    >;
    vi.mocked(createRoadPathMilestone).mockResolvedValueOnce(milestone);

    const result = await createRoadPathMilestoneAction({
      roadPathId: ROAD_PATH_ID,
      title: "M1",
      order: 0,
    } as unknown as Parameters<typeof createRoadPathMilestoneAction>[0]);

    expect(result).toEqual({ success: true, data: milestone });
    expect(createRoadPathMilestone).toHaveBeenCalledOnce();
    expect(createRoadPathMilestone).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        roadPathId: ROAD_PATH_ID,
        title: "M1",
        order: 0,
      })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPathMilestone.create",
        entityTable: "road_path_milestones",
        entityId: MILESTONE_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("asks the database for the next order when none is given", async () => {
    const milestone = { id: MILESTONE_ID, title: "M2" } as unknown as Awaited<
      ReturnType<typeof createRoadPathMilestone>
    >;
    vi.mocked(getNextMilestoneOrder).mockResolvedValueOnce(3);
    vi.mocked(createRoadPathMilestone).mockResolvedValueOnce(milestone);

    await createRoadPathMilestoneAction({ roadPathId: ROAD_PATH_ID, title: "M2" });

    expect(getNextMilestoneOrder).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
    expect(createRoadPathMilestone).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ order: 3 })
    );
  });

  it("rejects payloads with a non-uuid roadPathId", async () => {
    const result = await createRoadPathMilestoneAction({
      roadPathId: "not-a-uuid",
      title: "M1",
      order: 0,
    } as unknown as Parameters<typeof createRoadPathMilestoneAction>[0]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createRoadPathMilestone).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateRoadPathMilestoneAction", () => {
  it("updates the milestone on valid input", async () => {
    const milestone = { id: MILESTONE_ID, title: "M1 v2" } as unknown as Awaited<
      ReturnType<typeof updateRoadPathMilestone>
    >;
    vi.mocked(updateRoadPathMilestone).mockResolvedValueOnce(milestone);

    const result = await updateRoadPathMilestoneAction({
      id: MILESTONE_ID,
      title: "M1 v2",
    } as unknown as Parameters<typeof updateRoadPathMilestoneAction>[0]);

    expect(result).toEqual({ success: true, data: milestone });
    expect(updateRoadPathMilestone).toHaveBeenCalledOnce();
    expect(updateRoadPathMilestone).toHaveBeenCalledWith(
      MILESTONE_ID,
      USER_ID,
      expect.objectContaining({ title: "M1 v2" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPathMilestone.update",
        entityTable: "road_path_milestones",
        entityId: MILESTONE_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("returns an error when the milestone is not found", async () => {
    vi.mocked(updateRoadPathMilestone).mockResolvedValueOnce(null);

    const result = await updateRoadPathMilestoneAction({
      id: MILESTONE_ID,
      title: "M1 v2",
    });

    expect(result).toEqual({ success: false, error: "Milestone not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a failure instead of throwing when the service fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(updateRoadPathMilestone).mockRejectedValueOnce(new Error("Milestone not found"));

    const result = await updateRoadPathMilestoneAction({ id: MILESTONE_ID, title: "M1 v2" });

    expect(result).toEqual({ success: false, error: "Action failed" });
    errorSpy.mockRestore();
  });

  it("rejects payloads with a non-uuid id", async () => {
    const result = await updateRoadPathMilestoneAction({
      id: "not-a-uuid",
      title: "M1 v2",
    } as unknown as Parameters<typeof updateRoadPathMilestoneAction>[0]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updateRoadPathMilestone).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteRoadPathMilestoneAction", () => {
  it("deletes the milestone, logs, and revalidates", async () => {
    vi.mocked(deleteRoadPathMilestone).mockResolvedValueOnce(
      undefined as never
    );

    const result = await deleteRoadPathMilestoneAction(MILESTONE_ID);

    expect(result).toEqual({ success: true });
    expect(deleteRoadPathMilestone).toHaveBeenCalledOnce();
    expect(deleteRoadPathMilestone).toHaveBeenCalledWith(MILESTONE_ID, USER_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPathMilestone.delete",
        entityTable: "road_path_milestones",
        entityId: MILESTONE_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("rejects an id that is not a uuid", async () => {
    const result = await deleteRoadPathMilestoneAction("not-a-uuid");

    expect(result).toEqual({ success: false, error: "Invalid milestone" });
    expect(deleteRoadPathMilestone).not.toHaveBeenCalled();
  });
});

describe("createRoadPathProgressAction", () => {
  it("creates a progress entry on valid input", async () => {
    const progress = { id: PROGRESS_ID, value: "5" } as unknown as Awaited<
      ReturnType<typeof createRoadPathProgress>
    >;
    vi.mocked(createRoadPathProgress).mockResolvedValueOnce(progress);

    const result = await createRoadPathProgressAction({
      roadPathId: ROAD_PATH_ID,
      value: 5,
    } as unknown as Parameters<typeof createRoadPathProgressAction>[0]);

    expect(result).toEqual({ success: true, data: progress });
    expect(createRoadPathProgress).toHaveBeenCalledOnce();
    expect(createRoadPathProgress).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ roadPathId: ROAD_PATH_ID, value: 5 })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPathProgress.create",
        entityTable: "road_path_progress",
        entityId: PROGRESS_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("rejects payloads with a non-uuid roadPathId", async () => {
    const result = await createRoadPathProgressAction({
      roadPathId: "not-a-uuid",
      value: 5,
    } as unknown as Parameters<typeof createRoadPathProgressAction>[0]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createRoadPathProgress).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteRoadPathProgressAction", () => {
  it("deletes the progress entry, logs, and revalidates", async () => {
    vi.mocked(deleteRoadPathProgress).mockResolvedValueOnce(undefined as never);

    const result = await deleteRoadPathProgressAction(PROGRESS_ID);

    expect(result).toEqual({ success: true });
    expect(deleteRoadPathProgress).toHaveBeenCalledOnce();
    expect(deleteRoadPathProgress).toHaveBeenCalledWith(PROGRESS_ID, USER_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPathProgress.delete",
        entityTable: "road_path_progress",
        entityId: PROGRESS_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });
});
