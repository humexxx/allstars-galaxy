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
}));

import { revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { createRoadPath, updateRoadPath, deleteRoadPath } from "@/lib/services/road-path-service";

import { createRoadPathAction, updateRoadPathAction, deleteRoadPathAction } from "./road-path";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ROAD_PATH_ID = "11111111-1111-4111-8111-111111111111";

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

  it("refuses a road path with no days: it is a habit", async () => {
    const result = await createRoadPathAction({
      title: "Exercise",
      startDate: "2026-10-19",
      scheduleDays: [],
    });

    expect(result).toEqual({ success: false, error: "Pick at least one day" });
    expect(createRoadPath).not.toHaveBeenCalled();
  });

  it("returns an error envelope when title is missing", async () => {
    const result = await createRoadPathAction({
      startDate: "2026-06-01",
      scheduleDays: [1],
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
