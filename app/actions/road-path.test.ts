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

vi.mock("@/lib/services/road-path-service", () => ({
  getRoadPath: vi.fn(),
  createRoadPath: vi.fn(),
  updateRoadPath: vi.fn(),
  deleteRoadPath: vi.fn(),
  createRoadPathMilestone: vi.fn(),
  updateRoadPathMilestone: vi.fn(),
  deleteRoadPathMilestone: vi.fn(),
  getNextMilestoneOrder: vi.fn(),
  createRoadPathProgress: vi.fn(),
  deleteRoadPathProgress: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  createRoadPath,
  updateRoadPath,
  deleteRoadPath,
  createRoadPathMilestone,
  updateRoadPathMilestone,
  deleteRoadPathMilestone,
  getNextMilestoneOrder,
  createRoadPathProgress,
  deleteRoadPathProgress,
} from "@/lib/services/road-path-service";

import {
  createRoadPathAction,
  updateRoadPathAction,
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
  it("creates the road path for the reader's today, logs, and revalidates", async () => {
    const path = { id: ROAD_PATH_ID, title: "Exercise" } as unknown as Awaited<
      ReturnType<typeof createRoadPath>
    >;
    vi.mocked(createRoadPath).mockResolvedValueOnce(path);

    const result = await createRoadPathAction({
      title: "Exercise",
      startDate: "2026-10-19",
      scheduleDays: [5, 1, 3, 1],
    });

    expect(result).toEqual({ success: true, data: path });
    expect(createRoadPath).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        title: "Exercise",
        startDate: new Date("2026-10-19"),
        // Sorted, once each.
        scheduleDays: [1, 3, 5],
      }),
      "2026-10-19"
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "roadPath.create",
        entityTable: "road_paths",
        entityId: ROAD_PATH_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("rejects a weekday outside 0–6", async () => {
    const result = await createRoadPathAction({
      title: "Exercise",
      startDate: "2026-10-19",
      scheduleDays: [7],
    });

    expect(result.success).toBe(false);
    expect(createRoadPath).not.toHaveBeenCalled();
  });

  it("says why a target before the start is refused", async () => {
    const result = await createRoadPathAction({
      title: "Exercise",
      startDate: "2026-10-19",
      targetDate: "2026-10-01",
    });

    expect(result).toEqual({
      success: false,
      error: "The target date can't be before the start date",
    });
  });

  it("returns an error envelope when title is missing", async () => {
    const result = await createRoadPathAction({
      startDate: "2026-06-01",
    } as unknown as Parameters<typeof createRoadPathAction>[0]);

    expect(result.success).toBe(false);
    expect(createRoadPath).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateRoadPathAction", () => {
  it("saves every field it is given, for the reader's today", async () => {
    const path = { id: ROAD_PATH_ID, title: "Gym" } as unknown as Awaited<
      ReturnType<typeof updateRoadPath>
    >;
    vi.mocked(updateRoadPath).mockResolvedValueOnce(path);

    const result = await updateRoadPathAction({
      id: ROAD_PATH_ID,
      title: "Gym",
      description: "Legs",
      startDate: "2026-10-01",
      targetDate: null,
      targetValue: null,
      unit: "",
      scheduleDays: [2, 4],
      completedAt: null,
    });

    expect(result).toEqual({ success: true, data: path });
    expect(updateRoadPath).toHaveBeenCalledWith(
      ROAD_PATH_ID,
      USER_ID,
      expect.objectContaining({
        title: "Gym",
        description: "Legs",
        startDate: new Date("2026-10-01"),
        scheduleDays: [2, 4],
        completedAt: null,
      }),
      "2026-10-19"
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: "roadPath.update", after: path })
    );
    expect(revalidatePath).toHaveBeenCalledWith(PATH, "layout");
  });

  it("returns not found when the path is not the user's", async () => {
    vi.mocked(updateRoadPath).mockResolvedValueOnce(null);

    const result = await updateRoadPathAction({ id: ROAD_PATH_ID, title: "Gym" });

    expect(result).toEqual({ success: false, error: "Road path not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a uuid", async () => {
    const result = await updateRoadPathAction({ id: "nope", title: "Gym" });

    expect(result.success).toBe(false);
    expect(updateRoadPath).not.toHaveBeenCalled();
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
