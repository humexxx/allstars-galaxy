import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/road-path-service", () => ({
  getUserRoadPaths: vi.fn(),
  getRoadPath: vi.fn(),
  createRoadPath: vi.fn(),
  updateRoadPath: vi.fn(),
  deleteRoadPath: vi.fn(),
  getRoadPathMilestones: vi.fn(),
  createRoadPathMilestone: vi.fn(),
  updateRoadPathMilestone: vi.fn(),
  deleteRoadPathMilestone: vi.fn(),
  getNextMilestoneOrder: vi.fn(),
  getRoadPathProgress: vi.fn(),
  createRoadPathProgress: vi.fn(),
  deleteRoadPathProgress: vi.fn(),
  calculateRoadPathStats: vi.fn(),
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
  getUserRoadPaths,
  getRoadPath,
  createRoadPath,
  updateRoadPath,
  deleteRoadPath,
  getRoadPathMilestones,
  createRoadPathMilestone,
  updateRoadPathMilestone,
  deleteRoadPathMilestone,
  getNextMilestoneOrder,
  getRoadPathProgress,
  createRoadPathProgress,
  deleteRoadPathProgress,
  calculateRoadPathStats,
} from "@/lib/services/road-path-service";
import { createAutomatedTasksForRoadPath } from "@/lib/services/task-automation-service";

import {
  getUserRoadPathsAction,
  getRoadPathAction,
  createRoadPathAction,
  updateRoadPathAction,
  deleteRoadPathAction,
  getRoadPathMilestonesAction,
  createRoadPathMilestoneAction,
  updateRoadPathMilestoneAction,
  deleteRoadPathMilestoneAction,
  getNextMilestoneOrderAction,
  getRoadPathProgressAction,
  getRoadPathDetailAction,
  createRoadPathProgressAction,
  deleteRoadPathProgressAction,
  calculateRoadPathStatsAction,
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

describe("getUserRoadPathsAction", () => {
  it("returns the road paths for the effective user", async () => {
    const paths = [{ id: ROAD_PATH_ID }] as unknown as Awaited<
      ReturnType<typeof getUserRoadPaths>
    >;
    vi.mocked(getUserRoadPaths).mockResolvedValueOnce(paths);

    const result = await getUserRoadPathsAction();

    expect(result).toEqual({ success: true, data: paths });
    expect(getUserRoadPaths).toHaveBeenCalledOnce();
    expect(getUserRoadPaths).toHaveBeenCalledWith(USER_ID);
  });
});

describe("getRoadPathAction", () => {
  it("returns the road path when found", async () => {
    const path = { id: ROAD_PATH_ID } as unknown as Awaited<
      ReturnType<typeof getRoadPath>
    >;
    vi.mocked(getRoadPath).mockResolvedValueOnce(path);

    const result = await getRoadPathAction(ROAD_PATH_ID);

    expect(result).toEqual({ success: true, data: path });
    expect(getRoadPath).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
  });

  it("throws when the road path is not found", async () => {
    vi.mocked(getRoadPath).mockResolvedValueOnce(null);

    await expect(getRoadPathAction(ROAD_PATH_ID)).rejects.toThrow(
      "Road path not found"
    );
  });
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
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
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

  it("swallows createAutomatedTasksForRoadPath errors and still resolves", async () => {
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

    expect(result).toEqual({ success: true, data: path });
    expect(createAutomatedTasksForRoadPath).toHaveBeenCalledOnce();
    expect(logImpersonatedMutation).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
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

describe("updateRoadPathAction", () => {
  it("updates the road path on valid input", async () => {
    const path = { id: ROAD_PATH_ID, title: "Updated" } as unknown as Awaited<
      ReturnType<typeof updateRoadPath>
    >;
    vi.mocked(updateRoadPath).mockResolvedValueOnce(path);

    const result = await updateRoadPathAction({
      id: ROAD_PATH_ID,
      title: "Updated",
    } as unknown as Parameters<typeof updateRoadPathAction>[0]);

    expect(result).toEqual({ success: true, data: path });
    expect(updateRoadPath).toHaveBeenCalledOnce();
    expect(updateRoadPath).toHaveBeenCalledWith(
      ROAD_PATH_ID,
      USER_ID,
      expect.objectContaining({ title: "Updated" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPath.update",
        entityTable: "road_paths",
        entityId: ROAD_PATH_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("throws when the road path is not found", async () => {
    vi.mocked(updateRoadPath).mockResolvedValueOnce(
      undefined as unknown as Awaited<ReturnType<typeof updateRoadPath>>
    );

    await expect(
      updateRoadPathAction({
        id: ROAD_PATH_ID,
        title: "Updated",
      } as unknown as Parameters<typeof updateRoadPathAction>[0])
    ).rejects.toThrow("Road path not found");
  });

  it("rejects payloads with a non-uuid id", async () => {
    const result = await updateRoadPathAction({
      id: "not-a-uuid",
      title: "Updated",
    } as unknown as Parameters<typeof updateRoadPathAction>[0]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updateRoadPath).not.toHaveBeenCalled();
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
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
  });
});

describe("getRoadPathMilestonesAction", () => {
  it("returns the milestones for the given road path", async () => {
    const milestones = [{ id: MILESTONE_ID }] as unknown as Awaited<
      ReturnType<typeof getRoadPathMilestones>
    >;
    vi.mocked(getRoadPathMilestones).mockResolvedValueOnce(milestones);

    const result = await getRoadPathMilestonesAction(ROAD_PATH_ID);

    expect(result).toEqual({ success: true, data: milestones });
    expect(getRoadPathMilestones).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
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
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
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
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("throws when the milestone is not found", async () => {
    vi.mocked(updateRoadPathMilestone).mockResolvedValueOnce(
      undefined as unknown as Awaited<ReturnType<typeof updateRoadPathMilestone>>
    );

    await expect(
      updateRoadPathMilestoneAction({
        id: MILESTONE_ID,
        title: "M1 v2",
      } as unknown as Parameters<typeof updateRoadPathMilestoneAction>[0])
    ).rejects.toThrow("Milestone not found");
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
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
  });
});

describe("getNextMilestoneOrderAction", () => {
  it("returns the next milestone order", async () => {
    vi.mocked(getNextMilestoneOrder).mockResolvedValueOnce(3);

    const result = await getNextMilestoneOrderAction(ROAD_PATH_ID);

    expect(result).toEqual({ success: true, data: 3 });
    expect(getNextMilestoneOrder).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
  });
});

describe("getRoadPathProgressAction", () => {
  it("returns the progress entries with optional date filters", async () => {
    const progress = [{ id: PROGRESS_ID }] as unknown as Awaited<
      ReturnType<typeof getRoadPathProgress>
    >;
    vi.mocked(getRoadPathProgress).mockResolvedValueOnce(progress);

    const start = new Date("2026-01-01");
    const end = new Date("2026-12-31");
    const result = await getRoadPathProgressAction(ROAD_PATH_ID, start, end);

    expect(result).toEqual({ success: true, data: progress });
    expect(getRoadPathProgress).toHaveBeenCalledWith(
      ROAD_PATH_ID,
      USER_ID,
      start,
      end
    );
  });

  it("works without optional date filters", async () => {
    const progress = [] as unknown as Awaited<
      ReturnType<typeof getRoadPathProgress>
    >;
    vi.mocked(getRoadPathProgress).mockResolvedValueOnce(progress);

    const result = await getRoadPathProgressAction(ROAD_PATH_ID);

    expect(result).toEqual({ success: true, data: progress });
    expect(getRoadPathProgress).toHaveBeenCalledWith(
      ROAD_PATH_ID,
      USER_ID,
      undefined,
      undefined
    );
  });
});

describe("getRoadPathDetailAction", () => {
  it("returns milestones, progress, and stats together", async () => {
    const milestones = [{ id: MILESTONE_ID }] as unknown as Awaited<
      ReturnType<typeof getRoadPathMilestones>
    >;
    const progress = [{ id: PROGRESS_ID }] as unknown as Awaited<
      ReturnType<typeof getRoadPathProgress>
    >;
    const stats = {
      totalProgress: 50,
      completedMilestones: 1,
      totalMilestones: 2,
      daysRemaining: 10,
      progressRate: 0.5,
    } as unknown as Awaited<ReturnType<typeof calculateRoadPathStats>>;

    vi.mocked(getRoadPathMilestones).mockResolvedValueOnce(milestones);
    vi.mocked(getRoadPathProgress).mockResolvedValueOnce(progress);
    vi.mocked(calculateRoadPathStats).mockResolvedValueOnce(stats);

    const result = await getRoadPathDetailAction(ROAD_PATH_ID);

    expect(result).toEqual({
      success: true,
      data: { milestones, progress, stats },
    });
    expect(getRoadPathMilestones).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
    expect(getRoadPathProgress).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
    expect(calculateRoadPathStats).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
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
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
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
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
  });
});

describe("calculateRoadPathStatsAction", () => {
  it("returns the calculated stats", async () => {
    const stats = {
      totalProgress: 25,
      completedMilestones: 1,
      totalMilestones: 4,
      daysRemaining: 30,
      progressRate: 0.1,
    } as unknown as Awaited<ReturnType<typeof calculateRoadPathStats>>;
    vi.mocked(calculateRoadPathStats).mockResolvedValueOnce(stats);

    const result = await calculateRoadPathStatsAction(ROAD_PATH_ID);

    expect(result).toEqual({ success: true, data: stats });
    expect(calculateRoadPathStats).toHaveBeenCalledWith(ROAD_PATH_ID, USER_ID);
  });
});
